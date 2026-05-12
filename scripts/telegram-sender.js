#!/usr/bin/env node

/**
 * Telegram Sender - Sends formatted alerts to Telegram
 * Features:
 * - Message batching and formatting
 * - Retry with exponential backoff
 * - Message splitting for long content
 * - Delivery confirmation
 */

const fs = require('fs');
const path = require('path');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    '❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables'
  );
  process.exit(1);
}

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

class TelegramSender {
  constructor() {
    this.chatId = TELEGRAM_CHAT_ID;
    this.maxRetries = 3;
    this.sentMessages = [];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  splitMessage(text, maxLength = 4096) {
    if (text.length <= maxLength) {
      return [text];
    }

    const parts = [];
    let current = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if ((current + line + '\n').length > maxLength) {
        if (current) parts.push(current.trim());
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }

    if (current) parts.push(current.trim());
    return parts;
  }

  async sendMessage(text, attempt = 0) {
    try {
      const parts = this.splitMessage(text);
      console.log(
        `📤 Sending ${parts.length} message part(s) to Telegram... (attempt ${attempt + 1})`
      );

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: part,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Telegram API error: ${data.description || data.error_code}`
          );
        }

        if (data.ok && data.result) {
          this.sentMessages.push({
            messageId: data.result.message_id,
            part: i + 1,
            totalParts: parts.length,
            timestamp: new Date().toISOString(),
          });

          console.log(
            `✅ Message ${i + 1}/${parts.length} sent (ID: ${data.result.message_id})`
          );

          // Rate limiting between parts
          if (i < parts.length - 1) {
            await this.sleep(500);
          }
        }
      }

      return true;
    } catch (err) {
      console.error(`❌ Send failed (attempt ${attempt + 1}):`, err.message);

      if (attempt < this.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 2000;
        console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await this.sleep(backoffMs);
        return this.sendMessage(text, attempt + 1);
      }

      throw err;
    }
  }

  async sendAlert() {
    try {
      // Load alert message from file (written by processor)
      const messageFile = path.join(
        __dirname,
        '../.github/workflows/alert-message.txt'
      );

      let message;
      if (fs.existsSync(messageFile)) {
        message = fs.readFileSync(messageFile, 'utf8');
      } else {
        // Fallback to env var
        message = process.env.ALERT_MESSAGE;

        if (!message) {
          console.log('ℹ️  No alert message to send.');
          return false;
        }
      }

      const sent = await this.sendMessage(message);
      return sent;
    } catch (err) {
      console.error('❌ Failed to send alert:', err.message);
      throw err;
    }
  }

  async testConnection() {
    try {
      console.log('🔍 Testing Telegram connection...');

      const response = await fetch(`${TELEGRAM_API_BASE}/getMe`);
      const data = await response.json();

      if (data.ok) {
        console.log(`✅ Connected as @${data.result.username}`);
        return true;
      } else {
        throw new Error('Invalid bot token');
      }
    } catch (err) {
      console.error('❌ Telegram connection test failed:', err.message);
      throw err;
    }
  }

  exportOutputs() {
    console.log(
      '::set-output name=sent::' + (this.sentMessages.length > 0 ? 'true' : 'false')
    );
    console.log('::set-output name=message_count::' + this.sentMessages.length);

    if (this.sentMessages.length > 0) {
      console.log(
        '::set-output name=last_message_id::' +
          this.sentMessages[this.sentMessages.length - 1].messageId
      );
    }
  }

  saveLogs() {
    fs.writeFileSync(
      path.join(__dirname, '../.github/workflows/telegram-logs.json'),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          sentMessages: this.sentMessages,
          totalMessages: this.sentMessages.length,
        },
        null,
        2
      )
    );
  }
}

async function main() {
  try {
    const sender = new TelegramSender();

    // Test connection
    await sender.testConnection();

    // Send alert
    const sent = await sender.sendAlert();

    sender.exportOutputs();
    sender.saveLogs();

    if (sent) {
      console.log('\n✅ Telegram alert delivery complete');
      process.exit(0);
    } else {
      console.log('\nℹ️  No alerts to send');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
