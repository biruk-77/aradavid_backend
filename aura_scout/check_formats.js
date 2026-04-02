const youtubedl = require('youtube-dl-exec');
const videoId = 'MvsAesQ-4zA';

youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
    listFormats: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    addHeader: [
        'referer:https://www.youtube.com/',
        'user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ]
}).then(output => {
    console.log(output);
}).catch(err => {
    console.error(err);
});
