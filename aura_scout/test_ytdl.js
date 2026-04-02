const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

const url = 'https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D';
console.log('Testing ytdl-core for:', url);

ytdl(url, { filter: 'audioandvideo', quality: 'highest' })
  .on('info', (info) => console.log('Title:', info.videoDetails.title))
  .on('error', (err) => {
    console.error('YTDL ERROR:', err.message);
    process.exit(1);
  })
  .pipe(fs.createWriteStream('test_video.mp4'))
  .on('finish', () => {
    console.log('Download finished successfully.');
    process.exit(0);
  });

setTimeout(() => {
  console.log('Timeout. Checking file size...');
  const stats = fs.statSync('test_video.mp4');
  console.log('File size:', stats.size);
  process.exit(0);
}, 10000);
