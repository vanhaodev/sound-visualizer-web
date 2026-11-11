// Shared layout of the mode 2 city (giant-city-buildings.js, giant-city-street.js).
// Sizes in her heights (H) unless marked "m": 1 world unit ~ 1 m, so lamps and floors have real sizes
// and she (CONFIG.walkerHeight units tall) towers over them.

export const CITY = {
    corridor: 0.7,      // half-width of the street she walks down (and the camera films from), H
    outer: 3.5,         // how far the buildings reach to each side, H
    length: 6,          // length of the city along her path (it wraps around), H
    cell: 0.13,         // building grid cell, H (one building at most per cell)
    lampSpacing: 0.5,   // distance between two street lamps, H (length / lampSpacing must be a whole number)
    lampHeight: 9,      // m
    fog: 2.2            // distance (H) over which the city sinks into the dark
};

// The world flows +z at her walking pace; city objects are laid out once and moved in the vertex shader:
// z wraps into [uZMin, uZMin + uLength), so a whole city costs no CPU work per frame
export const WRAP_GLSL = /* glsl */`
uniform float uOffset, uLength, uZMin;
float wrapZ(float z) { return mod(z + uOffset - uZMin, uLength) + uZMin; }
`;

export const FOG_GLSL = /* glsl */`
uniform float uFog;
vec3 fogged(vec3 col, vec3 world) { return col * exp(-distance(cameraPosition, world) / uFog); }
`;

// Uniforms every city material shares (same objects -> one update per frame drives them all)
export function makeSharedUniforms(w) {
    const H = w.height;
    return {
        uOffset: { value: 0 }, uLength: { value: CITY.length * H }, uZMin: { value: w.anchor.z - CITY.length * H * 0.5 },
        uTime: { value: 0 }, uFog: { value: CITY.fog * H }
    };
}
