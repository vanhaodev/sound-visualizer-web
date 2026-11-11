// Fake motion blur (afterimage): instead of clearing, cover the previous frame with a translucent deep-space quad,
// then draw the new frame on top -> moving things leave trails. No post-processing library needed.
// Requires the renderer to be created with preserveDrawingBuffer: true (keeps the previous frame between draws)

let fadeScene, fadeCamera, fadeMaterial;

function initMotionTrail() {
    renderer.autoClear = false;
    fadeScene = new THREE.Scene();
    fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    fadeMaterial = new THREE.MeshBasicMaterial({
        color: 0x03040d, transparent: true, depthTest: false, depthWrite: false // near-black navy = space
    });
    fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMaterial));
}

// moving: 0-1 (how much the camera is mid-transition). Long trails while gliding, almost none when still
function renderWithMotionTrail(moving) {
    // capped below 1: at 1 the old frame would never fade and the screen would smear forever
    const persist = Math.min(0.95, (CONFIG.trailIdle + (CONFIG.trailMoving - CONFIG.trailIdle) * moving) * CONFIG.motionBlur);
    fadeMaterial.opacity = 1 - persist; // less black cover -> more of the old frame remains

    renderer.render(fadeScene, fadeCamera); // fade the old frame
    renderer.clearDepth();                  // clear depth so the old frame doesn't occlude the new one
    renderer.render(scene, camera);
    if (window.lightningFx) window.lightningFx.render(); // lightning on top, also leaves trails
}
