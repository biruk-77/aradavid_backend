const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const youtubedl = require('youtube-dl-exec');
const axios = require('axios');

const app = express();
const PORT = 3031;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache for extracted URLs so we don't run yt-dlp on every Range request
const streamUrlCache = {};

const YOUTUBE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_SEGMENTS = 8;

/**
 * 🔱 THE CORE SENSOR: Determine total file size for segmentation using a tiny GET
 */
async function fetchContentLength(url) {
    try {
        // HEAD is often blocked, so we use a GET for the first byte
        const resp = await axios.get(url, {
            headers: { 
                'User-Agent': YOUTUBE_USER_AGENT,
                'Range': 'bytes=0-0'
            }
        });
        if (resp.headers['content-range']) {
            const parts = resp.headers['content-range'].split('/');
            if (parts.length > 1) return parseInt(parts[1]);
        }
        return parseInt(resp.headers['content-length'] || 0);
    } catch (e) {
        console.error(`[SCENSOR] Length probe failed: ${e.message}`);
        return 0;
    }
}


/**
 * 🔱 THE TURBO-SEGMENT PIPE: Divide-and-conquer byte streams
 */
async function TurboStreamPipe(videoId, quality, req, res, segments = DEFAULT_SEGMENTS) {
    try {
        const rawUrl = await extractStreamUrl(videoId, quality);
        if (!rawUrl) return res.status(502).send('Extraction failed');

        const rangeHeader = req.headers.range;
        const totalSize = await fetchContentLength(rawUrl);

        let start = 0;
        let end = totalSize > 0 ? totalSize - 1 : 0;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : (totalSize > 0 ? totalSize - 1 : start + 1024 * 1024);
        }

        const contentLength = end - start + 1;
        
        // If file is tiny or range is small, don't over-complicate with segments
        if (contentLength < 1024 * 512 || totalSize === 0) {
            return await serveProxyStream(videoId, quality, req, res);
        }

        const chunkSize = Math.ceil(contentLength / segments);


        console.log(`[TURBO] Ingesting ${videoId} via ${segments} parallel segments. Range: ${start}-${end}`);

        // Set response headers
        res.status(rangeHeader ? 206 : 200);
        res.setHeader('Content-Type', quality === 'audio' ? 'audio/x-m4a' : 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        
        if (rangeHeader && totalSize > 0) {
            res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        }
        
        if (totalSize > 0) {
            res.setHeader('Content-Length', contentLength);
        }


        // Parallel Ingestion
        const segmentPromises = [];
        for (let i = 0; i < segments; i++) {
            const segStart = start + (i * chunkSize);
            let segEnd = segStart + chunkSize - 1;
            if (segEnd > end) segEnd = end;

            if (segStart > end) break;

            segmentPromises.push(
                axios.get(rawUrl, {
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': YOUTUBE_USER_AGENT,
                        'Range': `bytes=${segStart}-${segEnd}`,
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    }
                })
            );
        }

        // Trigger Blitzkrieg
        const results = await Promise.all(segmentPromises);
        
        // Sequentially Pipe the Memory Buffers
        for (const segmentResp of results) {
            res.write(Buffer.from(segmentResp.data));
        }
        res.end();

    } catch (err) {
        if (err.message.includes('Premature close')) return;
        console.error(`[TURBO] Error: ${err.message}`);
        if (!res.headersSent) res.status(502).send(err.message);
    }
}




// ─── YT-DLP EXTRACTOR (DISK-LESS STREAMING ARCHITECTURE) ───
async function extractStreamUrl(videoId, quality = '720') {
    const cacheKey = `${videoId}_${quality}`;
    if (streamUrlCache[cacheKey]) {
        console.log(`[SCOUT] URL cache hit for ${cacheKey}`);
        return streamUrlCache[cacheKey];
    }

    console.log(`[SCOUT] Extracting raw proxy stream URL for ${videoId} at quality: ${quality}...`);

    let formatOption = 'best[ext=mp4]/best'; // Default 720p premerged
    if (quality === '360') formatOption = '18';
    if (quality === 'audio') formatOption = 'bestaudio[ext=m4a]/bestaudio';

    try {
        let info;
        try {
            info = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
                dumpSingleJson: true,
                format: formatOption,
                userAgent: YOUTUBE_USER_AGENT,
                jsRuntimes: 'node',
                noCheckCertificates: true
            });
        } catch (stage1Error) {
             console.warn(`[SCOUT] Primary extraction failed: ${stage1Error.message}. Falling back...`);
             info = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
                dumpSingleJson: true,
                format: 'best[ext=mp4]/best',
                userAgent: YOUTUBE_USER_AGENT,
                jsRuntimes: 'node',
                noCheckCertificates: true
            });
        }

        if (info && info.url) {
            console.log(`[SCOUT] Extracted raw CDN URL for ${videoId} (${quality})`);
            streamUrlCache[cacheKey] = info.url; // Cache it
            return info.url;
        } else {
            throw new Error("yt-dlp succeeded but returned no explicit URL");
        }

    } catch (e) {
        console.error(`[SCOUT] Extraction Failed:`, e.message);
        return null;
    }
}

// ─── STREAM ENDPOINT (Handles UI's "OBSERVE" button natively) ───
app.get('/api/stream', async (req, res) => {
    const url = req.query.url;
    const quality = req.query.quality || '720';
    if (!url) return res.status(400).send('URL required');
    let videoId = null;
    try {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
    } catch(e) { return res.status(400).send('Invalid URL'); }

    console.log(`[SCOUT] UI Stream requested for: ${videoId} (${quality})`);
    await serveProxyStream(videoId, quality, req, res);
});

// ─── PROXY STREAM ENDPOINT (PIPES BYTES DIRECTLY FROM YOUTUBE TO THE ENGINE) ───
app.get('/api/proxy/:videoId', async (req, res) => {
    const quality = req.query.quality || '720';
    await TurboStreamPipe(req.params.videoId, quality, req, res);
});

async function serveProxyStream(videoId, quality, req, res) {
    try {
        const rawUrl = await extractStreamUrl(videoId, quality);
        if (!rawUrl) return res.status(502).send('Extraction failed or video blocked by YouTube');

        const range = req.headers.range;
        const config = { 
            responseType: 'stream', 
            headers: {
                'User-Agent': YOUTUBE_USER_AGENT,
                'Accept': '*/*, video/mp4, audio/mp4',
                'Connection': 'keep-alive'
            } 
        };
        if (range) config.headers['Range'] = range;

        const response = await axios.get(rawUrl, config);

        // Map YouTube's native response headers back
        // If the browser asked for Range, and we got a 206 Partial Content, return 206 so video plays.
        // If we got 200 OK from YT but browser asked for Range, we should still use 206 or 200 properly.
        const isPartial = response.status === 206 || range;
        res.status(isPartial ? 206 : 200);
        
        if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
        if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Accept-Ranges', 'bytes');

        // If browser kills connection (e.g. seeking or pausing), kill upstream Axios request
        req.on('close', () => {
             response.data.destroy();
        });

        // Pipe directly to response
        response.data.pipe(res).on('error', (err) => {
             console.error(`[PROXY] internal pipe dest error: ${err.message}`);
        });

    } catch (err) {
        if (err.message.includes('Premature close')) return; // Ignore expected browser aborts
        console.error(`[PROXY] Pipe error: ${err.message}`);
        if (!res.headersSent) res.status(502).send(err.message);
    }
}


// ─── DOWNLOAD ENDPOINT (For explicit desktop downloads instead of streaming) ───
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    const quality = req.query.quality || '720';
    if (!url) return res.status(400).send('URL required');
    
    let videoId = null;
    try {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
    } catch(e) { return res.status(400).send('Invalid URL'); }

    console.log(`[TURBO DL] Multi-part download requested: ${videoId}`);
    
    // Serve as attachment with correct filename
    const ext = quality === 'audio' ? 'm4a' : 'mp4';
    res.setHeader('Content-Disposition', `attachment; filename="Target_${videoId}.${ext}"`);
    
    // For downloads, we use 16 segments for maximum saturation
    await TurboStreamPipe(videoId, quality, req, res, 16);
});

// ─── HUNT API (Proxy Registration) ───
app.post('/api/hunt/url', async (req, res) => {
    let { url, tile } = req.body;
    if (tile === undefined || tile === null) tile = 0; // Default to Tile 0
    let videoId = null;
    try {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
    } catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }

    console.log(`[SCOUT] Hunt: ${videoId} → Tile ${tile}`);

    // Pre-extract the URL to verify the stream is online before telling God Mosaic
    console.log(`[SCOUT] Verifying stream availability...`);
    const quality = req.body.quality || '720';
    const verifiedUrl = await extractStreamUrl(videoId, quality);
    if (!verifiedUrl) return res.status(502).json({ error: 'Extraction failed. Video may be private or blocked.' });

    // The stream URL we give the Engine is OUR local Proxy. This solves cross-origin and ensures FFmpeg plays local HTTP.
    const engineStreamUrl = `http://127.0.0.1:${PORT}/api/proxy/${videoId}?quality=${quality}`;
    console.log(`[SCOUT] Ready! Proxy Stream URL is: ${engineStreamUrl}`);
    
    // Register the job with the Command Plane (aura_general) on Port 8080
    const postData = JSON.stringify({ url: engineStreamUrl, tile: tile });
    const options = { hostname: '127.0.0.1', port: 8080, path: '/jobs', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };

    const postReq = http.request(options, (postRes) => {
        let body = '';
        postRes.on('data', (d) => body += d);
        postRes.on('end', () => {
            let jobData = {};
            try { jobData = JSON.parse(body); } catch(e) {}
            console.log(`[SCOUT] Job registered via Proxy Stream.`);
            res.json({ success: true, streamUrl: engineStreamUrl, job: jobData });
        });
    });
    postReq.on('error', (e) => res.status(502).json({ error: 'Command Plane offline' }));
    postReq.write(postData);
    postReq.end();
});

// Start the server
app.listen(PORT, '0.0.0.0', () => console.log(`[SCOUT] Proxy Stream Engine Online: http://127.0.0.1:${PORT}`));
