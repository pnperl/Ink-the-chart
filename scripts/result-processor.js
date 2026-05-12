#!/usr/bin/env node

/**
 * Result Processor - Analyzes scanner data and detects alert triggers
 * Features:
 * - Compares current vs previous results
 * - Evaluates threshold breaches
 * - Batches alerts for efficient telegram delivery
 * - Formats alert messages with markdown
 */

const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../scanners-config.json'), 'utf8')
);

const CURRENT_RESULTS = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../.github/workflows/scanner-results.json'),
        'utf8'
      )
    );
  } catch {
    return { results: {}, errors: [] };
  }
})();

const HISTORY_FILE = path.join(
  __dirname,
  '../.github/workflows/scanner-history.json'
);

class ResultProcessor {
  constructor() {
    this.history = this.loadHistory();
    this.alerts = [];
    this.stats = {};
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      }
    } catch (err) {
      console.warn('⚠️  Could not load history:', err.message);
    }
    return {
      previousResults: {},
      lastUpdate: null,
    };
  }

  saveHistory() {
    fs.writeFileSync(
      HISTORY_FILE,
      JSON.stringify(
        {
          previousResults: CURRENT_RESULTS.results,
          lastUpdate: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }

  getScannerConfig(scannerId) {
    return CONFIG.scanners.find(s => s.id === scannerId);
  }

  evaluateScanner(scannerId, currentCount) {
    const config = this.getScannerConfig(scannerId);
    if (!config) return null;

    const previousResult = this.history.previousResults[scannerId];
    const previousCount = previousResult ? previousResult.count : null;
    const changeAmount = previousCount !== null ? currentCount - previousCount : 0;
    const changePercent =
      previousCount !== null && previousCount > 0
        ? ((changeAmount / previousCount) * 100).toFixed(1)
        : 'N/A';

    let shouldAlert = false;
    let reason = '';

    // Evaluate based on alert condition
    if (config.alertOn === 'count_change') {
      const { min, max } = config.threshold;
      if (currentCount >= min && currentCount <= max) {
        shouldAlert = true;
        reason = `Count ${currentCount} within range [${min}-${max}]`;
      }
    } else if (config.alertOn === 'count_increase') {
      const { minIncrease } = config.threshold;
      if (changeAmount >= minIncrease && changeAmount > 0) {
        shouldAlert = true;
        reason = `Increased by ${changeAmount}`;
      }
    } else if (config.alertOn === 'threshold_breach') {
      const { value } = config.threshold;
      if (currentCount > value) {
        shouldAlert = true;
        reason = `Exceeded threshold of ${value}`;
      }
    }

    return {
      id: scannerId,
      name: config.name,
      currentCount,
      previousCount,
      changeAmount,
      changePercent,
      shouldAlert,
      reason,
      priority: config.priority,
      url: config.url,
    };
  }

  processResults() {
    console.log('\n📊 Processing scanner results...\n');

    for (const [scannerId, result] of Object.entries(CURRENT_RESULTS.results)) {
      const evaluation = this.evaluateScanner(scannerId, result.count);

      if (evaluation) {
        this.stats[scannerId] = evaluation;

        if (evaluation.shouldAlert) {
          console.log(
            `🚨 ALERT: ${evaluation.name} - ${evaluation.reason}`
          );
          this.alerts.push(evaluation);
        } else {
          console.log(
            `ℹ️  ${evaluation.name}: ${evaluation.currentCount} stocks (change: ${evaluation.changeAmount > 0 ? '+' : ''}${evaluation.changeAmount})`
          );
        }
      }
    }

    console.log(
      `\n✅ Processing complete. ${this.alerts.length} alert(s) triggered.\n`
    );
  }

  formatAlertMessage() {
    if (this.alerts.length === 0) return null;

    // Sort by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sortedAlerts = this.alerts.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    let message = '🚨 *ChartLink Scanner Alerts*\n';
    message += `_${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}_\n\n`;

    for (const alert of sortedAlerts) {
      const emoji =
        alert.priority === 'HIGH' ? '🔴' : alert.priority === 'MEDIUM' ? '🟡' : '🟢';

      message += `${emoji} *${alert.name}*\n`;
      message += `Count: *${alert.currentCount}*`;

      if (alert.previousCount !== null) {
        const changeStr =
          alert.changeAmount > 0
            ? `+${alert.changeAmount}`
            : String(alert.changeAmount);
        message += ` (was ${alert.previousCount}, ${changeStr} / ${alert.changePercent}%)\n`;
      } else {
        message += ' (first scan)\n';
      }

      message += `Reason: _${alert.reason}_\n`;
      message += `URL: [View Scanner](${alert.url})\n\n`;
    }

    message += '---\n';
    message += `Total Alerts: *${this.alerts.length}*\n`;
    message += `Scanners Active: *${Object.keys(this.stats).length}*`;

    return message;
  }

  exportOutputs() {
    const hasAlerts = this.alerts.length > 0;
    const message = this.formatAlertMessage();

    console.log('::set-output name=has_alerts::' + (hasAlerts ? 'true' : 'false'));
    if (message) {
      // GitHub Actions has character limits; save to file instead
      fs.writeFileSync(
        path.join(__dirname, '../.github/workflows/alert-message.txt'),
        message
      );
      console.log('::set-output name=alert_message::' + message.substring(0, 100) + '...');
    }

    console.log('::set-output name=alert_count::' + this.alerts.length);
    console.log(
      '::set-output name=scanner_count::' + Object.keys(this.stats).length
    );
  }

  saveStats() {
    fs.writeFileSync(
      path.join(__dirname, '../.github/workflows/processing-stats.json'),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          scannersProcessed: Object.keys(this.stats).length,
          alertsTriggered: this.alerts.length,
          details: this.stats,
        },
        null,
        2
      )
    );
  }
}

async function main() {
  try {
    const processor = new ResultProcessor();
    processor.processResults();
    processor.saveStats();
    processor.exportOutputs();
    processor.saveHistory();

    process.exit(0);
  } catch (err) {
    console.error('❌ Processing error:', err);
    process.exit(1);
  }
}

main();
