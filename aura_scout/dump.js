const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('.mp4') || url.includes('.m3u8') || url.includes('video') || url.includes('media')) {
            console.log(`[NETWORK] ${url}`);
        }
    });

    console.log("Navigating...");
    try {
        await page.goto("https://www.tiktok.com/@soul_movie3/video/7595255275913760030", { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000));
    } catch(e) {}
    await browser.close();
})();
