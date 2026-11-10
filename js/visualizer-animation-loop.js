// Trạng thái bộ dò nhịp
let bassAvg = 0; // trung bình trượt của bass → phân biệt kick (đột biến) với bass kéo dài
let pulse = 0;   // envelope 0–1: bật ngay khi có kick, xẹp dần theo pulseRelease

// Mức bass trung bình (0–255) trong dải 20Hz → bassMaxHz, bỏ ngăn 0 (DC)
function getBassLevel() {
    analyser.getByteFrequencyData(dataArray);
    const binHz = analyser.context.sampleRate / analyser.fftSize;
    const maxBin = Math.max(2, Math.round(CONFIG.bassMaxHz / binHz));
    let sum = 0;
    for (let i = 1; i <= maxBin; i++) sum += dataArray[i];
    return sum / maxBin;
}

// Độ phồng 0–1 có tính âm lượng: âm nhỏ dưới ngưỡng = 0, kick to + đột biến = mạnh nhất
function computeIntensity(lowEnd) {
    const loudness = Math.max(0, lowEnd - CONFIG.bassThreshold) / (255 - CONFIG.bassThreshold);
    const punch = Math.min(1, Math.max(0, lowEnd - bassAvg) / 40); // mức vọt so với nền gần đây
    bassAvg += (lowEnd - bassAvg) * 0.05;

    const target = loudness * (0.4 + 0.6 * punch);
    pulse = target > pulse ? target : pulse * CONFIG.pulseRelease;
    return pulse;
}

// Vòng lặp render: đọc phổ âm thanh, cho các vật thể phản ứng theo bass
function animate() {
    if (!isStarted) return;
    requestAnimationFrame(animate);

    const intensity = computeIntensity(getBassLevel());

    // Glow bừng sáng theo lực kick; bình phương để nhịp nhẹ gần như không sáng, kick mạnh mới bùng
    glowMaterial.opacity = Math.min(1, intensity * intensity * CONFIG.glowStrength);
    const glowScale = CONFIG.glowSize + intensity * CONFIG.glowSpread;

    // CHỈ CÁC HÀNH TINH BỊ TÁC ĐỘNG BỞI BASS
    spheres.forEach((s) => {
        // scale giờ đây chỉ nhảy khi có trống (kick) hoặc bass mạnh
        const scale = 1 + (intensity * CONFIG.pulseStrength);
        s.mesh.scale.set(scale, scale, scale);
        s.glow.scale.setScalar(glowScale); // tương đối so với hình cầu (sprite là con)

        // Rung lắc quanh vị trí gốc theo bass (không cộng dồn → hành tinh không trôi dần khỏi cụm)
        s.mesh.position.y = s.baseY + Math.sin(Date.now() * 0.005 + s.offset) * intensity * 1.5;
    });

    // Matrix Rain cũng trôi nhanh hơn khi có Low-end
    matrixChars.forEach(mc => {
        mc.position.z += 0.05 + (intensity * 0.8);
        if (mc.position.z > 50) mc.position.z = -50;
    });

    systemGroup.rotation.y += CONFIG.rotationSpeed;
    const moving = updateCameraDirector(intensity); // góc máy + chuyển cảnh mượt + rung theo kick
    renderWithMotionTrail(moving);
}

window.onresize = () => {
    if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
};
