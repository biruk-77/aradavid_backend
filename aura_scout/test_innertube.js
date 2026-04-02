// Quick test: does youtubei.js get us a stream URL?
const { Innertube } = require('youtubei.js');

(async () => {
    try {
        console.log('Creating InnerTube client...');
        const yt = await Innertube.create();
        
        console.log('Getting video info...');
        const info = await yt.getBasicInfo('EFEl_inEn5w');
        
        console.log('Title:', info.basic_info.title);
        console.log('Duration:', info.basic_info.duration, 'seconds');
        
        // Get streaming data
        const formats = info.streaming_data?.formats || [];
        const adaptive = info.streaming_data?.adaptive_formats || [];
        
        console.log(`\nFormats: ${formats.length}, Adaptive: ${adaptive.length}`);
        
        // Show all available formats
        for (const f of [...formats, ...adaptive].slice(0, 10)) {
            console.log(`  - ${f.quality_label || 'audio'} | ${f.mime_type} | ${f.url ? 'HAS URL' : 'CIPHER'}`);
        }
        
        // Try to get a direct URL
        const best = formats.find(f => f.url) || adaptive.find(f => f.url && f.mime_type?.includes('video'));
        if (best) {
            console.log('\n✅ DIRECT URL FOUND:');
            console.log(best.url.substring(0, 100) + '...');
        } else {
            console.log('\n❌ No direct URLs found in any format.');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
