/* ClearPHYSICS protected video player (YouTube unlisted videos played through a custom shell).
 * - hides YouTube's own controls/links behind a click-shield and uses our own controls
 * - shows the student's email/WhatsApp as a moving watermark (leaks can be traced)
 * - the video link is never shown as a clickable URL on the page
 * Honest limit: nothing in a browser can stop screen recording; this deters casual link sharing. */
window.CPPlayer = (function () {
    let yt = null, ytReady = null, timer = null, markTimer = null, adTimer = null, dragging = false, root = null;

    function idFromUrl(url) {
        const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : '';
    }

    function loadApi() {
        if (ytReady) return ytReady;
        ytReady = new Promise((resolve, reject) => {
            if (window.YT && window.YT.Player) return resolve();
            window.onYouTubeIframeAPIReady = resolve;
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.onerror = () => { ytReady = null; reject(new Error('Could not load the video player. Check your connection.')); };
            document.head.appendChild(s);
        });
        return ytReady;
    }

    const fmt = (t) => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

    function watermarkText() {
        const sess = window.Session ? Session.get() : null;
        const p = (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile : null;
        return [sess && sess.email, p && p.whatsapp].filter(Boolean).join('  •  ');
    }

    function build(title) {
        root = document.createElement('div');
        root.className = 'vp-overlay';
        root.innerHTML = `
          <div class="vp-box">
            <div class="vp-head"><span class="vp-title"></span><button type="button" class="vp-close" aria-label="Close">&times;</button></div>
            <div class="vp-stage">
              <div id="vp-yt"></div>
              <div class="vp-shield"></div>
              <div class="vp-mark"></div>
              <div class="vp-end"><button type="button" class="vp-replay">↻ Replay</button></div>
              <div class="vp-msg"></div>
              <button type="button" class="vp-ad" title="Ad playing? Tap to skip it">⏭ Ad? Tap to skip</button>
              <div class="vp-adbar"><span>Tap “Skip Ad” (bottom-right of the video)</span><button type="button" class="vp-addone">Done</button></div>
              <div class="vp-controls">
                <button type="button" class="vp-btn vp-play" aria-label="Play or pause">▶</button>
                <button type="button" class="vp-btn vp-back" aria-label="Back 10 seconds">⏪10</button>
                <button type="button" class="vp-btn vp-fwd" aria-label="Forward 10 seconds">10⏩</button>
                <span class="vp-time">0:00 / 0:00</span>
                <input type="range" class="vp-seek" min="0" max="1000" value="0" aria-label="Seek">
                <select class="vp-speed" aria-label="Speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
                <button type="button" class="vp-btn vp-full" aria-label="Fullscreen">⛶</button>
              </div>
            </div>
          </div>`;
        root.querySelector('.vp-title').textContent = title || 'Recording';
        document.body.appendChild(root);
        document.body.style.overflow = 'hidden';
    }

    function close() {
        clearInterval(timer); clearInterval(markTimer); clearTimeout(adTimer);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        if (yt && yt.destroy) { try { yt.destroy(); } catch (e) {} }
        yt = null;
        if (root) { root.remove(); root = null; }
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (!root || !yt) return;
        if (e.key === 'Escape' && !document.fullscreenElement) close();
        else if (e.key === ' ') { e.preventDefault(); toggle(); }
        else if (e.key === 'ArrowRight') yt.seekTo(yt.getCurrentTime() + 10, true);
        else if (e.key === 'ArrowLeft') yt.seekTo(yt.getCurrentTime() - 10, true);
    }

    function toggle() {
        if (!yt || !yt.getPlayerState) return;
        yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo();
    }

    function moveMark() {
        const mark = root && root.querySelector('.vp-mark'); if (!mark) return;
        const stage = root.querySelector('.vp-stage');
        mark.style.left = Math.random() * Math.max(10, stage.clientWidth - mark.offsetWidth - 20) + 'px';
        mark.style.top = 12 + Math.random() * Math.max(10, stage.clientHeight - 90) + 'px';
    }

    async function open(videoId, title) {
        if (root) close();
        build(title);
        const q = (s) => root.querySelector(s);
        const stage = q('.vp-stage');
        q('.vp-close').onclick = close;
        root.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('keydown', onKey);
        q('.vp-mark').textContent = watermarkText();
        moveMark(); markTimer = setInterval(moveMark, 6000);
        q('.vp-shield').onclick = toggle;
        q('.vp-shield').ondblclick = () => q('.vp-full').click();
        q('.vp-play').onclick = toggle;
        // "Ad?" mode: lets taps reach YouTube's own Skip Ad button for a while, then re-locks.
        const adMode = (on) => { stage.classList.toggle('vp-admode', on); clearTimeout(adTimer); if (on) adTimer = setTimeout(() => adMode(false), 30000); };
        q('.vp-ad').onclick = () => adMode(true);
        q('.vp-addone').onclick = () => adMode(false);
        q('.vp-back').onclick = () => yt && yt.seekTo(yt.getCurrentTime() - 10, true);
        q('.vp-fwd').onclick = () => yt && yt.seekTo(yt.getCurrentTime() + 10, true);
        q('.vp-speed').onchange = (e) => yt && yt.setPlaybackRate(Number(e.target.value));
        q('.vp-replay').onclick = () => { q('.vp-end').style.display = 'none'; yt.seekTo(0, true); yt.playVideo(); };
        const fsEl = stage.requestFullscreen || stage.webkitRequestFullscreen;
        if (!fsEl) q('.vp-full').style.display = 'none';
        q('.vp-full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen();
        const seek = q('.vp-seek');
        seek.oninput = () => { dragging = true; q('.vp-time').textContent = fmt(yt.getDuration() * seek.value / 1000) + ' / ' + fmt(yt.getDuration()); };
        seek.onchange = () => { yt.seekTo(yt.getDuration() * seek.value / 1000, true); dragging = false; };

        const msg = q('.vp-msg');
        try { await loadApi(); } catch (err) { msg.textContent = err.message; msg.style.display = 'flex'; return; }
        if (!root) return; // closed while loading

        yt = new YT.Player('vp-yt', {
            videoId: videoId,
            playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0, origin: location.origin },
            events: {
                onReady: (e) => e.target.playVideo(),
                onStateChange: (e) => {
                    if (!root) return;
                    q('.vp-play').textContent = e.data === 1 ? '❚❚' : '▶';
                    q('.vp-end').style.display = e.data === 0 ? 'flex' : 'none';
                },
                onError: () => { msg.textContent = "This video can't be played here. In YouTube Studio, make sure the video is Unlisted (not Private) and \"Allow embedding\" is on."; msg.style.display = 'flex'; }
            }
        });
        timer = setInterval(() => {
            if (!yt || !yt.getDuration || dragging || !root) return;
            const d = yt.getDuration() || 0, t = yt.getCurrentTime() || 0;
            if (d) { seek.value = Math.round(t / d * 1000); q('.vp-time').textContent = fmt(t) + ' / ' + fmt(d); }
        }, 300);
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('[data-video]');
        if (!a) return;
        e.preventDefault();
        open(a.getAttribute('data-video'), a.getAttribute('data-video-title'));
    });

    return { idFromUrl: idFromUrl, open: open };
})();
