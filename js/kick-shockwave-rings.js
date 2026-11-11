// Kick shockwave: on a strong kick, a glowing ring bursts out from the star the kick lightning starts at,
// and stars the wave front passes get shoved outward, then spring back to where they were.
// Optional effect (ES module): listens to the 'kickstrike' event of music-reactive-lightning.js.
// Disable with CONFIG.shockwaveEnabled = false, or remove its <script> tag in index.html.
// Exposes window.shockwaveFx = { update(dt, flow) }, called by the animation loop.

const RING_PEAK = 0.9;   // where the bright band sits in the texture (fraction of its radius)
const FRONT_WIDTH = 3;   // thickness (world units) of the wave front that pushes stars
const SPRING_K = 40;     // pull back to the rest position (higher = snappier return)
const SPRING_DAMP = 8;   // damping (higher = less wobble)

let ringTex = null;
const rings = [];
const pushed = new Set(); // stars currently displaced: userData.push = offset, userData.pushVel = velocity
const _dir = new THREE.Vector3();

// Soft ring: faint energy fill inside, bright band near the edge, nothing outside
function makeRingTexture() {
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d'), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    grad.addColorStop(RING_PEAK, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
}

function spawnRing({ star, power }) {
    if (!CONFIG.shockwaveEnabled || power < CONFIG.shockwaveOnKick || !scene) return;
    if (!ringTex) ringTex = makeRingTexture();
    if (rings.length >= CONFIG.shockwaveMax) removeRing(rings[0]);
    // a camera-facing sprite = how a spherical shell looks from any angle
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTex, color: new THREE.Color(CONFIG.shockwaveColor), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.position.copy(star.position);
    scene.add(sprite);
    rings.push({ sprite, power, age: 0, radius: 0 });
}

function removeRing(r) {
    scene.remove(r.sprite);
    r.sprite.material.dispose();
    rings.splice(rings.indexOf(r), 1);
}

// Kick every star near the wave front outward (stars pinned by a lightning arc stay put)
function pushStars(r, dt) {
    const strength = CONFIG.shockwavePush * r.power * (1 - r.age / CONFIG.shockwaveLife);
    for (const s of stars) {
        if (s.userData.arcs) continue;
        const d = s.position.distanceTo(r.sprite.position);
        const off = (d - r.radius) / FRONT_WIDTH;
        if (off < -1 || off > 1 || d < 0.01) continue;
        const ud = s.userData;
        if (!ud.push) { ud.push = new THREE.Vector3(); ud.pushVel = new THREE.Vector3(); }
        _dir.subVectors(s.position, r.sprite.position).divideScalar(d);
        ud.pushVel.addScaledVector(_dir, strength * (1 - off * off) * dt);
        pushed.add(s);
    }
}

// Spring each displaced star back; the offset is applied on top of its normal position (flow keeps working)
function relaxStars(dt) {
    for (const s of pushed) {
        const ud = s.userData;
        if (ud.arcs) continue; // pinned by an arc: freeze where it is until the arc is gone
        s.position.sub(ud.push);
        ud.pushVel.addScaledVector(ud.push, -SPRING_K * dt).multiplyScalar(Math.exp(-SPRING_DAMP * dt));
        ud.push.addScaledVector(ud.pushVel, dt);
        s.position.add(ud.push);
        if (ud.push.lengthSq() < 1e-4 && ud.pushVel.lengthSq() < 1e-3) {
            s.position.sub(ud.push);
            ud.push.set(0, 0, 0);
            ud.pushVel.set(0, 0, 0);
            pushed.delete(s);
        }
    }
}

// flow: how far the stars drifted along z this frame -> the rings drift with them
function update(dt, flow) {
    for (const r of [...rings]) {
        r.age += dt;
        const t = r.age / CONFIG.shockwaveLife;
        if (t >= 1) { removeRing(r); continue; }
        r.sprite.position.z += flow;
        r.radius = CONFIG.shockwaveRadius * (0.4 + 0.6 * r.power) * (1 - Math.pow(1 - t, 3)); // fast burst, slows down
        r.sprite.scale.setScalar(Math.max(0.01, 2 * r.radius / RING_PEAK));
        r.sprite.material.opacity = (1 - t) * (1 - t) * (0.5 + 0.5 * r.power);
        if (CONFIG.shockwavePush > 0) pushStars(r, dt);
    }
    relaxStars(dt);
}

window.addEventListener('kickstrike', e => spawnRing(e.detail));
window.shockwaveFx = { update };
