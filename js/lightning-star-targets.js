// Picks stars as lightning anchors and makes struck stars flash in the arc's color.
// All stars drift by the same flow, so a bolt between two of them stays attached as long as it drifts too.

const WHITE = new THREE.Color(1, 1, 1);
const WRAP_GUARD = 35;     // skip stars about to wrap off the +z face of the star cube (the bolt would detach)
const _ndc = new THREE.Vector3();
const zapped = new Set();

// The star cube is centered on window.starFieldCenter (visualizer-animation-loop.js): origin, or the camera in mode 2
const nearWrap = (m) => m.position.z - (window.starFieldCenter ? window.starFieldCenter.z : 0) > WRAP_GUARD;

// On screen, in front of the camera, not too far, and not about to wrap
function usable(m, maxDist) {
    if (nearWrap(m)) return false;
    if (m.position.distanceTo(camera.position) > maxDist) return false;
    _ndc.copy(m.position).project(camera);
    return _ndc.z > -1 && _ndc.z < 1 && Math.abs(_ndc.x) < 0.9 && Math.abs(_ndc.y) < 0.9;
}

/** A random star currently in view (falls back to any star). */
export function pickStartStar() {
    const inView = stars.filter(m => usable(m, 60));
    const list = inView.length ? inView : stars;
    return list[Math.floor(Math.random() * list.length)];
}

/** A random neighbor of `from` between minD and maxD away, not in `used`; prefers the 4 nearest in view. */
export function pickNextStar(from, used, minD, maxD) {
    const near = [];
    for (const m of stars) {
        if (m === from || used.has(m) || nearWrap(m)) continue;
        const d = m.position.distanceTo(from.position);
        if (d >= minD && d <= maxD) near.push({ m, d, view: usable(m, 80) });
    }
    if (!near.length) return null;
    near.sort((a, b) => (b.view - a.view) || (a.d - b.d));
    return near[Math.floor(Math.random() * Math.min(4, near.length))].m;
}

/** Flash a star in the arc's color (white by default); it cools back to its own color in updateZappedStars. */
export function zapStar(m, k = 1, color = WHITE) {
    m.userData.zap = Math.max(m.userData.zap || 0, k);
    m.userData.zapColor = color;
    zapped.add(m);
}

/** Runs after the twinkle in the animation loop, so a flash overrides it until the star cools down. */
export function updateZappedStars(dt) {
    for (const m of zapped) {
        m.userData.zap *= Math.exp(-dt * 5);
        const z = m.userData.zap, { baseColor, baseOpacity } = m.userData;
        m.material.color.copy(baseColor).lerp(m.userData.zapColor || WHITE, z);
        m.material.opacity = baseOpacity + (1 - baseOpacity) * z;
        if (z < 0.02) {
            m.material.color.copy(baseColor);
            zapped.delete(m);
        }
    }
}
