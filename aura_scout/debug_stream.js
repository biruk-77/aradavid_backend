const axios = require('axios');
const youtubedl = require('youtube-dl-exec');

async function testExtraction() {
    console.log("Extracting 720p URL...");
    let info = await youtubedl(`https://www.youtube.com/watch?v=MvsAesQ-4zA`, {
        dumpSingleJson: true,
        format: 'best[height<=720][ext=mp4]/best',
        noCheckCertificates: true
    });
    
    console.log("Extracted URL:", info.url ? "Found" : "Missing");
    
    // Simulate Chrome asking for the start of the video
    console.log("Simulating Chrome Range request (bytes=0-)...");
    try {
        const response = await axios.get(info.url, {
            responseType: 'stream',
            headers: { 'Range': 'bytes=0-1000' }
        });
        
        console.log("YouTube Response Status:", response.status);
        console.log("Content-Range Header:", response.headers['content-range']);
        console.log("Content-Type:", response.headers['content-type']);
        console.log("It works natively!");
        process.exit(0);
    } catch(e) {
        console.log("Axios failed:", e.message);
        // Try to dump error
        if(e.response) {
            console.log("Error status:", e.response.status);
            console.log("Error headers:", e.response.headers);
        }
    }
}

testExtraction();
