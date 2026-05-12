#!/usr/bin/env node

/**
 * Proxy Rotator - Manages IP rotation pool and detects blocks
 * Features:
 * - Rounds-robin proxy selection
 * - Blocked IP detection and quarantine
 * - Fallback to free proxy pools
 * - Request header rotation for stealth
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROXY_STATE_FILE = path.join(__dirname, '../.github/workflows/proxy-state.json');
const FREE_PROXY_POOLS = [
  'https://www.proxy-list.download/api/v1/get?type=http',
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http',
];

class ProxyRotator {
  constructor() {
    this.state = this.loadState();
    this.userProxies = this.parseProxyList();
    this.freeProxies = [];
    this.currentIndex = 0;
  }

  loadState() {
    try {
      if (fs.existsSync(PROXY_STATE_FILE)) {
        return JSON.parse(fs.readFileSync(PROXY_STATE_FILE, 'utf8'));
      }
    } catch (err) {
      console.warn('⚠️  Failed to load proxy state:', err.message);
    }
    return {
      usedProxies: [],
      blockedProxies: [],
      lastRotation: null,
      rotationCount: 0,
    };
  }

  saveState() {
    const dir = path.dirname(PROXY_STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROXY_STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  parseProxyList() {
    const proxyEnv = process.env.PROXY_LIST || '';
    if (!proxyEnv) {
      console.warn('⚠️  PROXY_LIST env var not set. Using rotation without custom proxies.');
      return [];
    }

    // Support CSV format: proxy1,proxy2,proxy3
    // Or newline separated
    return proxyEnv
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(p => p && (p.startsWith('http://') || p.startsWith('https://')))
      .slice(0, 20); // Limit to 20 proxies for safety
  }

  async fetchFreeProxyPool() {
    console.log('📡 Fetching free proxy pool...');
    for (const poolUrl of FREE_PROXY_POOLS) {
      try {
        const response = await fetch(poolUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': this.randomUserAgent(),
          },
        });

        if (response.ok) {
          const data = await response.json();
          const proxies = Array.isArray(data)
            ? data.map(p => `http://${p.ip}:${p.port}`)
            : data.proxies
            ? data.proxies.map(p => `http://${p.ip}:${p.port}`)
            : [];

          if (proxies.length > 0) {
            this.freeProxies = proxies.slice(0, 10);
            console.log(`✅ Fetched ${this.freeProxies.length} free proxies`);
            return;
          }
        }
      } catch (err) {
        console.warn(`⚠️  Free proxy pool ${poolUrl} unavailable:`, err.message);
      }
    }
  }

  getAvailableProxies() {
    const allProxies = [...this.userProxies, ...this.freeProxies];
    return allProxies.filter(p => !this.state.blockedProxies.includes(p));
  }

  getNextProxy() {
    const available = this.getAvailableProxies();

    if (available.length === 0) {
      console.warn('⚠️  No available proxies. Resetting block list...');
      this.state.blockedProxies = [];
      const allProxies = [...this.userProxies, ...this.freeProxies];
      if (allProxies.length === 0) {
        console.log('ℹ️  No proxies configured. Using direct connection.');
        return null;
      }
      return allProxies[0];
    }

    const proxy = available[this.currentIndex % available.length];
    this.currentIndex++;
    this.state.lastRotation = new Date().toISOString();
    this.state.rotationCount++;
    this.state.usedProxies.push({
      proxy,
      timestamp: this.state.lastRotation,
    });

    // Keep last 100 for audit
    if (this.state.usedProxies.length > 100) {
      this.state.usedProxies = this.state.usedProxies.slice(-100);
    }

    this.saveState();
    console.log(`🔄 Rotating to proxy: ${this.maskProxy(proxy)}`);
    return proxy;
  }

  markBlocked(proxy, reason = 'unknown') {
    if (proxy && !this.state.blockedProxies.includes(proxy)) {
      this.state.blockedProxies.push(proxy);
      console.warn(`🚫 Proxy blocked: ${this.maskProxy(proxy)} (${reason})`);

      if (this.state.blockedProxies.length > 10) {
        this.state.blockedProxies = this.state.blockedProxies.slice(-10);
      }

      this.saveState();
    }
  }

  maskProxy(proxy) {
    if (!proxy) return 'DIRECT';
    const [, host] = proxy.match(/\/\/(.*?)(?::|$)/) || [];
    if (!host) return proxy;
    const parts = host.split('.');
    return `${parts[0]}.***.${parts[parts.length - 1]}`;
  }

  randomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  getRequestHeaders() {
    return {
      'User-Agent': this.randomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    };
  }
}

async function main() {
  try {
    const rotator = new ProxyRotator();
    await rotator.fetchFreeProxyPool();

    const proxy = rotator.getNextProxy();
    const headers = rotator.getRequestHeaders();

    // Export for use in next steps
    console.log('::set-output name=proxy_used::' + (proxy || 'DIRECT'));
    console.log('::set-output name=proxy_url::' + (proxy || ''));
    console.log('::set-output name=rotation_count::' + rotator.state.rotationCount);
    console.log('::set-output name=blocked_count::' + rotator.state.blockedProxies.length);

    // Save headers for scraper to use
    fs.writeFileSync(
      path.join(__dirname, '../.github/workflows/request-headers.json'),
      JSON.stringify(headers, null, 2)
    );

    console.log('✅ Proxy rotation complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Proxy rotation failed:', err);
    process.exit(1);
  }
}

main();
