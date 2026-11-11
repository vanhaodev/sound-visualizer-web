// Picks the lightning anchors (stars by default) and makes struck anchors flash in the arc's color.
// All anchors drift by the same flow as the bolts, so a bolt between two of them stays attached.
//
// Anchor set: the starfield, unless another mode provides its own through window.lightningAnchors =
//   { list, viewRange, nearWrap(m), scale }  (e.g. giant-city-sky-anchors.js: points in the sky over the city)
// - list: objects with a position + material (color/opacity flash) + userData { baseColor, baseOpacity, wraps }
// - viewRange: farthest distance from the camera a chain may start at
// - nearWrap(m): true when m is about to wrap around (a bolt to it would detach)
// - scale: world scale of this set; hop distances (and, in music-reactive-lightning.js, bolt sizes) grow with it
// - pickStart(candidates), pickNext(from, used): optional, replace the default choice (e.g. strikes going downward)
// - beatOnly: optional, strike only on the camera's beat thud (no bass / vocal / lead / hi-hat chains)

const WHITE = new THREE.Color(1, 1, 1);
const WRAP_GUARD = 35;     // skip stars about to wrap off the +z face of the star cube (the bolt would detach)
const _ndc = new THREE.Vector3();
const zapped = new Set();

// The star cube is centered on window.starFieldCenter (visualizer-animation-loop.js): origin, or the camera in mode 2
const STARFIELD = {
    get list() { return stars; },
    viewRange: 60,
    nearWrap: (m) => m.position.z - (window.starFieldCenter ? window.starFieldCenter.z : 0) > WRAP_GUARD,
    scale: 1
};
const anchors = () => window.lightningAnchors || STARFIELD;

/** World scale of the current anchor set (1 = the starfield). */
export const anchorScale = () => anchors().scale;

/** True when the set steers its own chains (pickNext): they run until it has nowhere left to go
 *  (e.g. a vertical strike runs until it hits a rooftop) instead of stopping after a fixed number of hops. */
export const chainsRunToEnd = () => !!anchors().pickNext;

/** True when the set only wants strikes on the camera's beat thud ('camerathud' event), nothing else. */
export const chainsOnBeatOnly = () => !!anchors().beatOnly;

// On screen, in front of the camera, not too far, and not about to wrap
function usable(m, maxDist) {
    if (anchors().nearWrap(m)) return false;
    if (m.position.distanceTo(camera.position) > maxDist) return false;
    _ndc.copy(m.position).project(camera);
    return _ndc.z > -1 && _ndc.z < 1 && Math.abs(_ndc.x) < 0.9 && Math.abs(_ndc.y) < 0.9;
}

/** A random anchor currently in view (falls back to any anchor). */
export function pickStartStar() {
    const set = anchors(), inView = set.list.filter(m => usable(m, set.viewRange));
    const list = inView.length ? inView : set.list;
    if (set.pickStart) return set.pickStart(list);
    return list[Math.floor(Math.random() * list.length)];
}

/** A random neighbor of `from` between minD and maxD away (times the set's scale), not in `used`;
 *  prefers the 4 nearest in view. */
export function pickNextStar(from, used, minD, maxD) {
    const set = anchors(), near = [];
    if (set.pickNext) return set.pickNext(from, used);
    minD *= set.scale; maxD *= set.scale;
    for (const m of set.list) {
        if (m === from || used.has(m) || set.nearWrap(m)) continue;
        const d = m.position.distanceTo(from.position);
        if (d >= minD && d <= maxD) near.push({ m, d, view: usable(m, set.viewRange * 1.35) });
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
