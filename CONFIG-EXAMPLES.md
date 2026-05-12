# ChartLink Scanner Bot - Configuration Examples

## 1. Basic Setup (3 Scanners)

```json
{
  "version": "1.0",
  "scanners": [
    {
      "id": "nifty_bullish",
      "name": "Nifty 50 Bullish",
      "url": "https://chartink.com/screener/abc123",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 10, "max": 40 },
      "priority": "HIGH"
    },
    {
      "id": "midcap_momentum",
      "name": "Midcap Momentum",
      "url": "https://chartink.com/screener/def456",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 3 },
      "priority": "MEDIUM"
    },
    {
      "id": "smallcap_breakout",
      "name": "Smallcap Breakout",
      "url": "https://chartink.com/screener/ghi789",
      "enabled": false,
      "alertOn": "threshold_breach",
      "threshold": { "value": 15 },
      "priority": "LOW"
    }
  ],
  "scheduling": {
    "frequencyMinutes": 5,
    "timezone": "Asia/Kolkata"
  }
}
```

---

## 2. Iron Condor Trading Setup

Alert when options IV spike or range-bound scanners breach levels.

```json
{
  "scanners": [
    {
      "id": "nifty_iv_spike",
      "name": "Nifty IV Spike Alert",
      "url": "https://chartink.com/screener/nifty_iv_spike",
      "enabled": true,
      "alertOn": "threshold_breach",
      "threshold": { "value": 20 },
      "priority": "HIGH",
      "telegramAlert": true
    },
    {
      "id": "nifty_support_hold",
      "name": "Nifty Support (18500-18700)",
      "url": "https://chartink.com/screener/nifty_support",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 8, "max": 20 },
      "priority": "HIGH"
    },
    {
      "id": "banknifty_range",
      "name": "BankNifty Range (45000-46000)",
      "url": "https://chartink.com/screener/banknifty_range",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 15 },
      "priority": "MEDIUM"
    }
  ],
  "alerts": {
    "batching": { "enabled": true, "windowSeconds": 300 },
    "formatting": "telegram_markdown"
  }
}
```

---

## 3. Intraday Momentum Trading

Fast alerts for stock count changes indicating momentum shift.

```json
{
  "scanners": [
    {
      "id": "bullish_4hr",
      "name": "Bullish Setup (4H)",
      "url": "https://chartink.com/screener/bullish_4h",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 2 },
      "priority": "HIGH"
    },
    {
      "id": "bearish_4hr",
      "name": "Bearish Setup (4H)",
      "url": "https://chartink.com/screener/bearish_4h",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 2 },
      "priority": "HIGH"
    },
    {
      "id": "reversals",
      "name": "Potential Reversals",
      "url": "https://chartink.com/screener/reversals",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 3, "max": 25 },
      "priority": "HIGH"
    }
  ],
  "scheduling": {
    "frequencyMinutes": 5,
    "startHour": 9,
    "endHour": 15
  }
}
```

---

## 4. Swing Trading Setup

Longer observation windows, less frequent alerts.

```json
{
  "scanners": [
    {
      "id": "swing_setup_daily",
      "name": "Swing Setup (Daily)",
      "url": "https://chartink.com/screener/swing_daily",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 50 },
      "priority": "MEDIUM"
    },
    {
      "id": "breakout_3month",
      "name": "52W High Breakout",
      "url": "https://chartink.com/screener/breakout_52w",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 1 },
      "priority": "HIGH"
    },
    {
      "id": "strong_uptrend",
      "name": "Strong Uptrend Stocks",
      "url": "https://chartink.com/screener/strong_uptrend",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 10, "max": 80 },
      "priority": "MEDIUM"
    }
  ],
  "scheduling": {
    "frequencyMinutes": 30,  # Slower frequency
    "startHour": 9,
    "endHour": 16
  }
}
```

---

## 5. Multi-Sector Watchlist

Monitor different sectors with different alert thresholds.

```json
{
  "scanners": [
    {
      "id": "it_stocks",
      "name": "IT Sector - Strong Setup",
      "url": "https://chartink.com/screener/it_strong",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 3, "max": 10 },
      "priority": "MEDIUM"
    },
    {
      "id": "pharma_stocks",
      "name": "Pharma Sector - Bullish",
      "url": "https://chartink.com/screener/pharma_bullish",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 2, "max": 8 },
      "priority": "MEDIUM"
    },
    {
      "id": "bank_stocks",
      "name": "Banking Sector - Volume Up",
      "url": "https://chartink.com/screener/bank_volume",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 1 },
      "priority": "HIGH"
    },
    {
      "id": "auto_stocks",
      "name": "Auto Sector - Recovery",
      "url": "https://chartink.com/screener/auto_recovery",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 15 },
      "priority": "LOW"
    }
  ]
}
```

---

## 6. Alert Priority Matrix

Customize alerts by importance level.

```json
{
  "scanners": [
    {
      "id": "critical_alert",
      "name": "VIX Spike > 30",
      "url": "https://chartink.com/screener/vix_30",
      "enabled": true,
      "alertOn": "threshold_breach",
      "threshold": { "value": 1 },
      "priority": "HIGH",
      "telegramAlert": true,
      "description": "Market volatility extreme - urgent"
    },
    {
      "id": "high_priority",
      "name": "Gap Up Breakout",
      "url": "https://chartink.com/screener/gap_up",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 1 },
      "priority": "HIGH",
      "telegramAlert": true
    },
    {
      "id": "medium_priority",
      "name": "Support Holds",
      "url": "https://chartink.com/screener/support",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 30 },
      "priority": "MEDIUM",
      "telegramAlert": true
    },
    {
      "id": "low_priority",
      "name": "General Watch",
      "url": "https://chartink.com/screener/watch",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 20, "max": 100 },
      "priority": "LOW",
      "telegramAlert": false
    }
  ]
}
```

---

## 7. Weekend & Holiday Exclusion

Automatically skips non-trading days.

```json
{
  "scheduling": {
    "frequencyMinutes": 5,
    "startHour": 9,
    "endHour": 16,
    "timezone": "Asia/Kolkata",
    "excludeWeekends": true,
    "excludeHolidays": [
      "2024-01-26",  # Republic Day
      "2024-03-08",  # Maha Shivaratri
      "2024-03-25",  # Holi
      "2024-04-11",  # Eid ul-Fitr
      "2024-04-17",  # Ram Navami
      "2024-05-23",  # Buddha Purnima
      "2024-08-15",  # Independence Day
      "2024-09-16",  # Milad un-Nabi
      "2024-10-02",  # Gandhi Jayanti
      "2024-10-12",  # Dussehra
      "2024-11-01",  # Diwali
      "2024-11-15",  # Guru Nanak Jayanti
      "2024-12-25"   # Christmas
    ]
  }
}
```

---

## 8. Proxy Rotation Configuration

Fine-tune IP rotation behavior.

```json
{
  "proxyRotation": {
    "enabled": true,
    "rotateOnRetry": true,
    "blockedThreshold": 3,
    "blockDurationMinutes": 30,
    "maxBlockedProxies": 10,
    "fallbackToFreePool": true,
    "freePoolFetchInterval": 3600
  }
}
```

---

## 9. Alert Batching & Formatting

Control how alerts are grouped and formatted.

```json
{
  "alerts": {
    "batching": {
      "enabled": true,
      "windowSeconds": 300,
      "maxAlertsPerMessage": 5
    },
    "formatting": "telegram_markdown",
    "includeTimestamp": true,
    "includePreviousCount": true,
    "includePercentageChange": true,
    "sortBy": "priority",
    "timezone": "Asia/Kolkata"
  }
}
```

---

## 10. Telegram Group Broadcasting

Send alerts to multiple groups/channels.

```json
{
  "alerts": {
    "telegramTargets": [
      {
        "chatId": "-1001234567890",
        "name": "Trading Alerts",
        "enabled": true,
        "minPriority": "MEDIUM"
      },
      {
        "chatId": "-1009876543210",
        "name": "High Priority Alerts",
        "enabled": true,
        "minPriority": "HIGH"
      },
      {
        "chatId": "987654321",
        "name": "Personal DM",
        "enabled": true,
        "minPriority": "LOW"
      }
    ]
  }
}
```

---

## Alert Types Explained

### Type 1: Count Change (Range)
```json
"alertOn": "count_change",
"threshold": { "min": 5, "max": 50 }
```
**When:** Stock count enters and stays in range [5, 50]
**Use Case:** Monitor when scanner has "active" signal

### Type 2: Count Increase
```json
"alertOn": "count_increase",
"threshold": { "minIncrease": 3 }
```
**When:** Stock count jumps by ≥3 from previous scan
**Use Case:** Detect momentum shift or breakout

### Type 3: Threshold Breach
```json
"alertOn": "threshold_breach",
"threshold": { "value": 25 }
```
**When:** Stock count exceeds 25
**Use Case:** Alert when scanner becomes "overheated"

---

## Priority Levels

| Level | Emoji | Use Case |
|-------|-------|----------|
| HIGH | 🔴 | Critical signals, immediate action needed |
| MEDIUM | 🟡 | Important but not urgent |
| LOW | 🟢 | For reference, informational |

---

## Common Mistakes & Fixes

### ❌ All scanners with same threshold
```json
// Bad: Treats every scanner same
"min": 5, "max": 50  // Works for big scanner, misses small
```

### ✅ Custom thresholds per scanner
```json
// Good: Tailored to each scanner
{ "min": 3, "max": 10 }   // Small scanner
{ "min": 10, "max": 50 }  // Medium scanner
{ "min": 20, "max": 100 } // Large scanner
```

### ❌ Too frequent alerts
```json
"minIncrease": 1  // Alerts on every single stock addition
```

### ✅ Meaningful thresholds
```json
"minIncrease": 3  // Only alert on significant momentum
```

### ❌ No priority filtering
```json
// Sends all alerts regardless of importance
"telegramAlert": true
```

### ✅ Smart routing
```json
// High priority to urgent group
{
  "priority": "HIGH",
  "chatId": "-1001234567890"  // Trading alerts
}
// Low priority to personal DM
{
  "priority": "LOW",
  "chatId": "987654321"  // Personal
}
```

---

## Real-World Example: Day Trader Setup

```json
{
  "version": "1.0",
  "scanners": [
    {
      "id": "premarket_setup",
      "name": "Pre-market Setup (8:30-9:20 AM)",
      "url": "https://chartink.com/screener/premarket",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 3, "max": 20 },
      "priority": "HIGH"
    },
    {
      "id": "intraday_momentum",
      "name": "Intraday Momentum",
      "url": "https://chartink.com/screener/momentum_intra",
      "enabled": true,
      "alertOn": "count_increase",
      "threshold": { "minIncrease": 2 },
      "priority": "HIGH"
    },
    {
      "id": "pullback_buying",
      "name": "Pullback Buying Opportunity",
      "url": "https://chartink.com/screener/pullback",
      "enabled": true,
      "alertOn": "count_change",
      "threshold": { "min": 5, "max": 25 },
      "priority": "MEDIUM"
    }
  ],
  "scheduling": {
    "frequencyMinutes": 5,
    "startHour": 8,  # Pre-market
    "endHour": 15,   # Close
    "timezone": "Asia/Kolkata",
    "excludeWeekends": true
  },
  "alerts": {
    "batching": {
      "enabled": false  # No batching, instant alerts
    }
  },
  "proxyRotation": {
    "enabled": true,
    "rotateOnRetry": true
  }
}
```

---

## Testing Your Configuration

```bash
# Validate JSON syntax
node -e "console.log(JSON.stringify(require('./scanners-config.json'), null, 2))"

# Test scanner access
curl -A "Mozilla/5.0" https://chartink.com/screener/xxxxx

# Test Telegram
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
  -d chat_id=<CHAT_ID> \
  -d text="Test message"

# Run full test suite
node scripts/test.js
```

---

**Need Help?** Check README.md → Troubleshooting section
