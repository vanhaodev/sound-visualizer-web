// --- CONFIG DÀNH CHO BẠN ---
const CONFIG = {
    sphereCount: 20,         // Số lượng hành tinh icon
    range: 30,               // Độ rộng của vùng không gian (quét rộng ra)
    matrixRainCount: 500,    // Số lượng chữ Matrix rơi
    rotationSpeed: 0.005,    // Tốc độ xoay của cả hệ thống
    bassMaxHz: 150,          // Tần số trên của dải bass (càng nhỏ càng chỉ bắt kick/sub)
    bassThreshold: 180,      // Noise gate (0–255): bass dưới mức này coi như im lặng, không phồng
    pulseRelease: 0.9,       // Tốc độ xẹp sau mỗi nhịp (0–1, càng lớn xẹp càng chậm)
    pulseStrength: 5.0,      // Độ phóng đại hình cầu khi có bass
    glowColor: 0x00ff41,     // Màu quầng sáng quanh hình cầu
    glowStrength: 1.6,       // Độ sáng của glow theo lực kick (>1 = bừng sáng sớm hơn)
    glowSize: 2.2,           // Kích thước glow so với hình cầu khi nghỉ
    glowSpread: 1.8,         // Glow lan rộng thêm bao nhiêu khi kick mạnh nhất
    camMinShot: 6,           // Mỗi góc máy giữ ngẫu nhiên từ camMinShot...
    camMaxShot: 12,          // ...đến camMaxShot giây, rồi mới chờ kick để cắt
    camCutOnKick: 0.75,      // Lực kick (0–1) đủ để bắt đầu chuyển góc máy đúng nhịp
    camBlendTime: 2.5,       // Số giây camera lướt từ góc cũ sang góc mới
    trailMoving: 0.8,        // Độ dài vệt motion blur khi camera đang lướt (0 = tắt, 0.9 = rất dài)
    trailIdle: 0.25          // Độ dài vệt khi camera đứng yên (nhẹ để hình vẫn nét)
};

// Trạng thái dùng chung giữa các file
let scene, camera, renderer, analyser, dataArray, source;
let spheres = [], matrixChars = [], systemGroup, glowMaterial;
let isStarted = false, textures = [];
