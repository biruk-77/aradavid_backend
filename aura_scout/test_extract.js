const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testExtract(targetUrl) {
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let hit = null;
    page.on('response', async response => {
        const url = response.url();
        const isPlaceholder = url.includes('playback1.mp4') || url.includes('avatar') || url.includes('favicon') || url.includes('.js') || url.includes('.css');
        const isBitstream = url.includes('.m3u8') || 
                           url.includes('/video/tos/') ||
                           url.includes('-webapp-prime.tiktok.com') ||
                           url.includes('-webapp.tiktok.com') ||
                           url.includes('googlevideo.com/videoplayback') ||
                           (url.includes('tiktok') && url.includes('.mp4'));

        if (isBitstream && !isPlaceholder && !hit) {
            hit = url;
            console.log(`[HIT] ${url}`);
        }
    });

    console.log(`Navigating to ${targetUrl}`);
    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        for (let i = 0; i < 10; i++) {
            if (hit) break;
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch(e) {}
    await browser.close();
    console.log(`Final extracted: ${hit}`);
}

(async () => {
    await testExtract("https://www.tiktok.com/@soul_movie3/video/7595255275913760030");
    await testExtract("https://www.youtube.com/shorts/6KPfZRpxFd0");
})();
