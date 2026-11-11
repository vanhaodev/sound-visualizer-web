// Music-reactive chain lightning between the stars, in 3D world space (ES module).
// - Kick -> a chain starts at a star in view and jumps star to star,
//   one hop every chainHopDelay; the harder the kick, the longer the chain
// - Sustained bass keeps firing short chains (denser with louder bass) and makes arcs sprout branches
// - New vocal / lead notes (mid-band onsets) -> short chains of their own
// - Treble (hi-hats) -> quick crackles between two close stars
// - Each source has its own color (CONFIG.lightningColors): kick white, bass violet, vocal pink, lead cyan, hi-hat gold
// - Arcs pulse with the kick envelope (brighter on the beat, dim in between); struck stars flash in the arc's color
// Stars and arcs drift by the same flow, so every arc stays attached to its two stars.
// CONFIG.lightningStyle: 'hd' = full resolution in the main pass | 'pixel' = low-res target for a pixel-art look.
// Exposes window.lightningFx = { update(dt, kick, high, bass, flow, mids), render() }
// and fires window events for optional effects: 'kickstrike' { star, power } when a kick chain starts,
// 'lightningstrike' { star, power, color } every time a star gets hit.

// ?v= must match the asset version in index.html (cache busting, see README "Deployment")
import { zigzag3D, sproutBranch3D } from "./lightning-bolt-geometry-3d.js?v=3";
import { pickStartStar, pickNextStar, zapStar, updateZappedStars } from "./lightning-star-targets.js?v=3";
import { paletteFor, makeOnsetDetector, detectOnset } from "./lightning-frequency-colors.js?v=3";

const PIXEL_H = 240;        // 'pixel' style: vertical resolution of the lightning layer (lower = chunkier pixels)
const RADIAL_SEGS = 5;      // sides of the tube that forms an arc's core
const MAX_PATHS = 24;       // cap on branches per arc
const CRACKLE_LIFE = 0.3;   // seconds a crackle lives (long enough to read its gold color)
const midOnsets = { vocal: makeOnsetDetector(), lead: makeOnsetDetector() };

const flashEl = document.getElementById('flash-layer');
const R = {
    range: (a, b) => a + Math.random() * (b - a),
    chance: (p) => Math.random() < p
};

let boltScene, rt, quadScene, quadCamera, glowTex;
let bolts = [], chains = [];
let chainCooldown = 0, bassChainTimer = 0, crackleCooldown = 0, flash = 0, prevKick = 0;

// Soft round sprite for the glow points
function makeGlowTexture() {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d'), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
}

function resizeTarget() {
    const w = Math.max(1, Math.round(PIXEL_H * window.innerWidth / window.innerHeight));
    rt.setSize(w, PIXEL_H);
}

const isPixel = () => CONFIG.lightningStyle === 'pixel';

// Lazy init: the renderer only exists after the user starts the visualizer
function init() {
    boltScene = new THREE.Scene();
    glowTex = makeGlowTexture();
    if (!isPixel()) return;
    rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    resizeTarget();
    window.addEventListener('resize', resizeTarget);
    quadScene = new THREE.Scene();
    quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
        map: rt.texture, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
    })));
}

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

// A path = a tube core (real thickness) + glow points along it; growth is just the draw range of both
function addPathObjects(b, path) {
    const segs = (path.pts.length - 1) * 2;
    const radius = (isPixel() ? 0.3 : 0.1) * b.size * Math.max(0.35, path.w);
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.pts), segs, radius, RADIAL_SEGS, false);
    const dots = new THREE.BufferGeometry().setFromPoints(path.pts);
    tube.setDrawRange(0, 0);
    dots.setDrawRange(0, 0);
    Object.assign(path, { tube, dots, segs });
    b.group.add(new THREE.Mesh(tube, b.coreMat), new THREE.Points(dots, b.innerMat));
    if (path.w >= 1) b.group.add(new THREE.Points(dots, b.outerMat));
    b.paths.push(path);
}

const wrapsOf = (m) => m.userData.wraps || 0;

// An arc between two stars, from their current positions
function makeArc(from, to, power, band, { jag = 0.22, forks = 0.3 + 0.6 * power, crackle = false } = {}) {
    const a = from.position.clone(), z = to.position.clone();
    const pal = paletteFor(band);
    const b = {
        pal,
        // a star that wraps from z=+50 back to -50 would leave the arc dangling -> remember its wrap count
        ends: [[from, wrapsOf(from)], [to, wrapsOf(to)]],
        group: new THREE.Group(), paths: [], power, crackle, fade: 1, age: 0, restrike: crackle ? 0 : 1,
        branchTimer: 0, dying: false,
        size: crackle ? 0.9 : 0.8 + 0.8 * power,
        outerBase: 1.8 + 2 * power,
        coreMat: new THREE.MeshBasicMaterial({ color: pal.core, ...additive }),
        innerMat: new THREE.PointsMaterial({ color: pal.inner, size: 0.5 + 0.4 * power, map: glowTex, ...additive }),
        outerMat: new THREE.PointsMaterial({ color: pal.outer, size: 1.8 + 2 * power, map: glowTex, ...additive })
    };
    zigzag3D(R, a, z, jag, forks).forEach(p => addPathObjects(b, p));
    if (crackle) b.paths.forEach(p => (p.grow = 1));
    // pin both ends: effects that move stars (shockwave push) leave pinned stars alone so the arc stays attached
    b.ends.forEach(([m]) => (m.userData.arcs = (m.userData.arcs || 0) + 1));
    boltScene.add(b.group);
    bolts.push(b);

    // Too many arcs alive -> the oldest one fades out to make room
    const live = bolts.filter(x => !x.crackle && !x.dying);
    if (live.length > CONFIG.maxArcs) live[0].dying = true;
}

// A star gets hit: flash it, and tell optional effects (e.g. lightning-impact-sparks.js) where and in which color
function strike(m, power, pal) {
    zapStar(m, power, pal.hotInner);
    window.dispatchEvent(new CustomEvent('lightningstrike', { detail: { star: m, power, color: pal.inner } }));
}

function startChain(power, hops, band) {
    const start = pickStartStar();
    if (!start) return null;
    const pal = paletteFor(band);
    strike(start, power, pal);
    chains.push({ cur: start, used: new Set([start]), hopsLeft: hops, timer: 0, power, band, pal });
    return start;
}

// Advance one chain by as many hops as its timer allows; returns false when it's done
function stepChain(c, dt) {
    c.timer -= dt;
    while (c.timer <= 0 && c.hopsLeft > 0) {
        const next = pickNextStar(c.cur, c.used, CONFIG.hopMinDist, CONFIG.hopMaxDist);
        if (!next) return false;
        makeArc(c.cur, next, c.power, c.band);
        strike(next, c.power, c.pal);
        c.used.add(next);
        c.cur = next;
        c.hopsLeft--;
        c.timer += CONFIG.chainHopDelay;
    }
    return c.hopsLeft > 0;
}

function spawnCrackle(power) {
    const a = pickStartStar();
    const b = a && pickNextStar(a, new Set(), 2, 9);
    if (!b) return;
    makeArc(a, b, power, 'hihat', { jag: 0.35, forks: 0.6, crackle: true });
    const gold = paletteFor('hihat');
    strike(a, power * 0.6, gold);
    strike(b, power * 0.6, gold);
}

function disposeBolt(b) {
    b.ends.forEach(([m]) => (m.userData.arcs = Math.max(0, (m.userData.arcs || 0) - 1)));
    boltScene.remove(b.group);
    b.paths.forEach(p => { p.tube.dispose(); p.dots.dispose(); });
    b.coreMat.dispose(); b.innerMat.dispose(); b.outerMat.dispose();
}

// Drift, grow, branch, fade, recolor one arc; returns false once it is gone
function stepBolt(b, dt, kick, bass, bassOn, flow) {
    b.age += dt;
    b.restrike *= Math.exp(-dt * 10);
    b.group.position.z += flow; // drift with the stars -> stays attached to them
    if (b.ends.some(([m, w]) => wrapsOf(m) !== w)) { disposeBolt(b); return false; } // an end wrapped away

    if (b.crackle) {
        b.fade = 1 - b.age / CRACKLE_LIFE;
    } else {
        const speed = CONFIG.boltGrowSpeed * (0.6 + bass);
        for (const p of b.paths) {
            if (!p.parent || p.parent.grow >= p.attach) p.grow = Math.min(1, p.grow + dt * speed * (p.w < 1 ? 1.6 : 1));
        }
        if (bassOn && !b.dying && b.age < CONFIG.boltMaxLife) {
            b.fade = Math.min(1, b.fade + dt * 4);
            if (b.paths[0].grow >= 1 && (b.branchTimer -= dt) <= 0 && b.paths.length < MAX_PATHS) {
                sproutBranch3D(R, b.paths[0]).forEach(p => addPathObjects(b, p));
                b.branchTimer = CONFIG.boltBranchInterval / (0.5 + bass); // louder bass branches faster
            }
        } else {
            b.fade *= Math.exp(-dt * 3 / CONFIG.boltFadeTime); // ~5% left after boltFadeTime
        }
    }
    if (b.fade <= 0.03) { disposeBolt(b); return false; }

    b.paths.forEach(p => {
        // TubeGeometry indices are ordered segment by segment (6 per quad side), so a prefix = the grown part
        p.tube.setDrawRange(0, Math.ceil(p.segs * p.grow) * RADIAL_SEGS * 6);
        p.dots.setDrawRange(0, Math.ceil(p.pts.length * p.grow));
    });
    // Pulse with the music: hot (own hue pushed toward white) on the beat, dim afterglow in between (+ a slight shimmer)
    const beat = Math.max(kick, b.restrike);
    const level = (0.25 + 0.75 * beat) * (0.9 + 0.1 * Math.random());
    const hot = b.restrike > 0.5;
    b.coreMat.color.copy(hot ? b.pal.hotCore : b.pal.core);
    b.coreMat.opacity = b.fade * (0.4 + 0.6 * beat);
    b.innerMat.color.copy(hot ? b.pal.hotInner : b.pal.inner);
    b.innerMat.opacity = b.fade * level;
    b.outerMat.opacity = b.fade * level * 0.5;
    b.outerMat.size = b.outerBase * (0.6 + 1.2 * beat); // the glow swells on every kick
    return true;
}

// kick: 0-1 beat envelope, high: 0-1 treble level, bass: 0-1 sustained bass loudness,
// flow: how far the stars moved along z this frame (already applied to them),
// mids: { vocal, lead } raw band levels 0-255
function update(dt, kick, high, bass, flow, mids = {}) {
    if (!boltScene) init();
    chainCooldown -= dt;
    bassChainTimer -= dt;
    crackleCooldown -= dt;
    const bassOn = bass > CONFIG.boltSustainOn;

    // Existing arcs first (drift by this frame's flow), then new arcs at the stars' current positions
    bolts = bolts.filter(b => stepBolt(b, dt, kick, bass, bassOn, flow));

    // window.lightningOff (set by a mode without lightning, e.g. mode 2): no new chains, live arcs fade out
    if (window.lightningOff) {
        bolts.forEach(b => (b.dying = true));
        chains = [];
        updateZappedStars(dt);
        flash = 0;
        flashEl.style.opacity = '0';
        return;
    }

    // Kick on its rising edge -> a chain, longer for harder kicks; live arcs flare up
    if (kick > CONFIG.chainOnKick && kick > prevKick && chainCooldown <= 0) {
        const hops = Math.round(CONFIG.chainHopsMin + kick * (CONFIG.chainHopsMax - CONFIG.chainHopsMin));
        const star = startChain(kick, hops, 'kick');
        // other effects (e.g. kick-shockwave-rings.js) react to the strike without being wired into this module
        if (star) window.dispatchEvent(new CustomEvent('kickstrike', { detail: { star, power: kick } }));
        bolts.forEach(b => { if (!b.crackle && !b.dying) b.restrike = Math.max(b.restrike, 0.6); });
        flash = Math.max(flash, kick);
        chainCooldown = CONFIG.chainCooldown;
    }
    prevKick = kick;

    // Sustained bass -> short chains keep coming, denser with louder bass
    if (bassOn && bassChainTimer <= 0) {
        startChain(0.3 + 0.5 * bass, 1 + Math.round(bass * 3), 'bass');
        bassChainTimer = CONFIG.chainBassInterval / (0.5 + bass);
    }

    // A new vocal syllable / lead note -> a short chain in that band's color (2-4 hops, longer for a sharper onset)
    for (const band in midOnsets) {
        const k = detectOnset(midOnsets[band], mids[band] || 0, dt);
        if (k > 0) startChain(0.3 + 0.4 * k, 2 + Math.round(k * 2), band);
    }

    if (high > CONFIG.crackleOnHigh && crackleCooldown <= 0) {
        spawnCrackle(high);
        crackleCooldown = 0.12 - 0.08 * Math.min(1, high); // denser treble fires faster
    }

    chains = chains.filter(c => stepChain(c, dt));
    updateZappedStars(dt);

    flashEl.style.opacity = (flash * CONFIG.flashStrength).toFixed(3);
    flash *= Math.pow(0.02, dt); // ~98% drop per second
}

// The stars write depth only (no color) into the low-res target
function setStarColorWrite(on) {
    stars.forEach(m => (m.material.colorWrite = on));
}

// Called right after the main scene is drawn (its depth buffer is still there).
// 'hd': draw straight into the frame, depth-tested against the stars -> one shared 3D space.
// 'pixel': draw into the low-res target after a depth pre-pass of the stars, then add it on top
function render() {
    if (!boltScene || bolts.length === 0) return;
    if (!isPixel()) {
        renderer.render(boltScene, camera);
        return;
    }
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    setStarColorWrite(false);
    renderer.render(scene, camera);
    setStarColorWrite(true);
    renderer.render(boltScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCamera);
}

window.lightningFx = { update, render };
