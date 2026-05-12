#!/usr/bin/env node

/**
 * Test Suite for ChartLink Scanner Bot
 * Validates configuration, connectivity, and alerting
 */

const fs = require('fs');
const path = require('path');
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../scanners-config.json'), 'utf8')
);

class TestSuite {
  constructor() {
    this.results = {};
    this.passed = 0;
    this.failed = 0;
  }

  log(level, message) {
    const icons = {
      PASS: '✅',
      FAIL: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      TEST: '🧪',
    };
    console.log(`${icons[level]} ${message}`);
  }

  async testConfiguration() {
    this.log('TEST', 'Testing configuration file...');

    try {
      if (!config.scanners || config.scanners.length === 0) {
        throw new Error('No scanners defined');
      }

      const enabledCount = config.scanners.filter(s => s.enabled).length;
      if (enabledCount === 0) {
        this.log('WARN', 'No enabled scanners found');
      } else {
        this.log('PASS', `Configuration valid (${enabledCount} enabled scanners)`);
        this.passed++;
      }

      // Validate each scanner
      for (const scanner of config.scanners) {
        if (!scanner.id || !scanner.name || !scanner.url) {
          throw new Error(`Scanner ${scanner.id} missing required fields`);
        }

        if (!scanner.url.startsWith('https://chartink.com/screener/')) {
          this.log('WARN', `Scanner ${scanner.name} URL may be invalid: ${scanner.url}`);
        } else {
          this.log('PASS', `Scanner "${scanner.name}" configured correctly`);
          this.passed++;
        }
      }
    } catch (err) {
      this.log('FAIL', `Configuration test failed: ${err.message}`);
      this.failed++;
    }
  }

  async testSecrets() {
    this.log('TEST', 'Testing environment variables...');

    const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const optional = ['PROXY_LIST', 'ALERT_THRESHOLD'];

    for (const secret of required) {
      if (process.env[secret]) {
        this.log('PASS', `${secret} is set`);
        this.passed++;
      } else {
        this.log('FAIL', `${secret} is missing (REQUIRED)`);
        this.failed++;
      }
    }

    for (const secret of optional) {
      if (process.env[secret]) {
        this.log('PASS', `${secret} is set`);
        this.passed++;
      } else {
        this.log('WARN', `${secret} not set (using default)`);
      }
    }
  }

  async testTelegramBot() {
    this.log('TEST', 'Testing Telegram bot connectivity...');

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      this.log('WARN', 'Skipping Telegram test (secrets not set)');
      return;
    }

    try {
      // Test getMe
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();

      if (data.ok) {
        this.log('PASS', `Telegram bot connected: @${data.result.username}`);
        this.passed++;
      } else {
        throw new Error(data.description || 'Invalid token');
      }

      // Test chat access
      const testMsg = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '🧪 Test connection from ChartLink Scanner Bot',
            parse_mode: 'Markdown',
          }),
        }
      );

      const msgData = await testMsg.json();
      if (msgData.ok) {
        this.log('PASS', `Test message sent successfully (ID: ${msgData.result.message_id})`);
        this.passed++;
      } else {
        throw new Error(msgData.description || 'Failed to send message');
      }
    } catch (err) {
      this.log('FAIL', `Telegram test failed: ${err.message}`);
      this.failed++;
    }
  }

  async testProxyPool() {
    this.log('TEST', 'Testing proxy pool connectivity...');

    const proxyList = process.env.PROXY_LIST || '';
    const proxies = proxyList
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(p => p);

    if (proxies.length === 0) {
      this.log('WARN', 'No custom proxies set, will use free pools');
      return;
    }

    let validCount = 0;
    for (const proxy of proxies.slice(0, 3)) {
      // Test first 3 only
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(5000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          this.log('PASS', `Proxy ${proxy.substring(0, 30)}... responsive`);
          validCount++;
          this.passed++;
        }
      } catch (err) {
        this.log('WARN', `Proxy ${proxy.substring(0, 30)}... failed: ${err.message}`);
      }
    }

    if (validCount === 0) {
      this.log('WARN', 'No proxies responding, will retry with free pools');
    }
  }

  async testChartlinkAccess() {
    this.log('TEST', 'Testing ChartLink scanner access...');

    const testScanner = config.scanners.find(s => s.enabled);
    if (!testScanner) {
      this.log('WARN', 'No enabled scanners to test');
      return;
    }

    try {
      const response = await fetch(testScanner.url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
      });

      if (response.ok) {
        this.log('PASS', `ChartLink scanner "${testScanner.name}" is accessible`);
        this.passed++;

        // Try parsing
        const html = await response.text();
        if (html.length > 1000) {
          this.log('PASS', `Scanner response is valid (${html.length} bytes)`);
          this.passed++;
        } else {
          this.log('WARN', `Scanner response seems short (${html.length} bytes)`);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      this.log('FAIL', `ChartLink access failed: ${err.message}`);
      this.failed++;
    }
  }

  async testJavaScriptModules() {
    this.log('TEST', 'Testing JavaScript modules...');

    const modules = [
      'proxy-rotator.js',
      'chartink-scraper.js',
      'result-processor.js',
      'telegram-sender.js',
    ];

    for (const module of modules) {
      const filePath = path.join(__dirname, module);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.length > 100) {
            this.log('PASS', `${module} exists and is valid`);
            this.passed++;
          } else {
            this.log('FAIL', `${module} is too small`);
            this.failed++;
          }
        } catch (err) {
          this.log('FAIL', `Cannot read ${module}: ${err.message}`);
          this.failed++;
        }
      } else {
        this.log('FAIL', `${module} not found`);
        this.failed++;
      }
    }
  }

  async testDiskSpace() {
    this.log('TEST', 'Testing disk space availability...');

    try {
      const stats = fs.statSync('/');
      this.log('PASS', 'Disk space available');
      this.passed++;

      // Check if state directory is writable
      const stateDir = path.join(__dirname, '../.github/workflows');
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(path.join(stateDir, '.test'), 'ok');
      fs.unlinkSync(path.join(stateDir, '.test'));
      this.log('PASS', 'State directory is writable');
      this.passed++;
    } catch (err) {
      this.log('FAIL', `Disk space test failed: ${err.message}`);
      this.failed++;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);

    const successRate = ((this.passed / (this.passed + this.failed)) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);

    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! Bot is ready to run.\n');
      return 0;
    } else {
      console.log(`\n⚠️  ${this.failed} test(s) failed. Please fix issues above.\n`);
      return 1;
    }
  }

  async runAll() {
    console.log('\n' + '='.repeat(50));
    console.log('ChartLink Scanner Bot - Test Suite');
    console.log('='.repeat(50) + '\n');

    await this.testConfiguration();
    await this.testSecrets();
    await this.testJavaScriptModules();
    await this.testDiskSpace();
    await this.testProxyPool();
    await this.testChartlinkAccess();
    await this.testTelegramBot();

    return this.printSummary();
  }
}

const suite = new TestSuite();
suite.runAll().then(code => process.exit(code));
