const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const videoId = 'MvsAesQ-4zA';
const filePath = path.join(__dirname, 'test_video.mp4');

async function test() {
    console.log(`[TEST] Ingesting video: ${videoId}`);
    try {
        // Stage 1
        console.log(`[TEST] Stage 1 (MP4 Priority)...`);
        await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            output: filePath,
            noCheckCertificates: true,
            noWarnings: true
        });
        console.log(`[TEST] Stage 1 Success!`);
    } catch (e1) {
        console.warn(`[TEST] Stage 1 Failed: ${e1.message}`);
        try {
            // Stage 2
            console.log(`[TEST] Stage 2 (Fallback Best)...`);
            await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
                format: 'best',
                output: filePath,
                noCheckCertificates: true,
                noWarnings: true
            });
            console.log(`[TEST] Stage 2 Success!`);
        } catch (e2) {
            console.error(`[TEST] Stage 2 Failed: ${e2.message}`);
        }
    }

    if (fs.existsSync(filePath)) {
        console.log(`[TEST] File exists, size: ${fs.statSync(filePath).size} bytes`);
        // fs.unlinkSync(filePath);
    } else {
        console.log(`[TEST] File does NOT exist.`);
    }
}

test();
