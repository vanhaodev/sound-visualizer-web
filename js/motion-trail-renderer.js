// Motion blur giả lập bằng vệt mờ (afterimage): không xoá khung cũ mà phủ lên một lớp đen bán trong suốt,
// khung mới vẽ đè lên → vật chuyển động để lại vệt. Không cần thêm thư viện post-processing.
// Yêu cầu renderer tạo với preserveDrawingBuffer: true (giữ lại khung trước giữa các lần vẽ)

let fadeScene, fadeCamera, fadeMaterial;

function initMotionTrail() {
    renderer.autoClear = false;
    fadeScene = new THREE.Scene();
    fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    fadeMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, depthTest: false, depthWrite: false
    });
    fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMaterial));
}

// moving: 0–1 (camera đang chuyển cảnh bao nhiêu). Vệt dài khi máy lướt, gần như tắt khi đứng yên
function renderWithMotionTrail(moving) {
    const persist = CONFIG.trailIdle + (CONFIG.trailMoving - CONFIG.trailIdle) * moving;
    fadeMaterial.opacity = 1 - persist; // càng ít phủ đen → khung cũ còn lại càng nhiều

    renderer.render(fadeScene, fadeCamera); // làm mờ khung cũ
    renderer.clearDepth();                  // xoá depth để khung mới không bị khung cũ che
    renderer.render(scene, camera);
}
