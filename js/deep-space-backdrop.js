// Deep-space backdrop: thousands of far-away stars on a huge shell around the scene, drawn as one THREE.Points.
// Gives depth behind the interactive starfield (the 100-unit cube the lightning jumps through), and is what fills
// the frame when the mode 2 camera films the giant from far outside that cube.
// Centered on the camera like a sky: never any parallax, never left behind. Not touched by lightning or effects.
// Optional (ES module): set CONFIG.backdropStars = 0 or remove its <script> tag in index.html.

const INNER = 300, OUTER = 900; // shell radii (the camera far plane is 1000)

// Two layers: many faint pin-points + a few brighter ones (PointsMaterial has one size per object).
// half: +1 = upper hemisphere only, -1 = lower only (the lower half can be hidden when there is a ground)
function makeLayer(count, size, brightness, half) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
        // uniform direction in the chosen hemisphere, radius between the shells
        const u = half * Math.random(), a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const r = INNER + Math.random() * (OUTER - INNER);
        pos.set([s * Math.cos(a) * r, u * r, s * Math.sin(a) * r], i * 3);
        c.set(STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)])
            .multiplyScalar(brightness * (0.5 + 0.5 * Math.random()));
        col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size, sizeAttenuation: false, map: makeStarTexture(), vertexColors: true,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    pts.renderOrder = -1; // behind everything else
    // a sky, not an object: it moves with the camera, so no shot (even the far mode 2 telephoto) ever leaves it.
    // Runs just before drawing, so the position applies from the next frame on (invisible at this distance)
    pts.onBeforeRender = (r, s, cam) => pts.position.copy(cam.position);
    return pts;
}

const lowerHalf = [];

window.addEventListener('visualizerstart', () => {
    const n = CONFIG.backdropStars;
    if (!n) return;
    for (const half of [1, -1]) {
        const layers = [makeLayer(Math.round(n * 0.45), 2.5, 0.8, half), makeLayer(Math.round(n * 0.05), 5, 1, half)];
        scene.add(...layers);
        if (half < 0) lowerHalf.push(...layers);
    }
});

// A scene with a ground (mode 2's city) hides the stars below the horizon: no stars under her feet
window.backdropFx = { showBelowHorizon: (on) => lowerHalf.forEach(p => (p.visible = on)) };
