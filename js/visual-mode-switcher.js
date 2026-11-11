// Visual modes: the home dropdown picks the mode, the SHUFFLE checkbox next to it (or N while playing) turns on
// automatic switching - a random mode change every CONFIG.autoModeMin-Max seconds, on a strong kick so the cut
// lands on the beat - and locks the dropdown while it is on. M switches mode by hand.
// Mode 2 still falls back to mode 1 until its model has loaded.
// Exposes window.modeFx = { update(intensity) }, called by the animation loop.

(function () {
    let auto = false, nextSwitch = 0;
    const now = () => performance.now() / 1000;
    const scheduleNext = () => { nextSwitch = now() + CONFIG.autoModeMin + Math.random() * (CONFIG.autoModeMax - CONFIG.autoModeMin); };

    function setMode(m) {
        if (m === visualMode) return;
        visualMode = m;
        if (isStarted) startShot(now()); // the camera glides into the new mode's first shot
    }
    // with two modes, a "random" switch is simply the other one
    const switchMode = () => setMode(visualMode === 1 ? 2 : 1);

    // Home controls: applied right away, so the very first shot already belongs to the chosen mode
    const select = document.getElementById('mode-select');
    const shuffle = document.getElementById('mode-shuffle');

    function setAuto(on) {
        auto = on;
        if (auto) scheduleNext();
        if (shuffle) shuffle.checked = on;  // N while playing keeps the checkbox in sync
        if (select) select.disabled = on;   // shuffle picks the modes: the dropdown is locked
    }

    if (select) {
        select.value = String(CONFIG.visualMode);
        select.addEventListener('change', () => setMode(Number(select.value)));
        setMode(Number(select.value));
    }
    if (shuffle) shuffle.addEventListener('change', () => setAuto(shuffle.checked));

    window.addEventListener('keydown', (e) => {
        if (!isStarted) return;
        if (e.key === 'm' || e.key === 'M') switchMode();
        else if (e.key === 'n' || e.key === 'N') setAuto(!auto);
    });

    // intensity: 0-1 kick envelope
    function update(intensity) {
        if (!auto || now() < nextSwitch || intensity < CONFIG.camCutOnKick) return;
        switchMode();
        scheduleNext();
    }

    window.modeFx = { update };
})();
