/* ═══════════════════════════════════════════════════════════════════
   AURA SCOUT — Mission Control Engine
   Premium Forensic & Streaming Interface
   ═══════════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ─── DOM References ───
    const video = document.getElementById('video-player');
    const mosaic = document.getElementById('mosaic-player');
    const engineTag = document.getElementById('engine-tag');
    const btnLive = document.getElementById('btn-live');
    const urlInput = document.getElementById('url-input');
    const btnStream = document.getElementById('btn-load-stream');
    const btnDownload = document.getElementById('btn-download');
    const btnDeploy = document.getElementById('btn-deploy');
    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnMute = document.getElementById('btn-mute');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const playBigBtn = document.getElementById('play-big-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const timeDisplayCurrent = document.querySelector('.time-current');
    const timeDisplayTotal = document.querySelector('.time-total');
    const timeOverlay = document.getElementById('player-time-overlay');
    const playerBadge = document.getElementById('player-badge');
    const volumeSlider = document.getElementById('volume-slider');
    const queueList = document.getElementById('queue-list');
    const queueCount = document.getElementById('queue-count');
    const downloadList = document.getElementById('download-list');
    const downloadCount = document.getElementById('download-count');
    const historyList = document.getElementById('history-list');
    const statStreams = document.getElementById('stat-streams');
    const statUptime = document.getElementById('stat-uptime');
    const statCpu = document.getElementById('stat-cpu');
    const statMemory = document.getElementById('stat-memory');
    const statLatency = document.getElementById('stat-latency');
    const hudStreamInfo = document.getElementById('hud-stream-info');
    const playerWrapper = document.getElementById('player-wrapper');
    const matrixGrid = document.getElementById('matrix-grid');
    const matrixControl = document.getElementById('matrix-control');
    const selectedTileLabel = document.getElementById('selected-tile-info');
    const btnAssign = document.getElementById('btn-assign');
    const toastContainer = document.getElementById('toast-container');

    // ─── State ───
    let downloads = [];
    let downloadCounter = 0;
    let startTime = Date.now();
    let currentUrl = '';
    let jobs = [];
    let historyEntries = [];
    let isLiveMode = false;
    let selectedTile = null;
    let matrixLayout = {}; // job_id -> tile_index
    let selectedJobId = null;

    // ═══════════════════════════════════════════════════════════════
    // VIDEO PLAYER & HUD
    // ═══════════════════════════════════════════════════════════════

    function toggleLiveMode() {
        isLiveMode = !isLiveMode;
        if (isLiveMode) {
            video.style.display = 'none';
            mosaic.style.display = 'block';
            engineTag.style.display = 'block';
            mosaic.src = '/api/mosaic';
            btnLive.classList.add('active');
            playerBadge.textContent = 'NEURAL LINK ACTIVE';
            hudStreamInfo.textContent = 'THE GOD MOSAIC — ALL CHANNELS';
            addHistory('Switched to MACHINE CORE LIVE', '#8b5cf6');
            matrixControl.style.display = 'block';
        } else {
            video.style.display = 'block';
            mosaic.style.display = 'none';
            engineTag.style.display = 'none';
            mosaic.src = '';
            btnLive.classList.remove('active');
            playerBadge.textContent = video.paused ? 'LINK PAUSED' : 'STREAMING';
            hudStreamInfo.textContent = currentUrl ? extractFilename(currentUrl) : 'NO ACTIVE PACKET';
            matrixControl.style.display = 'none';
            addHistory('Switched to STANDARD STREAM', '#00f0ff');
        }
    }

    // ─── MATRIX CONTROL PLANE ───

    function initMatrix() {
        matrixGrid.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const tile = document.createElement('div');
            tile.className = 'matrix-tile';
            tile.dataset.index = i;
            tile.textContent = i + 1;
            tile.onclick = () => selectTile(i);
            matrixGrid.appendChild(tile);
        }
    }

    function selectTile(index) {
        selectedTile = index;
        selectedTileLabel.textContent = `TILE: ${index + 1}`;
        document.querySelectorAll('.matrix-tile').forEach(t => t.classList.remove('selected'));
        matrixGrid.children[index].classList.add('selected');
        updateAssignButton();
    }

    function updateAssignButton() {
        btnAssign.disabled = (selectedTile === null || !selectedJobId);
    }

    async function assignStreamToTile() {
        if (selectedTile === null || !selectedJobId) return;

        matrixLayout[selectedJobId] = selectedTile;
        try {
            const resp = await fetch('/api/layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(matrixLayout)
            });
            if (resp.ok) {
                toast(`Mapped sniper ${selectedJobId.substring(0, 8)} to Tile ${selectedTile + 1}`, 'success');
                addHistory(`Matrix updated: Tile ${selectedTile + 1}`, '#8b5cf6');
                fetchLayout(); // Refresh
            }
        } catch (e) {
            toast('Failed to update layout', 'error');
        }
    }

    async function fetchLayout() {
        try {
            const resp = await fetch('/api/layout');
            matrixLayout = await resp.json();
            renderMatrix();
        } catch (e) {}
    }

    function renderMatrix() {
        if (!matrixGrid) return;
        const tiles = matrixGrid.children;
        
        for (let i = 0; i < 16; i++) {
            tiles[i].classList.remove('occupied');
            tiles[i].title = '';
        }

        for (const [jobId, tileIdx] of Object.entries(matrixLayout)) {
            const idx = parseInt(tileIdx);
            if (idx >= 0 && idx < 16) {
                tiles[idx].classList.add('occupied');
                const job = jobs.find(j => j.id === jobId);
                tiles[idx].title = job ? extractFilename(job.url) : 'Occupied';
            }
        }
    }

    function loadStream() {
        const url = urlInput.value.trim();
        if (!url) {
            toast('Enter target URL', 'error');
            urlInput.focus();
            return;
        }

        currentUrl = url;
        const quality = document.getElementById('quality-selector')?.value || '720';
        const proxyUrl = `/api/stream?url=${encodeURIComponent(url)}&quality=${quality}`;
        video.src = proxyUrl;
        video.load();
        video.play().catch(() => {});
        
        playerBadge.textContent = 'STREAMING';
        hudStreamInfo.textContent = extractFilename(url);
        
        addHistory(`Packet ingestion started: ${extractFilename(url)}`, '#00f0ff');
        toast('Establishing neural link...', 'success');
    }

    function togglePlay() {
        if (!video.src) return;
        if (video.paused) video.play();
        else video.pause();
    }

    function stopVideo() {
        video.pause();
        video.currentTime = 0;
        playerBadge.textContent = 'LINK SEVERED';
    }

    video.addEventListener('play', () => {
        document.getElementById('icon-play').className = 'fas fa-pause';
        playerBadge.textContent = 'STREAMING';
    });

    video.addEventListener('pause', () => {
        document.getElementById('icon-play').className = 'fas fa-play';
        if (video.currentTime > 0) playerBadge.textContent = 'LINK PAUSED';
    });

    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        progressFill.style.width = pct + '%';
        const cur = formatTime(video.currentTime);
        const dur = formatTime(video.duration);
        if (timeDisplayCurrent) timeDisplayCurrent.textContent = cur;
        if (timeDisplayTotal) timeDisplayTotal.textContent = dur;
        if (timeOverlay) timeOverlay.textContent = `${cur} / ${dur}`;
    });

    if (progressContainer) {
        progressContainer.addEventListener('click', (e) => {
            if (!video.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            video.currentTime = pct * video.duration;
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            video.volume = volumeSlider.value / 100;
            video.muted = false;
        });
    }

    if (btnMute) {
        btnMute.addEventListener('click', () => {
            video.muted = !video.muted;
            btnMute.className = video.muted ? 'fas fa-volume-mute' : 'fas fa-volume-high';
        });
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else playerWrapper.requestFullscreen();
        });
    }

    if (playBigBtn) {
        playBigBtn.addEventListener('click', () => {
            if (!video.src && urlInput.value.trim()) loadStream();
            else togglePlay();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ARCHIVE & DEPLOYMENT
    // ═══════════════════════════════════════════════════════════════

    async function deployToEngine() {
        const url = urlInput.value.trim();
        if (!url) {
            toast('Target URL missing', 'error');
            return;
        }

        btnDeploy.disabled = true;
        const isDirect = url.includes('.m3u8') || (url.includes('.mp4') && !url.includes('tiktok.com')) || url.includes('/api/stream');
        
        if (isDirect) {
            btnDeploy.innerHTML = '<i class="fas fa-crosshairs fa-spin"></i> SNIPING';
            addHistory(`Direct Ingress: ${extractFilename(url)}`, '#22d35a');
        } else {
            btnDeploy.innerHTML = '<i class="fas fa-radar fa-spin"></i> HUNTING';
            addHistory(`Scout Hunting: ${url}`, '#ffef00');
        }

        try {
            // --- 🔱 THE SOVEREIGN SNIPER ---
            // If it's a direct bitstream, send to General. 
            // If it's a page (YouTube/TikTok), send to the Scout's Hunter first.
            const quality = document.getElementById('quality-selector')?.value || '720';
            const endpoint = isDirect ? '/api/jobs' : '/api/hunt/url';
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, tile: selectedTile, quality })
            });

            const data = await resp.json();

            if (!resp.ok) {
                const errorMsg = data.error || 'Ingress Failed';
                toast(errorMsg, 'error');
                addHistory(`[FAIL] ${errorMsg}`, '#ff4444');
                throw new Error(errorMsg);
            }

            toast(`Target Locked: ${data.job ? data.job.id.substring(0, 8) : data.id.substring(0, 8)}`, 'success');
            addHistory(`[SUCCESS] Sniper Locked onto Bitstream`, '#22d35a');
            
            // --- 🔱 AUTO-PILOT VISUAL OVERRIDE ---
            // The user wants to see the video instantly natively. 
            // We force the dashboard into CORE LIVE mode so they see the Matrix!
            if (!isLiveMode) {
                toggleLiveMode();
                toast('Switching to God Mosaic Link...', 'success');
            }
            
            fetchJobs();
        } catch (e) {
            toast(`Extraction/Deployment failed`, 'error');
            addHistory(`[ERROR] Sniper Jammed: ${e.message}`, '#ff4444');
        } finally {
            btnDeploy.disabled = false;
            btnDeploy.innerHTML = '<i class="fas fa-crosshairs"></i> SNIPE';
        }
    }

    async function startDownload() {
        const url = urlInput.value.trim();
        if (!url) {
            toast('Target URL missing', 'error');
            return;
        }

        downloadCounter++;
        const filename = extractFilename(url);
        const quality = document.getElementById('quality-selector')?.value || '720';
        const dl = { id: downloadCounter, url, filename, progress: 0, status: 'downloading', startTime: Date.now() };
        downloads.push(dl);
        renderDownloads();
        
        const a = document.createElement('a');
        a.href = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}&quality=${quality}`;
        a.download = filename;
        a.click();
        
        addHistory(`Archive started: ${filename}`, '#8b5cf6');
        simulateProgress(dl);
    }

    function simulateProgress(dl) {
        let p = 0;
        const itv = setInterval(() => {
            p += Math.random() * 15 + 5;
            if (p >= 100) {
                dl.progress = 100;
                dl.status = 'complete';
                clearInterval(itv);
                renderDownloads();
            } else {
                dl.progress = Math.round(p);
                renderDownloads();
            }
        }, 800);
    }

    function renderDownloads() {
        downloadCount.textContent = downloads.length;
        if (downloads.length === 0) {
            downloadList.innerHTML = '<div class="empty-intel"><p>NULL ARCHIVE</p></div>';
            return;
        }
        downloadList.innerHTML = downloads.map(dl => `
            <div class="download-item">
                <div class="download-header">
                    <span class="download-name">${dl.filename}</span>
                    <span class="download-size">${dl.progress}%</span>
                </div>
                <div class="download-progress"><div class="download-progress-fill" style="width:${dl.progress}%"></div></div>
            </div>
        `).join('');
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE POLLING
    // ═══════════════════════════════════════════════════════════════

    async function fetchJobs() {
        try {
            const resp = await fetch('/api/jobs');
            jobs = await resp.json();
            statStreams.textContent = jobs.length;
            queueCount.textContent = jobs.length;
            renderQueue();
            
            // Stats simulation
            if (statCpu) statCpu.textContent = (Math.random() * 5 + 0.5).toFixed(1) + '%';
            if (statLatency) statLatency.textContent = (Math.random() * 20 + 5).toFixed(0) + ' ms';
            if (statMemory) statMemory.textContent = (jobs.length * 4.2).toFixed(2) + ' MB';
            
            const statusBox = document.getElementById('status-container');
            if (statusBox) statusBox.className = 'status-indicator online';
            const statusText = document.getElementById('engine-status');
            if (statusText) statusText.textContent = 'CONNECTED';
            
            // --- 🔱 AUTO-PILOT VISUAL OVERRIDE (GLOBAL) ---
            // If the user opens the UI and a job is already playing,
            // instantly snap to the God Mosaic native feed!
            let hasActivePlayback = jobs.some(j => j.status === 'PLAYING (VISIBLE)');
            if (hasActivePlayback && !isLiveMode) {
                toggleLiveMode();
                toast('Active Mosaic Detected. Snapping to CORE LIVE!', 'success');
            }
        } catch (e) {
            const statusBox = document.getElementById('status-container');
            if (statusBox) statusBox.className = 'status-indicator offline';
            const statusText = document.getElementById('engine-status');
            if (statusText) statusText.textContent = 'OFFLINE';
        }
    }

    function renderQueue() {
        if (!jobs.length) {
            queueList.innerHTML = '<div class="empty-intel"><i class="fas fa-radar"></i><p>AWAITING TARGETS</p></div>';
            return;
        }
        queueList.innerHTML = jobs.map(job => `
            <div class="queue-item ${selectedJobId === job.id ? 'active' : ''}" onclick="window.selectJob('${job.id}')">
                <div class="queue-info">
                    <div class="queue-name">${extractFilename(job.url)}</div>
                    <div class="queue-meta">${job.id.substring(0, 8)}</div>
                </div>
                <span class="queue-status status-${job.status.toLowerCase()}">${job.status}</span>
            </div>
        `).join('');
    }

    window.selectJob = (id) => {
        selectedJobId = id;
        const job = jobs.find(j => j.id === id);
        if (job) urlInput.value = job.url;
        updateAssignButton();
        renderQueue();
    };

    // ═══════════════════════════════════════════════════════════════
    // UTILS
    // ═══════════════════════════════════════════════════════════════

    function addHistory(message, color = '#00f0ff') {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        historyEntries.unshift({ message, color, time });
        if (historyEntries.length > 20) historyEntries.pop();
        historyList.innerHTML = historyEntries.map(e => `
            <div class="log-entry">
                <span class="log-time">[${e.time}]</span>
                <span class="log-msg" style="color:${e.color}">${e.message}</span>
            </div>
        `).join('');
    }

    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${message}</span>`;
        toastContainer.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 400);
        }, 3000);
    }

    function formatTime(s) {
        if (isNaN(s)) return '00:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    function extractFilename(url) {
        try { 
            const urlObj = new URL(url);
            const v = urlObj.searchParams.get('v');
            if (v) return `Target_${v}.mp4`;
            
            const pathParts = urlObj.pathname.split('/');
            const lastPart = pathParts.pop() || 'packet.mp4';
            return lastPart === 'watch' ? 'packet.mp4' : (lastPart.includes('.') ? lastPart : `Target_${lastPart}.mp4`);
        } catch { return 'packet.mp4'; }
    }


    // ─── Initialization ───
    initMatrix();
    fetchJobs();
    fetchLayout();
    
    if (btnStream) btnStream.addEventListener('click', loadStream);
    if (btnDownload) btnDownload.addEventListener('click', startDownload);
    if (btnDeploy) btnDeploy.addEventListener('click', deployToEngine);
    if (btnLive) btnLive.addEventListener('click', toggleLiveMode);
    if (btnPlay) btnPlay.addEventListener('click', togglePlay);
    if (btnStop) btnStop.addEventListener('click', stopVideo);
    if (btnAssign) btnAssign.addEventListener('click', assignStreamToTile);

    setInterval(() => {
        fetchJobs();
        fetchLayout();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (statUptime) statUptime.textContent = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed/60)}m`;
    }, 5000);

    addHistory('NEURAL LINK INITIALIZED', '#00f0ff');
})();
