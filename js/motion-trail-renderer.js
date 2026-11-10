// Fake motion blur (afterimage): instead of clearing, cover the previous frame with a translucent black quad,
// then draw the new frame on top -> moving things leave trails. No post-processing library needed.
// Requires the renderer to be created with preserveDrawingBuffer: true (keeps the previous frame between draws)

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

// moving: 0-1 (how much the camera is mid-transition). Long trails while gliding, almost none when still
function renderWithMotionTrail(moving) {
    const persist = CONFIG.trailIdle + (CONFIG.trailMoving - CONFIG.trailIdle) * moving;
    fadeMaterial.opacity = 1 - persist; // less black cover -> more of the old frame remains

    renderer.render(fadeScene, fadeCamera); // fade the old frame
    renderer.clearDepth();                  // clear depth so the old frame doesn't occlude the new one
    renderer.render(scene, camera);
    if (window.lightningFx) window.lightningFx.render(); // lightning on top, also leaves trails
}
