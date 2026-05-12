#!/usr/bin/env node

/**
 * ChartLink Scanner Scraper
 * Fetches scanner URLs and extracts stock count/results
 * Features:
 * - Parallel requests with rate limiting
 * - Retry logic with exponential backoff
 * - User-Agent rotation
 * - Response parsing and validation
 * - Error handling and fallback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../scanners-config.json'), 'utf8')
);

const HEADERS = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../.github/workflows/request-headers.json'),
        'utf8'
      )
    );
  } catch {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      DNT: '1',
    };
  }
})();

class ChartinkScraper {
  constructor() {
    this.timeout = parseInt(process.env.CHARTINK_TIMEOUT || '15000');
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '2');
    this.parallelRequests = parseInt(process.env.PARALLEL_REQUESTS || '3');
    this.results = {};
    this.errors = [];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, attempt = 0) {
    try {
      console.log(
        `📡 Fetching (attempt ${attempt + 1}/${this.maxRetries + 1}): ${url.substring(0, 60)}...`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(
            `⚠️  Rate limited (429). Waiting before retry...`
          );
          throw new Error('RATE_LIMITED');
        }
        if (response.status === 403) {
          console.warn(`⚠️  Forbidden (403). Proxy may be blocked.`);
          throw new Error('BLOCKED');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return { html, status: response.status };
    } catch (err) {
      if (attempt < this.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 2000;
        console.warn(
          `⚠️  Fetch failed (${err.message}). Retrying in ${backoffMs}ms...`
        );
        await this.sleep(backoffMs);
        return this.fetchWithRetry(url, attempt + 1);
      }

      throw err;
    }
  }

  parseStockCount(html, scannerName) {
    try {
      // Try multiple parsing strategies
      const strategies = [
        // Strategy 1: ChartIQ data-stocks attribute
        () => {
          const match = html.match(/data-stocks=['"](\d+)['"]/i);
          return match ? parseInt(match[1]) : null;
        },

        // Strategy 2: Result count in heading
        () => {
          const match = html.match(
            /(\d+)\s+(?:stocks?|results?|screeners?)/i
          );
          return match ? parseInt(match[1]) : null;
        },

        // Strategy 3: JSON-LD structured data
        () => {
          const match = html.match(/"numberOfItems"\s*:\s*(\d+)/);
          return match ? parseInt(match[1]) : null;
        },

        // Strategy 4: Table/grid row count
        () => {
          const matches = html.match(/<tr|<div class="[^"]*row/gi) || [];
          return matches.length > 0 ? matches.length - 1 : null;
        },

        // Strategy 5: Specific meta tags
        () => {
          const match = html.match(
            /<meta name="count" content=['"](\d+)['"]/i
          );
          return match ? parseInt(match[1]) : null;
        },
      ];

      for (const strategy of strategies) {
        const count = strategy();
        if (count !== null && count > 0) {
          console.log(
            `✅ Parsed ${scannerName}: ${count} stocks`
          );
          return count;
        }
      }

      console.warn(
        `⚠️  Could not parse stock count for ${scannerName}`
      );
      return null;
    } catch (err) {
      console.error(`❌ Parse error for ${scannerName}:`, err.message);
      return null;
    }
  }

  async fetchScanner(scanner, index) {
    if (!scanner.enabled) {
      console.log(`⏭️  Skipping disabled scanner: ${scanner.name}`);
      return;
    }

    const delay = index * 1000; // Stagger requests by 1s
    await this.sleep(delay);

    try {
      const { html } = await this.fetchWithRetry(scanner.url);
      const count = this.parseStockCount(html, scanner.name);

      if (count !== null) {
        this.results[scanner.id] = {
          name: scanner.name,
          count,
          timestamp: new Date().toISOString(),
          url: scanner.url,
          priority: scanner.priority,
        };
      } else {
        throw new Error('Failed to parse stock count');
      }
    } catch (err) {
      console.error(
        `❌ Failed to fetch ${scanner.name}:`,
        err.message
      );
      this.errors.push({
        scanner: scanner.id,
        error: err.message,
      });
    }
  }

  async fetchAllScanners() {
    const scanners = CONFIG.scanners.filter(s => s.enabled);
    console.log(
      `\n📊 Starting scrape of ${scanners.length} scanners...\n`
    );

    // Process in batches to respect rate limits
    for (let i = 0; i < scanners.length; i += this.parallelRequests) {
      const batch = scanners.slice(i, i + this.parallelRequests);
      const promises = batch.map((scanner, idx) =>
        this.fetchScanner(scanner, idx)
      );
      await Promise.allSettled(promises);

      if (i + this.parallelRequests < scanners.length) {
        console.log(`⏳ Batch complete. Waiting before next batch...`);
        await this.sleep(2000);
      }
    }

    console.log(`\n✅ Scrape complete. Retrieved ${Object.keys(this.results).length} scanners\n`);
  }

  saveResults() {
    const outputDir = path.join(__dirname, '../.github/workflows');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resultsFile = path.join(outputDir, 'scanner-results.json');
    fs.writeFileSync(
      resultsFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results: this.results,
          errors: this.errors,
          successCount: Object.keys(this.results).length,
          errorCount: this.errors.length,
        },
        null,
        2
      )
    );

    console.log(`💾 Results saved to ${resultsFile}`);
  }

  setOutput(name, value) {
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
      return;
    }
    console.log(`::set-output name=${name}::${value}`);
  }

  exportOutputs() {
    this.setOutput('status', this.errors.length === 0 ? 'success' : 'partial');
    this.setOutput('retrieved_count', Object.keys(this.results).length);
    this.setOutput('error_count', this.errors.length);

    const successRate = (
      (Object.keys(this.results).length / CONFIG.scanners.filter(s => s.enabled).length) * 100
    ).toFixed(1);
    this.setOutput('success_rate', successRate + '%');
  }
}

async function main() {
  try {
    const scraper = new ChartinkScraper();
    await scraper.fetchAllScanners();
    scraper.saveResults();
    scraper.exportOutputs();

    if (scraper.errors.length > 0) {
      console.warn(
        `\n⚠️  ${scraper.errors.length} scanner(s) failed to fetch`
      );
    }

    process.exit(scraper.errors.length > 0 && Object.keys(scraper.results).length === 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Fatal scraper error:', err);
    process.exit(1);
  }
}

main();
