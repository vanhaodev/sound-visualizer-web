// Three.js scene: a starfield floating in space (lightning has its own scene, see music-reactive-lightning.js)

// Real star tints, kept light (no dark/saturated tones): pale blue -> white -> pale gold/peach, a rare pale violet;
// repeats = more common
const STAR_COLORS = ['#d6e0ff', '#e3eaff', '#e3eaff', '#ffffff', '#ffffff', '#ffffff', '#ffffff',
    '#fff8f0', '#fff8f0', '#ffeacc', '#ffe0c2', '#ece0ff'];

// One dot shared by every star: small crisp core + thin halo (a wide halo reads as a milky blob, not a star)
function makeStarTexture() {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d'), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.08, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
}

function init3DEngine() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // preserveDrawingBuffer: keep the previous frame so the motion blur trail can be drawn
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    initMotionTrail();

    const tex = makeStarTexture();
    for (let i = 0; i < CONFIG.starCount; i++) {
        const color = new THREE.Color(STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]);
        const opacity = 0.8 + Math.random() * 0.2;
        // additive: stars add light (crisp points) instead of painting an opaque disc over the background;
        // alphaTest: only the bright core writes depth (not the faint halo), so stars occlude bolts precisely
        const mat = new THREE.SpriteMaterial({
            map: tex, color: color.clone(), transparent: true, opacity, alphaTest: 0.1,
            blending: THREE.AdditiveBlending
        });
        const star = new THREE.Sprite(mat);
        // mostly tiny stars, a few bigger bright ones
        star.scale.setScalar(Math.random() < 0.08 ? 0.6 + Math.random() * 0.4 : 0.15 + Math.random() * 0.25);
        star.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        // own color/brightness to return to after a lightning flash, and a twinkle rhythm
        star.userData.baseColor = color;
        star.userData.baseOpacity = opacity;
        star.userData.twinkle = { speed: 1 + Math.random() * 3, phase: Math.random() * Math.PI * 2 };
        stars.push(star);
        scene.add(star);
    }
}
