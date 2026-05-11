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

// --- 2. CHARTINK SCRAPING (Direct 
const { gotScraping } = require('got-scraping');

// --- 2. CHARTINK SCRAPING (Stealth Mode) ---
const scrapeChartink = async (scannerUrl) => {
    let attempt = 0;
    const maxAttempts = 3; 
    
    while (attempt < maxAttempts) {
        try {
            console.log(`Attempt ${attempt + 1}: Fetching via stealth browser fingerprint...`);
            
            // Step 1: Fetch Page & CSRF Token using gotScraping
            // This mimics Google Chrome's exact TLS signature
            const pageRes = await gotScraping({
                url: scannerUrl,
                method: 'GET',
                headerGeneratorOptions: {
                    browsers: [{name: 'chrome', minVersion: 110}],
                    devices: ['desktop', 'mobile'],
                    operatingSystems: ['windows', 'android']
                }
            });

            const $ = cheerio.load(pageRes.body);
            const csrfToken = $('meta[name="csrf-token"]').attr('content');
            const scanClause = $('#scan_clause').text().trim();

            if (!csrfToken || !scanClause) {
                console.log("Blocked: Could not extract CSRF token. Cloudflare challenge active.");
                throw new Error("Missing Token");
            }

            // Step 2: Post to processor
            const resultsRes = await gotScraping({
                url: 'https://chartink.com/screener/process',
                method: 'POST',
                form: {
                    scan_clause: scanClause
                },
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://chartink.com',
                    'Referer': scannerUrl
                },
                headerGeneratorOptions: {
                    browsers: [{name: 'chrome', minVersion: 110}]
                }
            });

            // gotScraping returns the body as a string, parse it to JSON
            const data = JSON.parse(resultsRes.body);
            return data.data; 
            
        } catch (error) {
            attempt++;
            if (attempt < maxAttempts) {
                console.log(`Failed. Retrying in 2 seconds...`);
                await new Promise(r => setTimeout(r, 2000)); 
            } else {
                console.log(`All ${maxAttempts} attempts failed. Cloudflare is blocking the request.`);
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
