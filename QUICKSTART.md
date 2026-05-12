# Quick Start Guide - ChartLink Scanner Bot

## ⚡ 5-Minute Setup

### 1. Fork & Clone
```bash
git clone https://github.com/yourusername/chartink-scanner-bot.git
cd chartink-scanner-bot
```

### 2. Get Telegram Credentials
- Message **@BotFather** on Telegram → `/newbot` → copy token
- Message **@userinfobot** → copy Chat ID
- (For groups: use **@RawDataBot** instead)

### 3. Add GitHub Secrets
Go to **Settings → Secrets and variables → Actions**

Add these secrets:
```
TELEGRAM_BOT_TOKEN = "123456789:ABCdef..."
TELEGRAM_CHAT_ID = "-1001234567890"
PROXY_LIST = "http://proxy1.com:8080,http://proxy2.com:8080"  # optional
ALERT_THRESHOLD = "5"  # optional
```

### 4. Configure Scanners
Edit `scanners-config.json`:

```json
{
  "scanners": [
    {
      "id": "my_scanner",
      "name": "My ChartLink Scanner",
      "url": "https://chartink.com/screener/xxxxx",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 50 },
      "priority": "HIGH"
    }
  ]
}
```

**How to get scanner URL:**
1. Open ChartLink.com
2. Create/open scanner
3. Copy URL from address bar
4. Paste into config

### 5. Push to GitHub
```bash
git add .
git commit -m "Initial setup"
git push origin main
```

### 6. Enable Workflow
Go to **Actions** tab → enable workflow

✅ **Done!** Bot runs every 5 minutes during market hours.

---

## 🧪 Testing

### Test Telegram Connection
```bash
cd scripts
node telegram-sender.js
```

### Manual Trigger
Go to **Actions → ChartLink Scanner Alerts → Run workflow**

Or use CLI:
```bash
gh workflow run scanner-alerts.yml --ref main
```

### Dry Run (No Alert Sent)
```bash
gh workflow run scanner-alerts.yml --ref main -f dryRun=true
```

### Send Test Alert
```bash
gh workflow run scanner-alerts.yml --ref main -f testAlert=true
```

---

## 📊 Monitoring

### View Logs
1. Go to Actions tab
2. Click latest run
3. Click "scanner-alerts"
4. Expand each step to see logs

### Check Results Artifacts
After each run, artifacts stored for 7 days:
- `scanner-results.json` - fetched data
- `processing-stats.json` - analysis
- `telegram-logs.json` - delivery status
- `proxy-state.json` - IP rotation state

### View Proxy Status
```bash
cat .github/workflows/proxy-state.json | jq '.blockedProxies'
```

---

## 🔧 Customization

### Change Polling Frequency
Edit `.github/workflows/scanner-alerts.yml`:

```yaml
schedule:
  - cron: '*/10 * * * *'  # Every 10 minutes
```

**Cron syntax:**
- `*/5` = every 5 min
- `*/15` = every 15 min
- `0 9-16` = hourly 9 AM - 4 PM

### Add More Scanners
Edit `scanners-config.json`:

```json
{
  "scanners": [
    { /* existing scanner */ },
    {
      "id": "new_scanner",
      "name": "New Scanner",
      "url": "https://chartink.com/screener/yyyyy",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 2 },
      "priority": "MEDIUM"
    }
  ]
}
```

### Change Alert Conditions
Three types supported:

**Type 1: Count in Range**
```json
"alertOn": "count_change",
"threshold": { "min": 5, "max": 50 }
```

**Type 2: Increase by Minimum**
```json
"alertOn": "count_increase",
"threshold": { "minIncrease": 2 }
```

**Type 3: Exceed Threshold**
```json
"alertOn": "threshold_breach",
"threshold": { "value": 10 }
```

### Adjust Proxy Rotation
Edit `scanners-config.json`:

```json
"proxyRotation": {
  "enabled": true,
  "rotateOnRetry": true,
  "blockedThreshold": 3  # quarantine after 3 blocks
}
```

### Market Hours (India)
Automatically skips:
- Weekends (Saturday/Sunday)
- Before 9:30 AM IST
- After 4 PM IST
- Indian national holidays

To disable, remove time restrictions from workflow schedule.

---

## ⚙️ Local Development

### Install Dependencies
```bash
cd scripts
npm install
```

### Run Scraper Locally
```bash
node chartink-scraper.js
```

### Run Processor
```bash
node result-processor.js
```

### Run with Docker
```bash
# Build image
docker build -t chartink-scanner .

# Run container
docker run -e TELEGRAM_BOT_TOKEN="xxx" \
           -e TELEGRAM_CHAT_ID="yyy" \
           chartink-scanner
```

### Docker Compose (Full Stack)
```bash
# Create .env file
echo "TELEGRAM_BOT_TOKEN=123456789:ABCdef" > .env
echo "TELEGRAM_CHAT_ID=-1001234567890" >> .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f chartink-scanner

# Stop services
docker-compose down
```

---

## 🐛 Troubleshooting

### No Alerts Received

**Check 1: Telegram Credentials**
```bash
# Test bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Should return: {"ok":true,"result":{"id":123...,"is_bot":true}}
```

**Check 2: Verify Chat ID**
- Personal: should be numeric (no minus)
- Group: should start with `-100`
- Run workflow manually, check logs for chat ID confirmation

**Check 3: Bot Permissions**
- Make sure bot is member of chat/group
- Check group privacy settings
- Verify bot has send_message permission

### "Forbidden (403)" / "Rate Limited (429)"

**Fix 1: Add More Proxies**
```bash
# Edit secrets, add more proxy URLs
PROXY_LIST="http://p1.com:8080,http://p2.com:8080,http://p3.com:8080"
```

**Fix 2: Reduce Parallel Requests**
Edit `.github/workflows/scanner-alerts.yml`:
```yaml
env:
  PARALLEL_REQUESTS: 2
```

**Fix 3: Wait for IP Block to Lift**
Usually 30-60 minutes. Check logs:
```bash
cat .github/workflows/proxy-state.json | jq '.blockedProxies'
```

### Stock Count Not Parsing

ChartLink HTML may have changed. Check:

1. View scanner page HTML in browser (right-click → View Page Source)
2. Search for stock count (usually in `<meta>`, JSON-LD, or `data-stocks`)
3. Update parsing regex in `scripts/chartink-scraper.js`

Example:
```javascript
// Add new parsing strategy
const match = html.match(/Your new pattern here/);
```

### Scanner URL Not Working

1. Verify URL is correct: `https://chartink.com/screener/xxxxxx`
2. Try URL in browser (check if page loads)
3. Check firewall/proxy isn't blocking ChartLink
4. Verify ChartLink isn't rate-limiting (wait 10 min)

### Timeout Errors

**Symptom:** `ETIMEDOUT` or `ECONNRESET`

**Fix 1: Increase Timeout**
```bash
# In workflow
env:
  CHARTINK_TIMEOUT: 30000  # 30 seconds
```

**Fix 2: Better Network**
- GitHub Actions = good internet
- If self-hosted: check network stability

### Memory/CPU Issues

**Reduce Parallel Requests**
```yaml
env:
  PARALLEL_REQUESTS: 1
```

**Reduce Scanner Count**
Set `enabled: false` for unused scanners in config.

---

## 📈 Performance Tips

### Optimize for Speed
1. **Reduce Parallel**: 3 → 2 if getting timeouts
2. **Increase Batch Delay**: 2000ms → 3000ms if too many errors
3. **Higher Timeout**: 15000ms → 20000ms for slower network

### Optimize for Reliability
1. **Add Proxies**: Custom list > free pools
2. **Increase Retries**: MAX_RETRIES: 2 → 3
3. **Stagger Requests**: Longer delays between scanners

### Typical Execution Time
- Proxy rotation: ~2s
- Scraping (3 scanners): ~45s
- Processing: ~5s
- Telegram send: ~2s
- **Total: ~60 seconds** ✓ Well within 4-min timeout

---

## 🔐 Security

✅ **Best Practices Implemented:**
- Secrets in GitHub Actions (never in code)
- User-Agent rotation (prevent fingerprinting)
- Proxy IP masking in logs (hide real IPs)
- HTTPS-only Telegram API
- No credentials in git history

✅ **What To Do:**
- Keep `.env` files local
- Never commit secrets
- Rotate proxy list every 30 days
- Review logs for suspicious activity

---

## 📚 File Structure Reference

```
chartink-scanner-bot/
├── .github/workflows/
│   ├── scanner-alerts.yml              # Main workflow
│   ├── scanner-alerts-advanced.yml     # With market hours
│   ├── scanner-results.json            # Latest data
│   ├── processing-stats.json           # Analytics
│   ├── proxy-state.json                # Proxy status
│   ├── telegram-logs.json              # Delivery logs
│   └── alert-message.txt               # Current alert
│
├── scripts/
│   ├── proxy-rotator.js                # IP rotation engine
│   ├── chartink-scraper.js             # Fetcher & parser
│   ├── result-processor.js             # Alert logic
│   ├── telegram-sender.js              # Telegram API
│   ├── package.json
│   └── test.js
│
├── scanners-config.json                # User configuration
├── docker-compose.yml                  # Local dev setup
├── Dockerfile                          # Container image
├── setup-secrets.js                    # Secrets wizard
├── .gitignore
├── README.md                           # Full documentation
└── QUICKSTART.md                       # This file
```

---

## 💬 Getting Help

### Check Logs First
1. Go to Actions tab
2. Click your latest run
3. Click "scanner-alerts" job
4. Expand steps and check output

### Common Error Patterns
- `ECONNREFUSED` = Network issue, usually proxy
- `ETIMEDOUT` = Request took too long, increase timeout
- `SyntaxError` = Config file has invalid JSON (check commas)
- `403 Forbidden` = Proxy blocked or API rate limited

### Still Stuck?
1. Review README.md troubleshooting section
2. Check if ChartLink.com is down (go to site directly)
3. Verify secrets are correct
4. Test Telegram bot manually with curl

---

## 🚀 Production Deployment

### GitHub Actions (Recommended)
- ✅ Already configured
- ✅ Free tier includes 2000 min/month
- ✅ No server to maintain

### Self-Hosted Runner
For high-frequency runs (< 5 min):
```bash
# Register runner
./config.sh --url https://github.com/user/repo --token <token>

# Run it
./run.sh
```

### VPS/Cloud Server
```bash
# Deploy with Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

### Kubernetes
```bash
# Deploy ConfigMap
kubectl create configmap scanner-config --from-file=scanners-config.json

# Deploy secrets
kubectl create secret generic telegram-creds \
  --from-literal=TELEGRAM_BOT_TOKEN=xxx \
  --from-literal=TELEGRAM_CHAT_ID=yyy

# Apply manifest (coming soon)
```

---

**Last Updated:** January 2024  
**Node Version:** 18.x LTS  
**Support:** GitHub Issues
