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

// Auto gain: getByteFrequencyData maps [minDecibels, maxDecibels] to 0-255, so sliding that window by N dB
// is an exact N dB gain for every band (thresholds keep working, true silence stays 0).
// A slow-decaying bass peak is steered toward CONFIG.autoGainTarget in both directions (quiet sources boosted,
// loud ones cut), so shared audio, mic and file all react the same. Quick in the first seconds, gentle after.
const DB_PER_BYTE = 80 / 255;    // the window is 80 dB wide (-90..-10)
let gainPeak = 0, gainBoostDb = 0, gainTime = 0;
function updateAutoGain(bassLevel, dt) {
    if (!CONFIG.autoGain) { gainBoostDb = 0; }
    else {
        gainPeak = Math.max(bassLevel, gainPeak - 15 * dt);   // ~15 bytes/s decay -> follows the song, not each beat
        if (gainPeak > 40) {                                   // silence/pause: hold the gain instead of drifting
            gainTime += dt;
            const error = CONFIG.autoGainTarget - gainPeak;    // bytes
            const up = gainTime < 4 ? 1.2 : 0.4;               // settle fast on start, then follow slowly
            gainBoostDb += error * DB_PER_BYTE * dt * (error > 0 ? up : 1.5); // cut faster: a saturated peak hides detail
            const max = sourceKind === 'mic' ? CONFIG.autoGainMaxDbMic : CONFIG.autoGainMaxDb;
            gainBoostDb = Math.min(max, Math.max(-CONFIG.autoGainMaxDb, gainBoostDb));
        }
    }
    window.audioGainDb = gainBoostDb; // type audioGainDb in the console to see the current boost
    analyser.minDecibels = -90 - gainBoostDb;
    analyser.maxDecibels = -10 - gainBoostDb;
}

// Star cube: half-size STAR_FIELD_HALF around starFieldCenter (also read by lightning-star-targets.js)
const STAR_FIELD_HALF = 50;
const starFieldCenter = new THREE.Vector3();
window.starFieldCenter = starFieldCenter;
function wrapIntoField(p) {
    let wrapped = false;
    for (const k of ['x', 'y', 'z']) {
        const d = p[k] - starFieldCenter[k];
        if (d > STAR_FIELD_HALF) { p[k] -= 2 * STAR_FIELD_HALF; wrapped = true; }
        else if (d < -STAR_FIELD_HALF) { p[k] += 2 * STAR_FIELD_HALF; wrapped = true; }
    }
    return wrapped;
}

// Render loop: read the spectrum -> camera, starfield, lightning
function animate() {
    if (!isStarted) return;
    // in picture-in-picture the canvas lives in that window: its frames keep coming while this tab is hidden
    (window.pipWindow || window).requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const dt = lastFrameTime ? Math.min(0.1, now - lastFrameTime) : 1 / 60;
    lastFrameTime = now;

    analyser.getByteFrequencyData(dataArray);
    const bassLevel = getBandLevel(20, CONFIG.bassMaxHz);
    updateAutoGain(bassLevel, dt); // applies from the next frame
    const intensity = computeIntensity(bassLevel);
    const high = getBandLevel(CONFIG.highMinHz, CONFIG.highMaxHz) / 255;
    // Raw mid-band levels (0-255): the lightning detects new vocal/lead notes in them
    const mids = {
        vocal: getBandLevel(CONFIG.vocalMinHz, CONFIG.vocalMaxHz),
        lead: getBandLevel(CONFIG.leadMinHz, CONFIG.leadMaxHz)
    };

    // World flow along +z, faster with the low end (per-second rate = old per-frame rate at 60 fps).
    // Shared by the stars and the lightning so both stay in one frame of reference
    // Mode 2 overrides it with the walking model's pace (galaxy-walker-model.js)
    const walkFlow = window.walkerFx ? window.walkerFx.flow(dt) : null; // null = not in mode 2
    const flow = walkFlow !== null ? walkFlow : (0.05 + intensity * 0.8) * 60 * dt;
    // The 100-unit star cube is centered on the origin in mode 1 (the camera tours inside it) and on the camera in
    // mode 2 (the camera films the giant from far away, and the stars must still surround it like in mode 1).
    // A star leaving the cube re-enters on the opposite face
    if (walkFlow !== null) starFieldCenter.copy(camera.position);
    else starFieldCenter.set(0, 0, 0);
    stars.forEach(s => {
        s.position.z += flow;
        if (wrapIntoField(s.position)) s.userData.wraps = (s.userData.wraps || 0) + 1; // lightning drops arcs anchored to it
        // gentle twinkle (a lightning flash overrides it, see updateZappedStars)
        const tw = s.userData.twinkle;
        s.material.opacity = s.userData.baseOpacity * (0.85 + 0.15 * Math.sin(now * tw.speed + tw.phase));
    });

    // Optional effect modules (ES modules, may be missing or still loading)
    if (window.shockwaveFx) window.shockwaveFx.update(dt, flow);
    if (window.sparksFx) window.sparksFx.update(dt, flow);
    if (window.walkerFx) window.walkerFx.update(dt, intensity);
    if (window.cityFx) window.cityFx.update(dt, flow, intensity);

    const moving = updateCameraDirector(intensity); // shots + smooth transitions + kick shake

    // 3D lightning (ES module, may not be loaded yet on a slow network); drawn inside renderWithMotionTrail
    if (window.lightningFx) window.lightningFx.update(dt, intensity, high, bassLoudness, flow, mids);
    renderWithMotionTrail(moving);
}

// Fit the canvas + camera to a window (this page, or the picture-in-picture window)
function fitRendererTo(win) {
    if (!camera) return;
    camera.aspect = win.innerWidth / win.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(win.innerWidth, win.innerHeight);
}

window.onresize = () => { if (!window.pipWindow) fitRendererTo(window); };
