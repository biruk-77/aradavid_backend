const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const videoId = 'MvsAesQ-4zA';
const filePath = path.join(__dirname, `test_${videoId}.mp4`);

async function test() {
    // Delete old test file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    console.log(`\n--- TESTING FORMAT 18 (pre-merged 360p, no FFmpeg needed) ---`);
    try {
        await youtubedl(`https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D`, {
            format: '18',  // The ONLY pre-merged video+audio format available
            output: filePath,
            noCheckCertificates: true,
        });
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            console.log(`SUCCESS! File size: ${(fs.statSync(filePath).size / 1048576).toFixed(2)} MB`);
        } else {
            console.log(`FAIL: File created but is 0 bytes (likely needs FFmpeg for merging).`);
        }
    } catch (e) {
        console.error(`FAIL:`, e.message);
    }
}

test();
