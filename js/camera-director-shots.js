// Camera "director": several shots, smooth (lerp) glides between them, each move starting on a kick.
// Follows no object - every shot only computes a camera position + a fixed look-at point in space.
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

const makePose = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
const _curPose = makePose(), _prevPose = makePose(), _lookAt = new THREE.Vector3();
const CUT_FALLBACK_WAIT = 4;   // extra seconds to wait for a kick after the duration; then move on anyway
const MIN_BLEND_DISTANCE = 18; // minimum camera-to-target distance while gliding

// cur = current shot, prev = old shot (keeps running during the blend so the motion stays continuous)
const director = { cur: null, prev: null, blendStart: 0 };

// easeInOutCubic: slow start, fast middle, soft landing
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Each shot gets a random duration in [camMinShot, camMaxShot] -> irregular pacing, no spam
function startShot(now) {
    const names = Object.keys(CAMERA_SHOTS).filter(n => n !== director.cur?.name);
    const shot = {
        name: names[Math.floor(Math.random() * names.length)],
        start: now,
        duration: CONFIG.camMinShot + Math.random() * (CONFIG.camMaxShot - CONFIG.camMinShot),
        state: {}
    };
    CAMERA_SHOTS[shot.name].setup(shot.state);
    director.prev = director.cur; // null the first time -> no blend
    director.cur = shot;
    director.blendStart = now;
}

const evalShot = (shot, now, out) => CAMERA_SHOTS[shot.name].update(now - shot.start, shot.state, out);

// Called every frame. Returns how much the camera is "moving" 0-1 (peaks mid-transition) for the motion blur
function updateCameraDirector(intensity) {
    const now = performance.now() / 1000;
    const cur = director.cur;
    if (!cur) startShot(now);
    else {
        const elapsed = now - cur.start;
        const due = elapsed > cur.duration;
        if ((due && intensity > CONFIG.camCutOnKick) || elapsed > cur.duration + CUT_FALLBACK_WAIT) startShot(now);
    }

    evalShot(director.cur, now, _curPose);
    let moving = 0;

    const blendT = (now - director.blendStart) / CONFIG.camBlendTime;
    if (director.prev && blendT < 1) {
        evalShot(director.prev, now, _prevPose);
        const e = easeInOut(blendT);
        _curPose.pos.lerpVectors(_prevPose.pos, _curPose.pos, e);
        _curPose.target.lerpVectors(_prevPose.target, _curPose.target, e);
        // Shots on opposite sides make the lerp pass through the target and flip the camera; push out to a minimum distance
        _lookAt.subVectors(_curPose.pos, _curPose.target);
        if (_lookAt.length() < MIN_BLEND_DISTANCE) {
            if (_lookAt.lengthSq() < 1e-6) _lookAt.set(0, 1, 0);
            _curPose.pos.copy(_curPose.target).add(_lookAt.setLength(MIN_BLEND_DISTANCE));
        }
        moving = Math.sin(blendT * Math.PI); // 0 -> 1 -> 0
    } else {
        director.prev = null;
    }

    camera.position.copy(_curPose.pos);
    camera.lookAt(_lookAt.copy(_curPose.target));

    // Kick shake - added last so it never accumulates across frames
    if (intensity > 0.5) {
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
    }
    return moving;
}
