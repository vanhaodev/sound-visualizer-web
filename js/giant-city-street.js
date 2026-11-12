// The street of the mode 2 city (built by giant-city-buildings.js), all shader-driven, no lights, no textures:
// - ground: one plane; faint lane markings and the warm pools of light under the lamps are drawn by its shader
// - street lamps: thin poles (one InstancedMesh) + glowing heads (one Points)
// Everything wraps along her path like the buildings (see giant-city-layout.js). 3 draw calls in total.

import { CITY, WRAP_GLSL, FOG_GLSL } from "./giant-city-layout.js?v=7";

// --- ground + markings + lamp light pools ---
const GROUND_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GROUND_FRAG = FOG_GLSL + /* glsl */`
uniform float uOffset, uHalfW, uLampSpacing, uLampX, uCenterX;
varying vec3 vWorld;
float line(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
void main() {
    float x = vWorld.x - uCenterX;
    float z = vWorld.z - uOffset;                  // painted on the ground -> moves with the flow
    bool road = abs(x) < uHalfW;
    vec3 col = road ? vec3(0.012, 0.013, 0.02) : vec3(0.006, 0.006, 0.01);
    if (road) {                                    // faint markings: dashed double center line, dashed lanes, edges
        float center = line(abs(x) - 0.7, 0.8) * step(0.45, fract(z / 14.0));
        float lanes = line(abs(x) - uHalfW * 0.42, 0.8) * step(0.6, fract(z / 10.0));
        float edges = line(abs(x) - uHalfW * 0.9, 0.9);
        col += vec3(0.75, 0.6, 0.3) * center * 0.16 + vec3(0.6) * (lanes * 0.09 + edges * 0.11);
    }
    // warm pools of light under the lamps (at x = +-uLampX, z = spacing/2 + k * spacing in ground coordinates)
    float lz = mod(z, uLampSpacing) - uLampSpacing * 0.5, r = uLampSpacing * 0.2;
    float d2 = min((x - uLampX) * (x - uLampX), (x + uLampX) * (x + uLampX)) + lz * lz;
    col += vec3(1.0, 0.72, 0.38) * 0.2 * exp(-d2 / (r * r));
    gl_FragColor = vec4(fogged(col, vWorld), 1.0);
}`;

// --- glowing lamp heads ---
const GLOW_FRAG = /* glsl */`
varying vec3 vColor;
void main() {
    vec2 d = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vColor * exp(-dot(d, d) * 18.0), 1.0);
}`;

const LAMP_VERT = WRAP_GLSL + /* glsl */`
uniform float uPx;   // half the drawing buffer height in pixels
uniform float uFog;
varying vec3 vColor;
void main() {
    vec3 p = vec3(position.x, position.y, wrapZ(position.z));
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = 6.0 * projectionMatrix[1][1] * uPx / -mv.z;   // 6 m wide glow, perspective-correct
    vColor = vec3(1.0, 0.75, 0.42) * exp(-distance(cameraPosition, p) / uFog);
    gl_Position = projectionMatrix * mv;
}`;

/** Builds the street objects for her (window.walker) with the city's shared uniforms; returns them to add. */
export function buildStreet(w, shared) {
    const H = w.height, halfW = CITY.corridor * H, lampX = halfW * 0.97, S = CITY.lampSpacing * H;
    shared.uPx = shared.uPx || { value: 400 };

    // ground under the whole city, the road in the middle
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * CITY.outer * H, CITY.length * H), new THREE.ShaderMaterial({
        vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
        uniforms: { ...shared, uHalfW: { value: halfW }, uLampSpacing: { value: S }, uLampX: { value: lampX }, uCenterX: { value: w.anchor.x } }
    }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(w.anchor.x, w.anchor.y - 0.05, w.anchor.z);

    // lamps: both sides, every S along the path (same z grid as the light pools on the ground)
    const lampPos = [], n = Math.round(CITY.length / CITY.lampSpacing), zMin = shared.uZMin.value;
    for (let k = 0; k < n; k++) for (const side of [-1, 1]) lampPos.push(w.anchor.x + side * lampX, w.anchor.y + CITY.lampHeight, zMin + S / 2 + k * S);
    const poleGeo = new THREE.BoxGeometry(0.35, CITY.lampHeight, 0.35).translate(0, -CITY.lampHeight / 2, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.ShaderMaterial({
        vertexShader: WRAP_GLSL + /* glsl */`varying vec3 vWorld;
            void main() { vec3 c = instanceMatrix[3].xyz; vec4 wp = instanceMatrix * vec4(position, 1.0);
                wp.z += wrapZ(c.z) - c.z; vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: FOG_GLSL + `varying vec3 vWorld; void main() { gl_FragColor = vec4(fogged(vec3(0.05, 0.05, 0.06), vWorld), 1.0); }`,
        uniforms: shared
    }), lampPos.length / 3);
    const m = new THREE.Matrix4();
    for (let i = 0; i < lampPos.length / 3; i++) poles.setMatrixAt(i, m.makeTranslation(lampPos[i * 3], lampPos[i * 3 + 1], lampPos[i * 3 + 2]));
    const lampGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
    const lamps = new THREE.Points(lampGeo, new THREE.ShaderMaterial({
        vertexShader: LAMP_VERT, fragmentShader: GLOW_FRAG, uniforms: shared,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));

    return [plane, poles, lamps];
}
