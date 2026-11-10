// Picks Matrix characters as lightning anchors and makes struck characters flash.
// All characters drift by the same flow, so a bolt between two of them stays attached as long as it drifts too.

const GREEN = new THREE.Color(0x00ff41), WHITE = new THREE.Color(1, 1, 1);
const WRAP_GUARD_Z = 35;   // skip characters about to wrap from z=+50 to -50 (the bolt would detach)
const _ndc = new THREE.Vector3();
const zapped = new Set();

// On screen, in front of the camera, not too far, and not about to wrap
function usable(m, maxDist) {
    if (m.position.z > WRAP_GUARD_Z) return false;
    if (m.position.distanceTo(camera.position) > maxDist) return false;
    _ndc.copy(m.position).project(camera);
    return _ndc.z > -1 && _ndc.z < 1 && Math.abs(_ndc.x) < 0.9 && Math.abs(_ndc.y) < 0.9;
}

/** A random character currently in view (falls back to any character). */
export function pickStartLetter() {
    const inView = matrixChars.filter(m => usable(m, 60));
    const list = inView.length ? inView : matrixChars;
    return list[Math.floor(Math.random() * list.length)];
}

/** A random neighbor of `from` between minD and maxD away, not in `used`; prefers the 4 nearest in view. */
export function pickNextLetter(from, used, minD, maxD) {
    const near = [];
    for (const m of matrixChars) {
        if (m === from || used.has(m) || m.position.z > WRAP_GUARD_Z) continue;
        const d = m.position.distanceTo(from.position);
        if (d >= minD && d <= maxD) near.push({ m, d, view: usable(m, 80) });
    }
    if (!near.length) return null;
    near.sort((a, b) => (b.view - a.view) || (a.d - b.d));
    return near[Math.floor(Math.random() * Math.min(4, near.length))].m;
}

/** Flash a character white; it cools back to green in updateZappedLetters. */
export function zapLetter(m, k = 1) {
    m.userData.zap = Math.max(m.userData.zap || 0, k);
    zapped.add(m);
}

export function updateZappedLetters(dt) {
    for (const m of zapped) {
        m.userData.zap *= Math.exp(-dt * 5);
        const z = m.userData.zap;
        m.material.color.copy(GREEN).lerp(WHITE, z);
        m.material.opacity = 0.5 + 0.5 * z;
        if (z < 0.02) {
            m.material.color.copy(GREEN);
            m.material.opacity = 0.5;
            zapped.delete(m);
        }
    }
}
