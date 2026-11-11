// Impact sparks: wherever lightning hits a star, a burst of sparks in the arc's color flies out,
// starts white-hot, cools to the band color, slows down and dies out (so the frequency colors read clearly).
// Optional effect (ES module): listens to the 'lightningstrike' event of music-reactive-lightning.js.
// Disable with CONFIG.sparksEnabled = false, or remove its <script> tag in index.html.
// Exposes window.sparksFx = { update(dt, flow) }, called by the animation loop.
// All sparks live in one fixed pool drawn as a single THREE.Points (one draw call, no allocations per spark).

const DRAG = 3;  // how fast sparks slow down (per second)
const WHITE = new THREE.Color(1, 1, 1);

let points = null, pos, col, vel, life, maxLife, base, next = 0, alive = 0;
const _c = new THREE.Color();

// Lazy init: the scene only exists after the user starts the visualizer
function init() {
    const n = CONFIG.sparkMax;
    pos = new Float32Array(n * 3);
    col = new Float32Array(n * 3);              // black = invisible under additive blending
    vel = new Float32Array(n * 3);
    life = new Float32Array(n);                 // seconds left (0 = dead)
    maxLife = new Float32Array(n);
    base = Array.from({ length: n }, () => new THREE.Color());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: CONFIG.sparkSize, map: makeStarTexture(), vertexColors: true,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    points.frustumCulled = false; // sparks fly everywhere; the bounding sphere is never recomputed
    scene.add(points);
}

function burst({ star, power, color }) {
    if (!CONFIG.sparksEnabled || !scene) return;
    if (!points) init();
    const count = Math.max(2, Math.round(CONFIG.sparkCount * power));
    for (let k = 0; k < count; k++) {
        const i = next;
        next = (next + 1) % CONFIG.sparkMax; // pool full -> recycle the oldest spark
        // random direction on a sphere, random speed: a few fast streaks, many slow embers
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const speed = CONFIG.sparkSpeed * (0.3 + 0.7 * Math.random()) * (0.6 + 0.4 * power);
        pos[i * 3] = star.position.x; pos[i * 3 + 1] = star.position.y; pos[i * 3 + 2] = star.position.z;
        vel[i * 3] = r * Math.cos(a) * speed; vel[i * 3 + 1] = r * Math.sin(a) * speed; vel[i * 3 + 2] = u * speed;
        maxLife[i] = life[i] = CONFIG.sparkLife * (0.5 + 0.5 * Math.random());
        base[i].copy(color);
    }
}

// flow: how far the stars drifted along z this frame -> sparks drift with them
function update(dt, flow) {
    if (!points) return;
    const drag = Math.exp(-DRAG * dt);
    alive = 0;
    for (let i = 0; i < CONFIG.sparkMax; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        alive++;
        for (let j = 0; j < 3; j++) {
            vel[i * 3 + j] *= drag;
            pos[i * 3 + j] += vel[i * 3 + j] * dt;
        }
        pos[i * 3 + 2] += flow;
        // white-hot at birth -> band color -> fades out
        const t = 1 - life[i] / maxLife[i];
        _c.copy(WHITE).lerp(base[i], Math.min(1, t * 3)).multiplyScalar((1 - t) * (1 - t));
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
}

window.addEventListener('lightningstrike', e => burst(e.detail));
window.sparksFx = { update, alive: () => alive };
