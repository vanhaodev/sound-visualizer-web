// Mode 2 sky lightning: invisible anchor points over both rows of buildings, for the chain lightning of
// music-reactive-lightning.js (handed over through window.lightningAnchors, see lightning-star-targets.js).
// - they flow with the city at her walking pace and wrap around at the end of the street exactly like the buildings
//   (same z, same flow, same wrap point), so every bolt stays pinned to the city
// - only over the buildings, never over the street: no bolt crosses her path or goes through her
// - bigger world scale (CONFIG.skyLightningScale): thicker, bigger bolts that read at city size
// Vertical strikes (CONFIG.skyLightningVertical): over each of ROOFS real rooftops stands a "strike column" of
// anchors, from high in the sky down to the roof, each a little off the plumb line. A chain starts at the top of a
// column in view and steps down it to the roof - cloud-to-ground lightning (the bolt shape itself is still random
// and forked every time). Random anchors would be too sparse for that: a chain rarely found a next step below.
// Otherwise chains hop around random sky anchors like in mode 1.
// Built and driven by giant-city-buildings.js (buildSkyAnchors once, updateSkyAnchors every frame).

// The count grows with the volume so chains still find neighbors (tuned on [1.2, 2.4] x [1.2, 3.5] heights)
const DENSITY = 700 / (1.2 * 2.3);
const NEAR_WRAP = 0.08;   // fraction of the street length before the wrap point where anchors are skipped
const ROOFS = 300;        // rooftops that can be struck (one strike column each)
const STEP = 0.35;        // vertical strikes: height of one step down a column, in her heights
const LEAN = 0.08;        // vertical strikes: random sideways offset of each step, in her heights

let set = null;

function makeAnchor(x, y, z) {
    // only the material is used (the flash color/opacity of a struck anchor): never drawn
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ visible: false }));
    m.position.set(x, y, z);
    m.userData = { baseColor: new THREE.Color(1, 1, 1), baseOpacity: 1, wraps: 0 };
    return m;
}

/** Creates the anchors for her (window.walker) inside the city's z range (shared uniforms uZMin / uLength).
 *  roofTops: Vector3 top-centers of the buildings (in their unwrapped layout positions). */
export function buildSkyAnchors(w, shared, roofTops) {
    const H = w.height, zMin = shared.uZMin.value, len = shared.uLength.value, list = [];
    const SKY = CONFIG.skyLightningHeight, SIDE = CONFIG.skyLightningDistance;
    set = {
        list,
        viewRange: 6 * H,
        nearWrap: (m) => m.position.z > zMin + len - NEAR_WRAP * len,
        scale: CONFIG.skyLightningScale,
        beatOnly: true // thunder strikes together with the camera's beat thud, nothing else
    };
    if (CONFIG.skyLightningVertical) buildStrikeColumns(w, roofTops, list, SKY, SIDE);
    else buildRandomSky(w, zMin, len, list, SKY, SIDE);
}

// Random anchors in the sky band, over both rows of buildings (chains hop around like in mode 1)
function buildRandomSky(w, zMin, len, list, SKY, SIDE) {
    const H = w.height, count = Math.round(DENSITY * (SKY[1] - SKY[0]) * (SIDE[1] - SIDE[0]));
    for (let i = 0; i < count; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        list.push(makeAnchor(
            w.anchor.x + side * H * (SIDE[0] + Math.random() * (SIDE[1] - SIDE[0])),
            w.anchor.y + H * (SKY[0] + Math.random() * (SKY[1] - SKY[0])),
            zMin + Math.random() * len
        ));
    }
}

// A column per struck roof: top somewhere in the sky band, then one anchor every ~STEP down to the roof.
// Each anchor knows the one below it (userData.below); the top is marked (userData.top)
function buildStrikeColumns(w, roofTops, list, SKY, SIDE) {
    const H = w.height;
    const roofs = roofTops.filter(p => {
        const d = Math.abs(p.x - w.anchor.x);
        return d >= SIDE[0] * H && d <= SIDE[1] * H;
    });
    for (let i = roofs.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [roofs[i], roofs[k]] = [roofs[k], roofs[i]]; }
    for (const roof of roofs.slice(0, ROOFS)) {
        const topY = w.anchor.y + H * (SKY[0] + Math.random() * (SKY[1] - SKY[0]));
        const steps = Math.max(2, Math.round((topY - roof.y) / (STEP * H)));
        let below = makeAnchor(roof.x, roof.y, roof.z); // the strike point, exactly on the roof
        list.push(below);
        for (let s = 1; s <= steps; s++) {
            const off = s === steps ? 0.5 : 1; // the top drifts less: the bolt starts near above its target
            const m = makeAnchor(
                roof.x + (Math.random() - 0.5) * 2 * LEAN * H * off,
                roof.y + (topY - roof.y) * s / steps,
                roof.z + (Math.random() - 0.5) * 2 * LEAN * H * off
            );
            m.userData.below = below;
            list.push(m);
            below = m;
        }
        below.userData.top = true;
    }
    // chains start at a column top in view, then walk down the column to the roof
    set.pickStart = (cands) => {
        const tops = cands.filter(m => m.userData.top);
        const from = tops.length ? tops : cands;
        return from[Math.floor(Math.random() * from.length)];
    };
    set.pickNext = (from, used) => {
        const next = from.userData.below;
        // the steps of a column wrap at slightly different moments (each is a little off in z): two steps on
        // different laps would span the whole street length, so they are never joined
        if (!next || used.has(next) || set.nearWrap(next) || next.userData.wraps !== from.userData.wraps) return null;
        return next; // null above = it has hit the roof (or cannot safely go on)
    };
}

/** Moves the anchors with the city; on = mode 2 is showing (hands them to the lightning, or takes them back). */
export function updateSkyAnchors(flow, on, zMin, len) {
    if (!set) return;
    window.lightningAnchors = on && CONFIG.skyLightning ? set : null;
    if (!on) return;
    for (const m of set.list) {
        m.position.z += flow;
        if (m.position.z >= zMin + len) {
            m.position.z -= len;
            m.userData.wraps++; // bolts anchored to it are dropped (they would stretch across the whole city)
        }
    }
}
