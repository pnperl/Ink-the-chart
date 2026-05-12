#!/usr/bin/env node

/**
 * GitHub Secrets Setup Helper
 * Guides user through setting up required secrets for the workflow
 */

const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function setupSecrets() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   ChartLink Scanner Bot - GitHub Secrets Setup Helper     ║
╚════════════════════════════════════════════════════════════╝
`);

  const secrets = {};

  // Telegram Bot Token
  console.log('\n📱 TELEGRAM_BOT_TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Get this from @BotFather on Telegram:');
  console.log('  1. Message @BotFather');
  console.log('  2. Send /newbot');
  console.log('  3. Follow prompts (name, username)');
  console.log('  4. Copy the token (starts with numbers, contains colon)');
  console.log('Example: 123456789:ABCdefGHIjklmnoPQRstuvWXYZ');
  const token = await question('\n➜ Paste your bot token: ');
  if (!token || !token.includes(':')) {
    console.error('❌ Invalid token format');
    process.exit(1);
  }
  secrets.TELEGRAM_BOT_TOKEN = token;

  // Telegram Chat ID
  console.log('\n\n💬 TELEGRAM_CHAT_ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Get this from @userinfobot on Telegram:');
  console.log('  1. Message @userinfobot');
  console.log('  2. Bot replies with your user info');
  console.log('  3. Copy "Id" (for personal chat)');
  console.log('  4. Or get from @RawDataBot in group (group IDs start with -)');
  console.log('Example: -1001234567890 (group) or 987654321 (personal)');
  const chatId = await question('\n➜ Paste your chat ID: ');
  if (!chatId || isNaN(chatId)) {
    console.error('❌ Invalid chat ID (must be numbers or -numbers)');
    process.exit(1);
  }
  secrets.TELEGRAM_CHAT_ID = chatId;

  // Proxy List (optional)
  console.log('\n\n🌐 PROXY_LIST (OPTIONAL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Add comma-separated proxy URLs to rotate IPs:');
  console.log('Format: http://proxy1.com:8080,http://proxy2.com:8080');
  console.log('Leave blank to use free proxy pools (built-in fallback)');
  const proxyList = await question('\n➜ Paste proxy list (or press Enter to skip): ');
  if (proxyList.trim()) {
    secrets.PROXY_LIST = proxyList;
  }

  // Alert Threshold (optional)
  console.log('\n\n⚠️  ALERT_THRESHOLD (OPTIONAL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Minimum stock count to trigger alerts (default: 5)');
  const threshold = await question('\n➜ Enter threshold (or press Enter for default 5): ');
  if (threshold.trim()) {
    secrets.ALERT_THRESHOLD = threshold;
  }

  rl.close();

  // Display summary
  console.log('\n\n✅ SETUP SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nSecrets to add to GitHub (Settings → Secrets and variables → Actions):');
  console.log('\n' + JSON.stringify(secrets, null, 2));

  console.log('\n\nℹ️  HOW TO ADD SECRETS TO GITHUB:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Go to your repo on GitHub');
  console.log('2. Settings → Secrets and variables → Actions');
  console.log('3. Click "New repository secret"');
  console.log('4. Add each secret name and value from above');
  console.log('5. Press "Add secret" for each');

  // Save to file for reference
  const configFile = 'secrets-template.json';
  fs.writeFileSync(configFile, JSON.stringify(secrets, null, 2));
  console.log(`\n📝 Secrets saved to ${configFile} (keep this file safe!)`);

  console.log('\n\n🚀 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Edit scanners-config.json with your ChartLink scanner URLs');
  console.log('2. Add secrets to GitHub');
  console.log('3. Commit and push to enable the workflow');
  console.log('4. Go to Actions tab and verify workflow runs');
  console.log('\n✨ Your bot will start running every 5 minutes!');
}

setupSecrets().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
