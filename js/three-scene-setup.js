// Three.js scene: floating Matrix rain (lightning has its own scene, see music-reactive-lightning.js)
function init3DEngine() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // preserveDrawingBuffer: keep the previous frame so the motion blur trail can be drawn
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    initMotionTrail();

    const chars = "0123456789ABCDEF";
    for (let i = 0; i < CONFIG.matrixRainCount; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ff41';
        ctx.font = '24px monospace';
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], 5, 25);

        const txt = new THREE.CanvasTexture(canvas);
        // alphaTest: only the glyph itself writes depth (not its transparent square), so it occludes bolts precisely
        const mat = new THREE.SpriteMaterial({ map: txt, color: 0x00ff41, transparent: true, opacity: 0.5, alphaTest: 0.3 });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        matrixChars.push(sprite);
        scene.add(sprite);
    }
}
