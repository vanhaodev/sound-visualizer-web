// Mode 2: a galactic giant walks through space (CONFIG.walkerModel, a GLB with an in-place walk loop).
// She stands still at CONFIG.walkerZ facing -z while the stars flow past her, so it reads as walking forward;
// the camera films her with WALKER_SHOTS (camera-walker-follow-shots.js). No lightning in this mode
// (window.lightningOff), only the starfield and her. Invisible in mode 1.
// Giant feel: huge (CONFIG.walkerHeight) and in slow motion (CONFIG.walkerAnimSpeed) - big things move slowly.
// Optional effect (ES module): remove its <script> tag in index.html to drop mode 2 (it then falls back to mode 1).
// Needs THREE.GLTFLoader (examples/js/loaders/GLTFLoader.js r128, loaded in index.html).
// Exposes window.walker = { anchor, height, ready } once loaded, and window.walkerFx = { update(dt, intensity), flow(dt) }.

const FACING = Math.PI; // turn so she faces -z (glTF models face +z)

let root = null, mixer = null, keyLight = null, fillLight = null, shownMode2 = null;
// Master light (CONFIG.walkerLook.brightness): multiplies her final pixel color at the very end of her shader.
// Scaling the lights is not enough: with a metallic material she is only specular highlights, already clipped
// to white, so dimming the lights changes nothing visible. This dims (or boosts) everything, highlights included.
const masterLight = { value: 1 };
function addMasterDimmer(m) {
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uMasterLight = masterLight;
        shader.fragmentShader = 'uniform float uMasterLight;\n' + shader.fragmentShader.replace(
            '#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.rgb *= uMasterLight;');
    };
}

// Lights only affect her (the stars and the city use unlit materials); placed in units of her height.
// Strengths and colors come from CONFIG.walkerLook
function addLights(anchor, H) {
    const L = CONFIG.walkerLook;
    scene.add(new THREE.HemisphereLight(L.ambientSky, L.ambientGround, L.ambient));
    keyLight = new THREE.DirectionalLight(L.keyColor, L.key);
    keyLight.position.set(anchor.x - 0.75 * H, anchor.y + 2 * H, anchor.z - 1.5 * H); // front-left, above
    const rim = new THREE.DirectionalLight(L.rimColor, L.rim);
    rim.position.set(anchor.x + 0.5 * H, anchor.y + 1.5 * H, anchor.z + 1.8 * H);     // from behind
    fillLight = new THREE.DirectionalLight(L.fillColor, L.fill);                      // follows the camera (update)
    const chest = anchor.clone().setY(anchor.y + 0.6 * H);
    for (const l of [keyLight, rim, fillLight]) { l.target.position.copy(chest); scene.add(l, l.target); }
}

// Bounds of what actually gets drawn. Box3.setFromObject reads the static geometry, which for a skinned mesh can be
// way off (a Mixamo rig has its own ~0.01 scale): skin the vertices on the CPU instead (every few, plenty for a box)
function renderedBounds(obj) {
    const box = new THREE.Box3(), v = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
        if (!o.isMesh) return;
        if (!o.isSkinnedMesh) { box.union(new THREE.Box3().setFromObject(o)); return; }
        o.skeleton.update();
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 5) {
            o.boneTransform(i, v.fromBufferAttribute(p, i));
            box.expandByPoint(v.applyMatrix4(o.matrixWorld));
        }
    });
    return box;
}

function onLoaded(gltf) {
    root = gltf.scene;
    root.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false; // a skinned mesh's bounds don't follow the animation
        // the scene has no color management: show textures as authored (like every other color here)
        [].concat(o.material).forEach(m => {
            ['map', 'emissiveMap'].forEach(k => { if (m[k]) m[k].encoding = THREE.LinearEncoding; });
            if ('metalness' in m) m.metalness = CONFIG.walkerLook.metalness; // see CONFIG.walkerLook
            if ('roughness' in m) m.roughness = CONFIG.walkerLook.roughness;
            addMasterDimmer(m);
            m.needsUpdate = true;
        });
    });

    // pose her on the first walk frame, turn, then measure (the box must include both)
    const clip = gltf.animations.find(a => /walk/i.test(a.name)) || gltf.animations[0];
    if (clip) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(clip).play();
        mixer.update(0);
    }
    root.rotation.y = FACING;
    const box = renderedBounds(root), size = box.getSize(new THREE.Vector3());
    // scale to CONFIG.walkerHeight, feet on her anchor (scaling about the origin scales the measured box by k too)
    const k = CONFIG.walkerHeight / Math.max(1e-6, size.y);
    root.scale.multiplyScalar(k);
    const anchor = new THREE.Vector3(0, -CONFIG.walkerHeight * 0.5, CONFIG.walkerZ);
    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
    root.position.set(anchor.x - center.x, anchor.y - box.min.y * k, anchor.z - center.z);
    scene.add(root);
    addLights(anchor, CONFIG.walkerHeight);
    window.walker = { anchor, height: CONFIG.walkerHeight, ready: true };
}

function load() {
    if (!THREE.GLTFLoader) { console.warn('GLTFLoader missing: mode 2 unavailable'); return; }
    const loader = new THREE.GLTFLoader();
    loader.load(CONFIG.walkerModel, onLoaded, undefined, (e) => {
        console.warn('Walker model .glb failed to load, trying the embedded copy:', e);
        loadEmbedded(loader);
    });
}

const giveUp = (e) => console.warn('Walker model failed to load, staying in mode 1:', e);

// The model as base64 inside a plain <script> (CONFIG.walkerModelEmbedded, made by `npm run build`): works on
// hosts that serve JS but not .glb files, and under a CSP that blocks fetch/XHR but allows same-origin scripts
function loadEmbedded(loader) {
    if (!CONFIG.walkerModelEmbedded) return giveUp('no embedded copy configured');
    const s = document.createElement('script');
    s.src = CONFIG.walkerModelEmbedded;
    s.onerror = () => giveUp('embedded copy not found: ' + CONFIG.walkerModelEmbedded);
    s.onload = () => {
        try {
            const b64 = window.WALKER_MODEL_BASE64;
            delete window.WALKER_MODEL_BASE64; // free the 5 MB string once decoded
            const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            loader.parse(bin.buffer, '', onLoaded, giveUp);
        } catch (e) { giveUp(e); }
    };
    document.head.appendChild(s);
}

// intensity: 0-1 kick envelope
function update(dt, intensity) {
    if (!root) return;
    const on = visualMode === 2;
    // hidden while the camera is inside her body: right after switching from mode 1 (whose shots circle the scene
    // center, where she stands) the camera is still gliding out - she appears once it is clear of her
    const w = window.walker, dx = camera.position.x - w.anchor.x, dz = camera.position.z - w.anchor.z;
    const cameraInside = Math.hypot(dx, dz) < 0.2 * w.height
        && camera.position.y > w.anchor.y && camera.position.y < w.anchor.y + w.height;
    root.visible = on && !cameraInside;
    // lightning plays in the sky over the city (giant-city-sky-anchors.js); without those anchors, none in this mode
    window.lightningOff = on && !window.lightningAnchors;
    if (on !== shownMode2) {  // on a mode switch only
        shownMode2 = on;
        // the floating star cube is the lightning's playground: not needed here, and it would hang in the street
        stars.forEach(s => (s.visible = !on));
        if (window.backdropFx) window.backdropFx.showBelowHorizon(!on);
    }
    if (!on) return;

    // a steady, slow-motion stride whatever the music does (keeps her composure and her scale)
    if (mixer) mixer.update(dt * CONFIG.walkerAnimSpeed);
    const L = CONFIG.walkerLook;
    keyLight.intensity = L.key * (1 + L.kickPump * intensity); // the key light pumps with the kick
    masterLight.value = L.brightness;
    fillLight.position.copy(camera.position);                  // lights the side being filmed
}

// While she is on screen the world must pass at her walking pace (not the beat-driven rush of mode 1),
// otherwise her steps and the stars move at unrelated speeds and she looks pasted on top of the scene.
// Returns this frame's flow, or null when mode 2 is not active (the animation loop then uses its own).
function flow(dt) {
    return root && visualMode === 2 ? CONFIG.walkerPace * CONFIG.walkerAnimSpeed * CONFIG.walkerHeight * dt : null;
}

window.addEventListener('visualizerstart', load);
window.walkerFx = { update, flow };
