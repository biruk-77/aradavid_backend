const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();

const PORT = 3032;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/test-download', (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Run youtube-dl-exec binary directly via npx or path so we can pipe stdout/stderr
    const command = `npx yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-check-certificates "${url}"`;
    
    // We don't download it (or we do and pipe output to dev null)
    // Actually the user wants to test download and see errors, so we download into a temp file
    const tempFile = path.join(__dirname, 'test_output.mp4');
    
    const ytDlp = exec(`npx yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-check-certificates -o "${tempFile}" "${url}"`);

    ytDlp.stdout.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ type: 'info', text: data })}\n\n`);
    });

    ytDlp.stderr.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ type: 'error', text: data })}\n\n`);
    });

    ytDlp.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'done', text: `Process exited with code ${code}` })}\n\n`);
        res.end();
    });
});

app.listen(PORT, () => {
    console.log(`[AURA DL DEBUG] Diagnostic Downloader active on port ${PORT}`);
});
