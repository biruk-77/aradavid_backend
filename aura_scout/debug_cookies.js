const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D', { waitUntil: 'networkidle2' });
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log('COOKIE_STRING_LENGTH:', cookieString.length);
    console.log('COOKIE_SAMPLE:', cookieString.substring(0, 100));
    await browser.close();
})();
