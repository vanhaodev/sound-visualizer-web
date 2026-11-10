// Texture glow: gradient tròn sáng ở tâm, mờ dần ra rìa (dùng chung cho mọi hình cầu)
function createGlowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

// Dựng scene Three.js: các hình cầu gắn ảnh + glow + Matrix rain
function init3DEngine() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // preserveDrawingBuffer: giữ khung trước để vẽ vệt motion blur
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    initMotionTrail();

    systemGroup = new THREE.Group();
    scene.add(systemGroup);

    // Một material glow dùng chung → chỉnh opacity 1 lần/khung hình cho tất cả.
    // AdditiveBlending: cộng sáng chồng lên nền, tạo cảm giác bừng sáng
    glowMaterial = new THREE.SpriteMaterial({
        map: createGlowTexture(),
        color: CONFIG.glowColor,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0
    });

    // 1. Tạo các tiểu hành tinh hình cầu (Spheres)
    for (let i = 0; i < CONFIG.sphereCount; i++) {
        // SphereGeometry(bán kính, số lưới ngang, số lưới dọc)
        const geo = new THREE.SphereGeometry(1, 32, 32);
        const mat = new THREE.MeshBasicMaterial({
            map: textures[i % textures.length],
            transparent: true,
            opacity: 0.9
        });
        const sphere = new THREE.Mesh(geo, mat);

        // Đặt vị trí ngẫu nhiên như thiên thạch
        sphere.position.set(
            (Math.random() - 0.5) * CONFIG.range * 2,
            (Math.random() - 0.5) * CONFIG.range * 2,
            (Math.random() - 0.5) * CONFIG.range * 2
        );

        // Glow là con của hình cầu → tự đi theo vị trí và scale của nó
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.setScalar(CONFIG.glowSize);
        sphere.add(glow);

        spheres.push({
            mesh: sphere,
            glow: glow,
            baseY: sphere.position.y,           // vị trí gốc để rung lắc quanh nó
            rotS: (Math.random() - 0.5) * 0.02, // Tốc độ xoay tự thân ngẫu nhiên
            offset: Math.random() * Math.PI     // Tạo độ lệch nhịp đập
        });
        systemGroup.add(sphere);
    }

    // 2. Tạo Matrix Rain lơ lửng
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < CONFIG.matrixRainCount; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ff41';
        ctx.font = '24px monospace';
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], 5, 25);

        const txt = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: txt, color: 0x00ff41, transparent: true, opacity: 0.5 });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        matrixChars.push(sprite);
        scene.add(sprite);
    }

    camera.position.z = 40;
}
