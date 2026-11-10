// Beat detector state
let bassAvg = 0;       // moving average of the bass -> tells a kick (spike) apart from sustained bass
let pulse = 0;         // 0-1 envelope: jumps up on a kick, fades out by pulseRelease
let bassLoudness = 0;  // 0-1 current bass level above the noise gate (sustained, not just the kick spike)
let lastFrameTime = 0;

// Average level (0-255) of the [fromHz, toHz] band; skips bin 0 (DC). Call after getByteFrequencyData
function getBandLevel(fromHz, toHz) {
    const binHz = analyser.context.sampleRate / analyser.fftSize;
    const a = Math.max(1, Math.round(fromHz / binHz));
    const b = Math.min(dataArray.length - 1, Math.max(a + 1, Math.round(toHz / binHz)));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += dataArray[i];
    return sum / (b - a + 1);
}

// Volume-aware kick strength 0-1: quiet sound under the gate = 0, loud and sudden kick = strongest
function computeIntensity(lowEnd) {
    const loudness = Math.max(0, lowEnd - CONFIG.bassThreshold) / (255 - CONFIG.bassThreshold);
    bassLoudness = loudness;
    const punch = Math.min(1, Math.max(0, lowEnd - bassAvg) / 40); // how far it jumps above the recent level
    bassAvg += (lowEnd - bassAvg) * 0.05;

    const target = loudness * (0.4 + 0.6 * punch);
    pulse = target > pulse ? target : pulse * CONFIG.pulseRelease;
    return pulse;
}

// Auto gain for every source, so the same song looks the same from a file or from shared/mic audio
// (each path reaches the analyser at a different level: file mastering, system/app volume,
// loopback level). Byte bins are dB-scaled, so a gain is an added offset: lift the recent bass peak
// up to CONFIG.autoGainTarget, capped at CONFIG.autoGainMax so near-silence is not blown up into noise.
let bassPeak = 0, agcLogTimer = 0;
function updateAutoGain(rawBass, dt) {
    bassPeak = Math.max(rawBass, bassPeak - CONFIG.autoGainDecay * dt); // fast attack, slow release
    const boost = Math.min(CONFIG.autoGainMax, Math.max(0, CONFIG.autoGainTarget - bassPeak));
    agcLogTimer -= dt;
    if (agcLogTimer <= 0) { // light diagnostics: shows if any audio reaches the analyser at all
        agcLogTimer = 3;
        console.info(`bass raw=${rawBass.toFixed(0)} peak=${bassPeak.toFixed(0)} boost=+${boost.toFixed(0)}`);
    }
    return boost;
}

// Render loop: read the spectrum -> camera, Matrix rain, lightning
function animate() {
    if (!isStarted) return;
    requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const dt = lastFrameTime ? Math.min(0.1, now - lastFrameTime) : 1 / 60;
    lastFrameTime = now;

    analyser.getByteFrequencyData(dataArray);
    const rawBass = getBandLevel(20, CONFIG.bassMaxHz);
    const boost = updateAutoGain(rawBass, dt);
    const intensity = computeIntensity(Math.min(255, rawBass + boost));
    const high = Math.min(255, getBandLevel(CONFIG.highMinHz, CONFIG.highMaxHz) + boost) / 255;

    // World flow along +z, faster with the low end (per-second rate = old per-frame rate at 60 fps).
    // Shared by the Matrix characters and the lightning so both stay in one frame of reference
    const flow = (0.05 + intensity * 0.8) * 60 * dt;
    matrixChars.forEach(mc => {
        mc.position.z += flow;
        if (mc.position.z > 50) {
            mc.position.z = -50;
            mc.userData.wraps = (mc.userData.wraps || 0) + 1; // lets lightning drop arcs anchored to it
        }
    });

    const moving = updateCameraDirector(intensity); // shots + smooth transitions + kick shake

    // 3D lightning (ES module, may not be loaded yet on a slow network); drawn inside renderWithMotionTrail
    if (window.lightningFx) window.lightningFx.update(dt, intensity, high, bassLoudness, flow);
    renderWithMotionTrail(moving);
}

window.onresize = () => {
    if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
};
