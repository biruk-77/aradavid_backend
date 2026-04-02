const { URL, URLSearchParams } = require('url');
const fs = require('fs');

async function inspect() {
    const videoId = 'EFEl_inEn5w'; // Default stream
    try {
        console.log('Handshaking...');
        const keyRes = await fetch('https://cnv.cx/v2/sanity/key');
        const { key: apiKey } = await keyRes.json();

        const body = new URLSearchParams({ link: `https://youtu.be/${videoId}`, format: 'mp4', audioBitrate: '128', videoQuality: '720', filenameStyle: 'pretty', vCodec: 'h264' });
        const convRes = await fetch('https://cnv.cx/v2/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'key': apiKey },
            body: body.toString()
        });
        const { url: tunnelUrl } = await convRes.json();
        console.log('Tunnel URL:', tunnelUrl);

        console.log('Fetching first 1KB...');
        const streamRes = await fetch(tunnelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        console.log('Response Headers:', JSON.stringify([...streamRes.headers]));
        
        const reader = streamRes.body.getReader();
        const { value } = await reader.read();
        
        if (value) {
            const hex = Buffer.from(value.slice(0, 64)).toString('hex');
            console.log('First 64 bytes (hex):', hex);
            console.log('First 64 bytes (UTF-8):', Buffer.from(value.slice(0, 64)).toString('utf8'));
        }
    } catch (e) {
        console.error('Check failed:', e.message);
    }
}

inspect();
