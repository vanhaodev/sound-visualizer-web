// Beat detector state
let bassAvg = 0;       // moving average of the bass -> tells a kick (spike) apart from sustained bass
let pulse = 0;         // 0-1 envelope: jumps up on a kick, fades out by pulseRelease
let bassLoudness = 0;  // 0-1 current bass level above the noise gate (sustained, not just the kick spike)
let lastFrameTime = 0;

// Average level (0-255) of the [fromHz, toHz] band of a byte spectrum; skips bin 0 (DC)
function bandLevelOf(data, binHz, fromHz, toHz) {
    const a = Math.max(1, Math.round(fromHz / binHz));
    const b = Math.min(data.length - 1, Math.max(a + 1, Math.round(toHz / binHz)));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += data[i];
    return sum / (b - a + 1);
}
// Same on the live analyser. Call after getByteFrequencyData
const getBandLevel = (fromHz, toHz) =>
    bandLevelOf(dataArray, analyser.context.sampleRate / analyser.fftSize, fromHz, toHz);

// Kick strength 0-1: needs BOTH a loud low end (over the gate) AND a sudden jump above its recent level.
// Loud but steady bass (a held bass note, a pad, room rumble) has no jump -> no kick; it still drives the
// sustained effects through bassLoudness
function computeIntensity(lowEnd) {
    const loudness = Math.max(0, lowEnd - CONFIG.bassThreshold) / (255 - CONFIG.bassThreshold);
    bassLoudness = loudness;
    const punch = Math.min(1, Math.max(0, lowEnd - bassAvg) / 40); // how far it jumps above the recent level
    bassAvg += (lowEnd - bassAvg) * 0.05;

    const target = loudness * Math.min(1, punch * 1.25);
    pulse = target > pulse ? target : pulse * CONFIG.pulseRelease;
    return pulse;
}

// Auto gain: getByteFrequencyData maps [minDecibels, maxDecibels] to 0-255, so sliding that window by N dB
// is an exact N dB gain for every band (thresholds keep working, true silence stays 0).
// The peak of the song's LOUDEST part (bass, or the mids + MID_REF_OFFSET) is steered toward
// CONFIG.autoGainTarget, so shared audio, mic and file all react the same. Steering by the bass alone would boost
// a song WITHOUT bass until its leftover low rumble looked like kicks; the mids keep it at its real level.
// It is a volume calibration, NOT a compressor: a song lives on the contrast between its quiet and loud parts,
// so it must not even them out. It settles fast on the first seconds of sound, then barely moves: the peak is
// remembered for ~20-30 s (a quiet verse stays quiet next to the chorus it follows) and the gain only creeps up.
// The one fast move is a cut when the sound gets louder than ever before (volume turned up: avoid clipping).
// The peak is tracked in SOURCE dB (the gain removed), so the gain never feeds back into its own measurement:
// the wanted gain is simply "what brings the remembered peak to the target", approached smoothly.
const DB_PER_BYTE = 80 / 255;    // the window is 80 dB wide (-90..-10)
const MID_REF_OFFSET = 20;       // bytes (~6 dB): in a normal mix the mids sit about this much below the bass
const GAIN_SETTLE = 6;           // seconds of sound during which the gain may move quickly (initial calibration)
const PEAK_FALL_DB = 0.5;        // dB per second the remembered peak sinks (10 dB quieter part: ~20 s to follow)
let peakDb = -Infinity, gainBoostDb = 0, gainTime = 0;
function updateAutoGain(level, dt) {
    // A file plays at its mastered level straight into the analyser (no app / Windows volume in between), so it
    // gets ONE constant gain for the whole song, measured on the whole song beforehand (file-loudness-calibration.js).
    // Calibrating live on its quiet intro boosted it up to ~40 dB and turned the intro's soft low end into fake kicks
    if (!CONFIG.autoGain) { gainBoostDb = 0; }
    else if (sourceKind === 'file') { gainBoostDb = typeof fileGainDb === 'number' ? fileGainDb : 0; }
    else if (level > 40) {                                     // silence/pause: hold the gain instead of drifting
        gainTime += dt;
        const srcDb = level * DB_PER_BYTE - 90 - gainBoostDb;  // this frame's level, before any gain
        peakDb = Math.max(srcDb, peakDb - PEAK_FALL_DB * dt);
        const max = sourceKind === 'mic' ? CONFIG.autoGainMaxDbMic : CONFIG.autoGainMaxDb;
        const targetDb = CONFIG.autoGainTarget * DB_PER_BYTE - 90;
        const want = Math.min(max, Math.max(-CONFIG.autoGainMaxDb, targetDb - peakDb));
        // louder than ever: cut quickly (no clipping) | first seconds: calibrate | then: almost hold (~20 s)
        const k = want < gainBoostDb ? 4 : gainTime < GAIN_SETTLE ? 2 : 0.05;
        gainBoostDb += (want - gainBoostDb) * Math.min(1, dt * k);
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
    const bassLevel = getBandLevel(CONFIG.kickMinHz, CONFIG.bassMaxHz);
    const midLevel = getBandLevel(250, 2000);
    updateAutoGain(Math.max(bassLevel, midLevel + MID_REF_OFFSET), dt); // applies from the next frame
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

    if (window.modeFx) window.modeFx.update(intensity); // automatic mode switching (N key / "Auto" on the home screen)
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
