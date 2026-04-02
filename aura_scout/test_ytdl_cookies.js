const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

const url = 'https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D';
const cookies = 'VISITOR_INFO1_LIVE=-5nq1Z_5dAs; GPS=1; YSC=oE95jrfci2Y; __Secure-ROLLOUT_TOKEN=CP6XpMiZlMiK6QEQ38'; // Sample from debug

console.log('Testing ytdl-core with Cookies for:', url);

ytdl(url, {
  filter: 'audioandvideo',
  quality: 'highest',
  requestOptions: {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }
})
  .on('info', (info) => console.log('Title:', info.videoDetails.title))
  .on('error', (err) => {
    console.error('YTDL ERROR:', err.message);
    process.exit(1);
  })
  .pipe(fs.createWriteStream('test_video_cookies.mp4'))
  .on('finish', () => {
    console.log('Download finished successfully.');
    process.exit(0);
  });

setTimeout(() => {
  console.log('Timeout. Checking file size...');
  const stats = fs.statSync('test_video_cookies.mp4');
  console.log('File size:', stats.size);
  process.exit(0);
}, 10000);
