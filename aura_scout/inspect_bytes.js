// Ultra-simple tunnel byte inspector
// Just fetches the first few bytes and prints what they are
const http = require('http');

console.log('Fetching stream from Scout...');
const req = http.get('http://127.0.0.1:3031/api/stream/EFEl_inEn5w', { timeout: 30000 }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log(`Content-Length: ${res.headers['content-length'] || 'unknown'}`);
    
    let totalBytes = 0;
    const firstChunks = [];
    
    res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (firstChunks.length < 3) firstChunks.push(chunk);
        
        if (totalBytes > 256) {
            const all = Buffer.concat(firstChunks);
            const hex = all.slice(0, 32).toString('hex');
            const ascii = all.slice(0, 128).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
            
            console.log(`\nGot ${totalBytes} bytes so far`);
            console.log(`First 32 bytes (hex): ${hex}`);
            console.log(`First 128 bytes (ascii): ${ascii}`);
            
            // Check for MP4 signature (ftyp)
            if (hex.includes('66747970')) console.log('\n✅ MP4 SIGNATURE DETECTED (ftyp)');
            // Check for HTML
            else if (ascii.toLowerCase().includes('<html') || ascii.toLowerCase().includes('<!doc'))
                console.log('\n❌ HTML RESPONSE - NOT VIDEO DATA');
            // Check for JSON error
            else if (ascii.includes('{') && ascii.includes('error'))
                console.log('\n❌ JSON ERROR RESPONSE');
            else console.log('\n⚠️ UNKNOWN FORMAT');
            
            req.destroy();
            process.exit(0);
        }
    });
    
    res.on('end', () => {
        console.log(`Stream ended after ${totalBytes} bytes`);
        if (totalBytes === 0) console.log('❌ EMPTY RESPONSE');
        process.exit(0);
    });
});

req.on('error', (e) => { console.error('Request error:', e.message); process.exit(1); });
req.on('timeout', () => { console.error('TIMEOUT - tunnel too slow'); req.destroy(); process.exit(1); });
