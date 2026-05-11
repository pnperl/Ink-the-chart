const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const UserAgent = require('user-agents');
const fs = require('fs');

// --- 1. PROXY ROTATION & SETUP ---
const getProxies = async () => {
    if (process.env.PROXY_LIST) return process.env.PROXY_LIST.split(',');
    
    try {
        const res = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all');
        return res.data.split('\r\n').filter(p => p);
    } catch (e) {
        console.log("Failed to fetch free proxies, running directly.");
        return [];
    }
};

// --- 2. CHARTINK SCRAPING (Direct First, then Sequential Proxy Fallback) ---
const scrapeChartink = async (scannerUrl, proxies) => {
    let attempt = 0;
    // We try 1 Direct connection + up to 2 proxies (Total 3 attempts max)
    const maxAttempts = Math.min(3, proxies.length + 1); 
    
    while (attempt < maxAttempts) {
        // ATTEMPT 0: Direct Connection (null)
        // ATTEMPT 1+: Proxy Connection (proxies[0], proxies[1], etc.)
        const proxy = attempt === 0 ? null : (proxies.length >= attempt ? proxies[attempt - 1] : null);
        
        // Setup agents
        const httpsAgent = proxy ? new HttpsProxyAgent(`http://${proxy}`) : undefined;
        const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
        
        try {
            const client = axios.create({ httpsAgent, headers: { 'User-Agent': userAgent } });
            
            // Step 1: Fetch Page & CSRF Token
            const pageRes = await client.get(scannerUrl);
            const $ = cheerio.load(pageRes.data);
            const csrfToken = $('meta[name="csrf-token"]').attr('content');
            const scanClause = $('#scan_clause').text().trim();

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

            return resultsRes.data.data; 
            
        } catch (error) {
            attempt++;
            if (attempt < maxAttempts) {
                const failedIp = attempt === 1 ? 'Direct IP' : proxy;
                console.log(`Failed with ${failedIp}. Switching to fallback proxy #${attempt}...`);
                await new Promise(r => setTimeout(r, 2000)); // 2-second wait before trying the next proxy
            } else {
                console.log(`All ${maxAttempts} attempts failed for this scanner.`);
            }
        }
    }
    return null;
};

// --- 3. TELEGRAM ALERT ---
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

// --- 4. RESULT PROCESSING & MAIN EXECUTION ---
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

    // Process scanners
    for (const scanner of scanners) {
        console.log(`Scanning: ${scanner.name}...`);
        const stocks = await scrapeChartink(scanner.url, proxies);
        
        if (stocks && stocks.length > 0) {
            foundResults = true;
            alertMessage += `📊 *${scanner.name}* (${stocks.length})\n`;
            
            // Get top 5 stock tickers
            const tickers = stocks.slice(0, 5).map(s => `• ${s.nsecode}`).join('\n');
            alertMessage += `${tickers}\n${stocks.length > 5 ? `_+ ${stocks.length - 5} more..._\n` : ''}\n`;
        }
    }

    // Send final results only if stocks matched
    if (foundResults) {
        await sendTelegramAlert(alertMessage);
    } else {
        console.log("No stocks matched the criteria or scraping failed.");
    }
};

main();
