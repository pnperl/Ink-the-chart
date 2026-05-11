const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const UserAgent = require('user-agents');
const fs = require('fs');

// --- 1. PROXY ROTATION & SETUP ---
const getProxies = async () => {
    if (process.env.PROXY_LIST) return process.env.PROXY_LIST.split(',');
    
    // Auto-fallback: Fetch free proxies if none provided in secrets
    try {
        const res = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all');
        return res.data.split('\r\n').filter(p => p);
    } catch (e) {
        console.log("Failed to fetch free proxies, running directly.");
        return [];
    }
};

const getRandomAgent = (proxies) => {
    const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
    const httpsAgent = proxy ? new HttpsProxyAgent(`http://${proxy}`) : undefined;
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
    return { httpsAgent, userAgent, proxy };
};

// --- 2. CHARTINK SCRAPING ---
const scrapeChartink = async (scannerUrl, proxies) => {
    let retries = 3;
    
    while (retries > 0) {
        const { httpsAgent, userAgent, proxy } = getRandomAgent(proxies);
        try {
            // Step 1: Get CSRF token (Chartink requires this for POST requests)
            const client = axios.create({ httpsAgent, headers: { 'User-Agent': userAgent } });
            const pageRes = await client.get(scannerUrl);
            const $ = cheerio.load(pageRes.data);
            const csrfToken = $('meta[name="csrf-token"]').attr('content');
            const scanClause = $('#scan_clause').text().trim(); // Extracts the hidden query

            if (!csrfToken || !scanClause) throw new Error("Could not extract token/clause");

            // Step 2: Post to processor
            const formData = new URLSearchParams();
            formData.append('scan_clause', scanClause);
            
            const resultsRes = await client.post('https://chartink.com/screener/process', formData.toString(), {
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return resultsRes.data.data; // Returns array of matched stocks
        } catch (error) {
            console.log(`Failed with proxy ${proxy || 'direct'}. Retrying... (${retries} left)`);
            retries--;
            await new Promise(r => setTimeout(r, 2000)); // 2s Backoff
        }
    }
    return null;
};

// --- 4. TELEGRAM ALERT ---
const sendTelegramAlert = async (message) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log("Telegram alert sent!");
    } catch (error) {
        console.error("Telegram send failed:", error.message);
    }
};

// --- 3. RESULT PROCESSING & MAIN EXECUTION ---
// --- 3. RESULT PROCESSING & MAIN EXECUTION ---
const main = async () => {
    const scanners = JSON.parse(fs.readFileSync('scanners-config.json', 'utf8'));
    const proxies = await getProxies();
    
    // --- STARTUP NOTIFICATION LOGIC ---
    const now = new Date();
    const startTimeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Create a Date object forced to IST to easily extract hours/minutes
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    
    // Check if it's the 9:15 AM run (allowing a window until 9:19 AM for GitHub delays)
    const isFirstRunOfDay = (hours === 9 && minutes >= 15 && minutes < 20);
    
    // Check if you clicked the "Run Workflow" button manually
    const isManualRun = process.env.GITHUB_TRIGGER_EVENT === 'workflow_dispatch';

    // Only send the "Started" message if one of the conditions is met
    if (isFirstRunOfDay || isManualRun) {
        const reason = isManualRun ? "Manual Run" : "Market Open First Run";
        await sendTelegramAlert(`🚀 *Scanner Bot Started* (${reason})\n⏱️ Time: ${startTimeStr}\n🔍 Checking ${scanners.length} scanners...`);
    }
    // ----------------------------------

    let alertMessage = `🤖 *ChartLink Update Results*\n\n`;
    let foundResults = false;

    for (const scanner of scanners) {
        console.log(`Scanning: ${scanner.name}...`);
        const stocks = await scrapeChartink(scanner.url, proxies);
        
        if (stocks && stocks.length > 0) {
            foundResults = true;
            alertMessage += `📊 *${scanner.name}* (${stocks.length})\n`;
            
            const tickers = stocks.slice(0, 5).map(s => `• ${s.nsecode}`).join('\n');
            alertMessage += `${tickers}\n${stocks.length > 5 ? `_+ ${stocks.length - 5} more..._\n` : ''}\n`;
        }
    }

    if (foundResults) {
        await sendTelegramAlert(alertMessage);
    } else {
        console.log("No stocks matched the criteria or scraping failed.");
    }
};

main();
