// Mode 2 city: dark buildings on both sides of the giant's path whose windows work like a giant equalizer
// (each tower lights up from the ground as high as its frequency band is loud), with a few dim windows flickering
// above, plus the street itself (giant-city-street.js: road markings, street lamps, panicking cars).
// Built to be as light as possible:
// - every building is one instance of a single box -> one InstancedMesh = one draw call for the whole city
// - no window geometry, no textures, no lights: the fragment shader draws a window grid on each facade from its
//   coordinates and a hash decides which windows are lit, which switch slowly, which flicker, which flash
// - zero per-building CPU work: everything flows past at her walking pace and wraps around in the vertex shader;
//   JS only updates a few shared uniforms per frame (time, flow offset, kick, beat count)
// Optional (ES module): CONFIG.cityBuildings = 0 or remove its <script> tag in index.html.
// Exposes window.cityFx = { update(dt, flow, intensity) }, called by the animation loop.

import { CITY, WRAP_GLSL, FOG_GLSL, makeSharedUniforms } from "./giant-city-layout.js?v=10";
import { buildStreet } from "./giant-city-street.js?v=10";
import { buildSkyAnchors, updateSkyAnchors } from "./giant-city-sky-anchors.js?v=10";

// Every building is one bar of a giant equalizer: its windows light up from the ground to a height that follows the
// level of its frequency band (quiet -> a few floors, loud -> the whole tower). Bands are log-spaced.
// Punch comes from three things on top of the bars:
// - the kick pumps every tower at once (height + brightness), so the beat reads across the whole city
// - a white peak cap per band holds for a moment then falls slowly, like a real equalizer
// - more towers follow the low bands (bass, drums: the rhythmic part) than the hiss of the top octaves
const BANDS = 24, BAND_MIN_HZ = 40, BAND_MAX_HZ = 12000;
const PEAK_HOLD = 0.35, PEAK_FALL = 0.7; // seconds the cap holds, then how fast it falls (tower heights per second)
const bandLevels = new Float32Array(BANDS), bandCaps = new Float32Array(BANDS), capHold = new Float32Array(BANDS);

const VERT = WRAP_GLSL + /* glsl */`
uniform float uBands[${BANDS}], uCaps[${BANDS}];
uniform float uKick, uKickPump;
varying vec3 vLocal, vSeed, vNormal, vWorld;
varying float vHeight, vLevel, vCap;
void main() {
    vec3 c = instanceMatrix[3].xyz;   // building center (boxes are never rotated)
    // this building's band from its seed, weighted toward the low bands (pow > 1); read here because vertex
    // shaders may index uniform arrays freely
    float r = fract(sin(dot(c, vec3(4.898, 7.23, 1.31))) * 43758.5453);
    int band = int(floor(pow(r, 1.6) * ${BANDS}.0));
    vLevel = min(1.0, uBands[band] + uKick * uKickPump); // the kick lifts every tower together
    vCap = uCaps[band];
    float z = wrapZ(c.z);
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    wp.z += z - c.z;
    vLocal = wp.xyz - vec3(c.x, c.y, z); // moves with the building -> windows stay put on it
    vSeed = c;                           // stable per-building random seed
    vHeight = instanceMatrix[1].y;
    vNormal = normal;
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = FOG_GLSL + /* glsl */`
uniform float uTime, uFloor, uWinW, uKick, uGlow;
uniform vec3 uFacade;
varying vec3 vLocal, vSeed, vNormal, vWorld;
varying float vHeight, vLevel, vCap;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
    vec3 n = abs(vNormal);
    vec3 col = uFacade * (n.y > 0.5 ? 0.6 : 1.0);    // roofs a bit darker
    if (n.y < 0.5) {
        float h = n.x > 0.5 ? vLocal.z : vLocal.x;   // horizontal coordinate along this facade
        float y = vLocal.y + vHeight * 0.5;          // height above the building's base
        vec2 cell = vec2(floor(h / uWinW), floor(y / uFloor));
        vec2 f = vec2(fract(h / uWinW), fract(y / uFloor));
        float inWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.8)
                    * step(uFloor, y) * step(y, vHeight - uFloor * 0.5); // none at street level / roof edge
        vec3 id = vec3(cell, n.x * 7.0) + vSeed;
        // equalizer bar: every window from the first floor up to vLevel of the window zone is lit
        float zone = max(uFloor, vHeight - uFloor * 1.5);           // height of the window zone
        float rowTop = (cell.y * uFloor) / zone;                   // where this row sits in the zone (0-1)
        float rowH = uFloor / zone;                                // one row, as a fraction of the zone
        float bar = step(rowTop, vLevel) * step(0.02, vLevel);
        float peak = bar * step(vLevel - rowH, rowTop);            // top row of the bar: brighter
        float cap = step(0.05, vCap) * step(rowTop, vCap) * step(vCap - rowH, rowTop); // the row holding the cap
        // quiet ambience above the bar: ~8% of the windows, dim, switching slowly, a few flickering
        float rate = 0.03 + 0.12 * hash(id + 1.3);
        float ambient = step(0.92, hash(id + floor(uTime * rate + hash(id) * 10.0)));
        if (hash(id + 7.1) > 0.97) ambient *= step(0.35, fract(sin(uTime * 23.0 + hash(id) * 60.0) * 43758.5));
        vec3 warm = vec3(1.0, 0.78, 0.45), cool = vec3(0.62, 0.75, 1.0);
        vec3 win = mix(warm, cool, step(0.78, hash(id + 2.7))) * (0.7 + 0.3 * hash(id + 4.2));
        float pump = 1.0 + 0.8 * uKick;                            // lit windows flare on the kick
        col += win * max(bar * (1.0 + peak * 0.8) * pump, ambient * 0.35) * inWin;
        // light spilling onto the facade around the lit windows (windows cover only ~30% of a wall): the bar reads
        // as one glowing column even from far away, stronger toward its top and on the kick
        float barZone = step(uFloor, y) * step(rowTop, vLevel) * step(0.02, vLevel);
        col += win * barZone * uGlow * (0.5 + 0.5 * rowTop / max(vLevel, 0.05)) * pump;
        col += mix(win, vec3(1.0), 0.6) * cap * 1.5 * inWin;       // white-hot falling peak cap
    }
    gl_FragColor = vec4(fogged(col, vWorld), 1.0);
}`;

let shared = null;

// Spectrum -> BANDS bar levels 0-1, measured against each band's OWN long-term level (so treble bands, always
// quieter in bytes than the bass, behave like the bass): a band at its usual level fills ~1/3 of its tower, only
// clearly louder moments reach the top. Average and peak are remembered for ~10-20 s, so the song's dynamics show:
// a quiet verse keeps low towers, the chorus lights them up (a short memory would make every part look equally
// busy, flattening the song). Fast rise, smooth fall.
const bandAvgs = new Float32Array(BANDS).fill(100), bandPeaks = new Float32Array(BANDS).fill(140);
const BASE_BELOW_AVG = 12; // bytes under the average where a bar starts (a quiet dip -> almost empty)
function updateBands(dt) {
    const binHz = analyser.context.sampleRate / analyser.fftSize, ratio = BAND_MAX_HZ / BAND_MIN_HZ;
    for (let b = 0; b < BANDS; b++) {
        const lo = Math.max(1, Math.floor(BAND_MIN_HZ * Math.pow(ratio, b / BANDS) / binHz));
        const hi = Math.min(dataArray.length - 1, Math.max(lo + 1, Math.floor(BAND_MIN_HZ * Math.pow(ratio, (b + 1) / BANDS) / binHz)));
        let sum = 0;
        for (let i = lo; i <= hi; i++) sum += dataArray[i];
        const v = sum / (hi - lo + 1);
        bandAvgs[b] += (v - bandAvgs[b]) * Math.min(1, dt * 0.08);                   // ~12 s running average
        const base = bandAvgs[b] - BASE_BELOW_AVG;
        bandPeaks[b] = Math.max(v, base + 40, bandPeaks[b] - 1.5 * dt);             // slow fall; at least 40 above base
        const rel = Math.min(1, Math.max(0, (v - base) / (bandPeaks[b] - base)));
        const target = Math.pow(rel, 1.4) * CONFIG.cityBarGain;                     // curve: keeps the top for real peaks
        bandLevels[b] = target > bandLevels[b] ? target : bandLevels[b] + (target - bandLevels[b]) * Math.min(1, dt * 9);
        // peak cap: jumps up with the bar, holds PEAK_HOLD seconds, then falls slowly
        if (bandLevels[b] >= bandCaps[b]) { bandCaps[b] = bandLevels[b]; capHold[b] = PEAK_HOLD; }
        else if ((capHold[b] -= dt) < 0) bandCaps[b] = Math.max(bandLevels[b], bandCaps[b] - PEAK_FALL * dt);
    }
}

let kickUniform = null, kick = 0;
const roofTops = []; // top-center of every building (layout positions), filled by buildBuildings

function buildBuildings(w) {
    const H = w.height, cell = CITY.cell * H;
    const rows = Math.floor(CITY.length / CITY.cell), cols = Math.floor((CITY.outer - CITY.corridor) / CITY.cell);
    const zMin = shared.uZMin.value, mats = [], m = new THREE.Matrix4();
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < cols; i++) {
            const t = i / cols; // 0 = by the street, 1 = city edge
            for (let j = 0; j < rows; j++) {
                if (Math.random() > 0.55) continue; // gaps between buildings
                const wd = cell * (0.45 + 0.4 * Math.random()), dp = cell * (0.45 + 0.4 * Math.random());
                // mostly low blocks, a few towers, a slightly taller skyline away from the street
                const ht = H * (0.05 + 0.35 * Math.pow(Math.random(), 2.2)) * (0.7 + 0.6 * t);
                const x = w.anchor.x + side * (CITY.corridor * H + (i + 0.5) * cell);
                mats.push(m.clone().makeScale(wd, ht, dp).setPosition(x, w.anchor.y + ht / 2, zMin + (j + 0.5) * cell));
            }
        }
    }
    // keep a random subset when the grid has more spots than allowed
    for (let i = mats.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [mats[i], mats[k]] = [mats[k], mats[i]]; }
    const count = Math.min(mats.length, CONFIG.cityBuildings);

    kickUniform = { value: 0 };
    const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: {
            ...shared,
            uBands: { value: bandLevels }, uCaps: { value: bandCaps }, // the same arrays every frame -> just refilled
            uKick: kickUniform, uKickPump: { value: CONFIG.cityKickPump },
            uGlow: { value: CONFIG.cityGlow },
            uFloor: { value: 3.5 * CONFIG.cityWindowSize }, uWinW: { value: 3 * CONFIG.cityWindowSize },
            uFacade: { value: new THREE.Color(0x07080f) }
        }
    });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, count);
    roofTops.length = 0;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        mesh.setMatrixAt(i, mats[i]);
        mats[i].decompose(p, q, s);
        roofTops.push(new THREE.Vector3(p.x, p.y + s.y / 2, p.z)); // where vertical sky lightning can strike
    }
    return mesh;
}

let group = null;

function build(w) {
    shared = makeSharedUniforms(w);
    group = new THREE.Group();
    group.add(buildBuildings(w), ...buildStreet(w, shared));
    buildSkyAnchors(w, shared, roofTops); // the sky lightning's anchor points, pinned to the city
    // everything moves in the shaders, so the CPU-side bounds are wrong: never cull
    group.traverse(o => (o.frustumCulled = false));
    scene.add(group);
}

// flow: how far the world moved along z this frame (her walking pace), intensity: 0-1 kick envelope;
// reads the spectrum in dataArray
function update(dt, flow, intensity) {
    const w = window.walker;
    const on = visualMode === 2 && w && w.ready && CONFIG.cityBuildings > 0;
    if (on && !group) build(w);
    if (!group) return;
    group.visible = on;
    updateSkyAnchors(flow, on, shared.uZMin.value, shared.uLength.value); // also hands them back in mode 1
    if (!on) return;
    shared.uOffset.value += flow;
    shared.uTime.value += dt;
    shared.uPx.value = renderer.domElement.height / 2; // glow sizes stay right on resize / picture-in-picture
    updateBands(dt);
    // the kick envelope, snappy up and quick down so the whole city "hits" on the beat
    kick = intensity > kick ? intensity : kick + (intensity - kick) * Math.min(1, dt * 14);
    kickUniform.value = kick;
}

window.cityFx = { update };
