// Camera "director": several shots, smooth (lerp) glides between them, each move starting on a kick.
// Mode 1 (CAMERA_SHOTS below) follows no object - every shot only computes a camera position + a fixed look-at point.
// Mode 2 uses WALKER_SHOTS (camera-walker-follow-shots.js), framed around the walking model.
// Shot: setup(state) runs once; update(t, state, out) writes out.pos / out.target (t = seconds since the shot began)

const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const FLY_MAX_Z = -5; // where flyThrough stops: half of the scene is still ahead

const CAMERA_SHOTS = {
    // Wide shot orbiting the whole scene, tilting gently up and down
    wideOrbit: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; s.dir = randSign(); },
        update: (t, s, out) => {
            const a = s.angle + t * 0.2 * s.dir;
            out.pos.set(Math.sin(a) * 48, Math.sin(t * 0.3) * 12, Math.cos(a) * 48);
            out.target.set(0, 0, 0);
        }
    },

    // Close orbit right inside the scene, looking at the center
    closeOrbit: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; s.dir = randSign(); s.h = (Math.random() - 0.5) * 10; },
        update: (t, s, out) => {
            const a = s.angle + t * 0.3 * s.dir;
            out.pos.set(Math.sin(a) * 20, s.h + Math.sin(t * 0.5) * 3, Math.cos(a) * 20);
            out.target.set(0, 0, 0);
        }
    },

    // Top-down view, slowly turning like a drone
    topDown: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; },
        update: (t, s, out) => {
            const a = s.angle + t * 0.12;
            out.pos.set(Math.sin(a) * 8, 55 - t * 1.5, Math.cos(a) * 8);
            out.target.set(0, 0, 0);
        }
    },

    // Slow fly forward along z, looking straight ahead.
    // Stops at FLY_MAX_Z so it never flies past the scene and stares into the void
    flyThrough: {
        setup: (s) => {
            s.x = (Math.random() - 0.5) * 20;
            s.y = (Math.random() - 0.5) * 20;
            s.z = -50 + Math.random() * 10;
        },
        update: (t, s, out) => {
            const z = Math.min(FLY_MAX_Z, s.z + t * 3.5);
            out.pos.set(s.x + Math.sin(t * 0.5) * 3, s.y + Math.cos(t * 0.4) * 2, z);
            out.target.set(s.x * 0.5, s.y * 0.5, z + 30);
        }
    },

    // Low angle looking up, dollying in toward the center
    lowDolly: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; },
        update: (t, s, out) => {
            const r = Math.max(30, 60 - t * 3);
            out.pos.set(Math.sin(s.angle) * r, -24, Math.cos(s.angle) * r);
            out.target.set(0, 6, 0);
        }
    }
};

const DEFAULT_FOV = 75;
const makePose = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: DEFAULT_FOV });
const _curPose = makePose(), _prevPose = makePose(), _lookAt = new THREE.Vector3();
const CUT_FALLBACK_WAIT = 4;   // extra seconds to wait for a kick after the duration; then move on anyway

// Shot sets per visual mode. Mode 2 (the walking model + WALKER_SHOTS) falls back to mode 1 until the model is loaded.
// pivot / minRadius: the glide between two shots swings around this vertical axis, never closer than minRadius
// (mode 1: the scene center; mode 2: her body - its box is ~0.16 H half-wide, so 0.3 H clears it)
// blend: seconds of each glide; hold: shot duration multiplier
const _origin = new THREE.Vector3();
const SHOT_SETS = {
    1: { shots: CAMERA_SHOTS, pivot: () => _origin, minRadius: () => 18, blend: () => CONFIG.camBlendTime, hold: 1 },
    2: {
        shots: typeof WALKER_SHOTS !== 'undefined' ? WALKER_SHOTS : CAMERA_SHOTS,
        pivot: () => window.walker.anchor, minRadius: () => 0.3 * window.walker.height,
        // the city's buildings start 0.7 H from her path and the lamps stand at ~0.68 H: glides stay inside the
        // street, this far from its middle at most (otherwise swinging around her cuts through the buildings)
        corridor: () => 0.62 * window.walker.height,
        blend: () => CONFIG.camBlendTimeGiant, hold: CONFIG.camHoldGiant
    }
};

// Glide from pose a to pose b (e = 0..1 eased) on an arc around the pivot axis, in cylindrical coordinates
// (angle, radius, height interpolated). A straight-line lerp between shots on opposite sides cuts through the
// subject, and pushing the camera back out flips direction abruptly near the axis: the camera spins.
// - both shots keep moving, so the angle between them is unwrapped against last frame (state.prevD): no full-turn jump
// - the minimum radius only ramps in mid-glide: a shot that starts or ends near the axis is not kicked away
const TAU = Math.PI * 2;
function arcGlide(a, b, e, set, state, out) {
    const p = set.pivot(), K = set.minRadius();
    const ra = Math.hypot(a.pos.x - p.x, a.pos.z - p.z), rb = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
    const aa = Math.atan2(a.pos.x - p.x, a.pos.z - p.z), ab = Math.atan2(b.pos.x - p.x, b.pos.z - p.z);
    let d = ((ab - aa) % TAU + TAU + Math.PI) % TAU - Math.PI;   // shortest turn, -PI..PI (first frame)
    if (state.prevD !== undefined) {                             // then: the value closest to last frame's
        while (d - state.prevD > Math.PI) d -= TAU;
        while (d - state.prevD < -Math.PI) d += TAU;
    }
    state.prevD = d;
    const rMin = e < 0.5 ? Math.min(K, ra) + (K - Math.min(K, ra)) * e * 2       // ramps up to K...
                         : K + (Math.min(K, rb) - K) * (e - 0.5) * 2;            // ...and back to the end shot
    const ang = aa + d * e, r = Math.max(rMin, ra + (rb - ra) * e);
    out.pos.set(p.x + Math.sin(ang) * r, a.pos.y + (b.pos.y - a.pos.y) * e, p.z + Math.cos(ang) * r);
    if (set.corridor) {
        // keep inside the street: |x - pivot.x| <= half-width. Ramps in/out like rMin, so a glide that starts or
        // ends outside it (e.g. coming from a mode 1 shot) is not yanked sideways on its first frame
        const L = set.corridor(), xa = Math.max(L, Math.abs(a.pos.x - p.x)), xb = Math.max(L, Math.abs(b.pos.x - p.x));
        const lim = e < 0.5 ? xa + (L - xa) * e * 2 : L + (xb - L) * (e - 0.5) * 2;
        out.pos.x = p.x + Math.max(-lim, Math.min(lim, out.pos.x - p.x));
    }
    out.target.lerpVectors(a.target, b.target, e);
    out.fov = a.fov + (b.fov - a.fov) * e;
}
const _glidePose = makePose();
const activeMode = () => (visualMode === 2 && window.walker?.ready ? 2 : 1);

// cur = current shot, prev = old shot (keeps running during the blend so the motion stays continuous),
// glideState = scratch state of the current glide (e.g. its locked turning direction), reset on every new shot,
// shown = the pose actually on screen last frame, blending = a glide is in progress
const director = { cur: null, prev: null, blendStart: 0, glideState: {}, shown: makePose(), blending: false };
const copyPose = (to, from) => { to.pos.copy(from.pos); to.target.copy(from.target); to.fov = from.fov; return to; };

// easeInOutCubic: slow start, fast middle, soft landing
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Each shot gets a random duration in [camMinShot, camMaxShot] -> irregular pacing, no spam
function startShot(now) {
    const mode = activeMode(), shots = SHOT_SETS[mode].shots;
    const names = Object.keys(shots).filter(n => n !== director.cur?.name);
    const shot = {
        mode, name: names[Math.floor(Math.random() * names.length)],
        start: now,
        duration: (CONFIG.camMinShot + Math.random() * (CONFIG.camMaxShot - CONFIG.camMinShot)) * SHOT_SETS[mode].hold,
        state: {}
    };
    shots[shot.name].setup(shot.state);
    // A new shot during a glide (M key, model just loaded, shots shorter than the glide): start from where the camera
    // really is (frozen snapshot), not from the old shot's own pose, or the camera would jump and spin
    director.prev = director.blending ? { frozen: copyPose(makePose(), director.shown) } : director.cur; // null at first
    director.cur = shot;
    director.blendStart = now;
    director.glideState = {};
}

// each shot remembers its own set, so a glide between modes keeps evaluating the old shot correctly
const evalShot = (shot, now, out) => {
    if (shot.frozen) { copyPose(out, shot.frozen); return; } // snapshot of an interrupted glide
    out.fov = DEFAULT_FOV; // shots may set their own lens
    SHOT_SETS[shot.mode].shots[shot.name].update(now - shot.start, shot.state, out);
};


// Called every frame. Returns how much the camera is "moving" 0-1 (peaks mid-transition) for the motion blur
function updateCameraDirector(intensity) {
    const now = performance.now() / 1000;
    const cur = director.cur;
    if (!cur || cur.mode !== activeMode()) startShot(now); // first frame, or the model just finished loading
    else {
        const elapsed = now - cur.start;
        const due = elapsed > cur.duration;
        if ((due && intensity > CONFIG.camCutOnKick) || elapsed > cur.duration + CUT_FALLBACK_WAIT) startShot(now);
    }

    evalShot(director.cur, now, _curPose);
    let moving = 0;

    const blendT = (now - director.blendStart) / SHOT_SETS[director.cur.mode].blend();
    if (director.prev && blendT < 1) {
        evalShot(director.prev, now, _prevPose);
        const e = easeInOut(blendT);
        // the destination mode's pivot (a glide across modes swings around where the new shots are framed)
        arcGlide(_prevPose, _curPose, e, SHOT_SETS[director.cur.mode], director.glideState, _glidePose);
        copyPose(_curPose, _glidePose); // the lens (fov) zooms during the glide too
        moving = Math.sin(blendT * Math.PI); // 0 -> 1 -> 0
        director.blending = true;
    } else {
        director.prev = null;
        director.blending = false;
    }
    copyPose(director.shown, _curPose); // before the shake, so a snapshot never captures a random jolt

    camera.position.copy(_curPose.pos);
    _lookAt.copy(_curPose.target);
    if (director.cur.mode === 2) giantShake(intensity, camera.position, _lookAt);
    camera.lookAt(_lookAt);
    if (Math.abs(camera.fov - _curPose.fov) > 0.01) {
        camera.fov = _curPose.fov;
        camera.updateProjectionMatrix();
    }

    // Mode 1 kick shake - added last so it never accumulates across frames (mode 2 has giantShake above)
    if (director.cur.mode === 1 && intensity > 0.5) {
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
    }
    return moving;
}

// Mode 2 camera shake, two layers, both scaled by the camera's distance to what it looks at (same feel on a close
// shot and a wide one), applied to this frame's pose only (never accumulates):
// - beat thud: on each kick (rising edge of the kick envelope) the camera drops and bounces back a few times,
//   dying out - a heavy hit, deeper for harder kicks (CONFIG.shakeBeat)
// - kick jitter: a small quick shake of the aim while the kick is loud (CONFIG.shakeKick)
// kick envelope that counts as a beat: low on purpose - the thud's depth already scales with the kick, so a quiet
// verse gets soft thuds and the chorus heavy ones (the song's dynamics), instead of a quiet part with none at all
const BEAT_ON = () => CONFIG.beatThreshold;
// one kick = one thud: a kick hovering around BEAT_ON would otherwise fire twice within a few frames, so the next
// beat needs the envelope to drop below BEAT_REARM first, and at least BEAT_MIN_GAP seconds (240 BPM).
// (BEAT_REARM stays under the lowest sensible CONFIG.beatThreshold)
const BEAT_REARM = 0.15, BEAT_MIN_GAP = 0.25;
let thudAge = 99, thudPower = 0, lastShake = 0, beatArmed = true;
const _shakeDir = new THREE.Vector3();
function giantShake(intensity, pos, target) {
    const now = performance.now() / 1000, dist = pos.distanceTo(target);
    thudAge += Math.min(0.1, now - (lastShake || now)); // real frame time: same bounce at 60 or 144 Hz
    lastShake = now;
    if (intensity < BEAT_REARM) beatArmed = true;
    if (beatArmed && intensity > BEAT_ON() && thudAge > BEAT_MIN_GAP) {                      // a new beat
        beatArmed = false;
        thudAge = 0; thudPower = intensity;
        // the sky lightning strikes exactly on this thud (music-reactive-lightning.js)
        window.dispatchEvent(new CustomEvent('camerathud', { detail: { power: intensity } }));
    }
    // damped bounce: down first, ~6 Hz, gone in ~0.6 s (fits between beats up to ~100 BPM)
    const bounce = -Math.exp(-thudAge * 7) * Math.cos(thudAge * 38) * thudPower;
    const dy = bounce * 0.012 * dist * CONFIG.shakeBeat;
    pos.y += dy;
    target.y += dy * 0.6; // the aim lags the body a little: a slight nod, not a flat lift
    if (intensity > 0.3) {
        const a = (intensity - 0.3) * 0.008 * dist * CONFIG.shakeKick;
        target.add(_shakeDir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(a));
    }
}
