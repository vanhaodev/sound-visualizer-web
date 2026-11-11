// Picture-in-picture: moves the visualizer into a small always-on-top window (Document Picture-in-Picture API,
// Chrome/Edge 116+), so it keeps playing while you use other apps.
// Why not video PiP (canvas.captureStream): a hidden tab stops requestAnimationFrame, so the video would freeze.
// Here the canvas itself lives in the PiP window, and the render loop runs on that window's animation frames
// (window.pipWindow, read by visualizer-animation-loop.js), which keep running while the PiP window is visible.
// Optional: remove its <script> tag in index.html to drop the feature. Toggle with the ⧉ button or the P key;
// Esc hides/shows the button.

(function () {
    if (!('documentPictureInPicture' in window)) return; // Firefox/Safari: no API -> no button

    const btn = document.createElement('button');
    btn.className = 'pip-btn';
    btn.textContent = '⧉';
    btn.title = 'Picture-in-picture (P)';
    btn.hidden = true;
    document.body.appendChild(btn);

    // the visualizer canvas + the full-screen flash layer travel together between the two windows
    const movable = () => [renderer.domElement, document.getElementById('flash-layer')];

    async function open() {
        const pip = await documentPictureInPicture.requestWindow({ width: 480, height: 270 });
        // same styles in the PiP document (flash layer, body background)
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => pip.document.head.appendChild(n.cloneNode(true)));
        Object.assign(pip.document.body.style, { margin: '0', overflow: 'hidden', background: '#03040d' });
        pip.document.body.append(...movable());
        window.pipWindow = pip;
        fitRendererTo(pip);
        pip.addEventListener('resize', () => fitRendererTo(pip));
        pip.addEventListener('keydown', onKey);
        // closed by the user (or by close()): bring everything back to the page
        pip.addEventListener('pagehide', () => {
            document.body.prepend(...movable());
            window.pipWindow = null; // must be cleared before showIcon() below
            fitRendererTo(window);
            requestAnimationFrame(animate); // the PiP window's frame loop died with it
            showIcon();
        });
        btn.hidden = true;
    }

    function close() {
        if (window.pipWindow) window.pipWindow.close();
    }

    async function toggle() {
        if (!isStarted) return;
        try {
            if (window.pipWindow) close(); else await open();
        } catch (e) {
            console.error('Picture-in-picture failed:', e);
        }
    }

    // Esc hides/shows the button (clean screen); P still toggles picture-in-picture while it is hidden
    let iconOff = true; // hidden by default for a clean screen (the home screen explains the keys)
    const showIcon = () => (btn.hidden = iconOff || !isStarted || !!window.pipWindow);

    function onKey(e) {
        if (e.key === 'p' || e.key === 'P') toggle();
        else if (e.key === 'Escape' && isStarted) { iconOff = !iconOff; showIcon(); }
    }

    btn.addEventListener('click', toggle);
    window.addEventListener('keydown', onKey);
    window.addEventListener('visualizerstart', showIcon);
})();
