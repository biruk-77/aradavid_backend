const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

const url = 'https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D';

// These are placeholders - in the real app, we'll get these from Puppeteer's page.cookies()
const mockCookies = [
  { name: "VISITOR_INFO1_LIVE", value: "-5nq1Z_5dAs", domain: ".youtube.com" },
  { name: "GPS", value: "1", domain: ".youtube.com" },
  { name: "YSC", value: "oE95jrfci2Y", domain: ".youtube.com" }
];

console.log('Testing ytdl-core with createAgent for:', url);

try {
  // Create the agent as per README documentation
  const agent = ytdl.createAgent(mockCookies);

  ytdl(url, {
    filter: 'videoonly',
    quality: 'highestvideo',
    agent
  })
    .on('info', (info) => console.log('Title:', info.videoDetails.title))
    .on('error', (err) => {
      console.error('YTDL ERROR:', err.message);
      process.exit(1);
    })
    .pipe(fs.createWriteStream('test_video_agent.mp4'))
    .on('finish', () => {
      console.log('Download finished successfully.');
      process.exit(0);
    });

  setTimeout(() => {
    console.log('Timeout. Checking file size...');
    const stats = fs.statSync('test_video_agent.mp4');
    console.log('File size:', stats.size);
    process.exit(0);
  }, 10000);
} catch (e) {
  console.error('AGENT CREATION FAILED:', e.message);
  process.exit(1);
}
