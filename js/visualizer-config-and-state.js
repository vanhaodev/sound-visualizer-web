// --- TWEAKABLE CONFIG ---
const CONFIG = {
    starCount: 600,          // Number of floating stars

    // Bass beat detector
    beatThreshold: 0.25,     // Kick strength (0-1) that counts as a beat for the camera thud and the mode 2
                             // lightning: raise it (0.35-0.45) if soft low notes still shake, lower it for more hits
    kickMinHz: 35,          // Lower edge of the kick/bass band (skips sub-bass rumble below it)
    bassMaxHz: 150,          // Upper edge of the bass band (lower = only kick/sub)
    bassThreshold: 180,      // Noise gate (0-255): bass below this counts as silence
    pulseRelease: 0.9,       // How slowly a beat fades out (0-1, higher = slower)
    // Auto gain: every source (shared system audio, mic, file) is leveled to the same bass peak,
    // quiet ones boosted, loud ones cut, so all three inputs react the same
    autoGain: true,          // false = use the raw level
    autoGainTarget: 235,     // Bass peak (0-255) every source is leveled to
    autoGainMaxDb: 45,       // Max boost/cut in dB for shared audio / file (digital silence stays 0 at any boost,
                             // so even a low Windows/app volume, ~-30..-40 dB, still reacts like full volume)
    autoGainMaxDbMic: 24,    // Lower cap for the mic: a big boost would turn room noise into "kicks"

    // Lightning: chains that jump from star to star, pulsing with the beat
    lightningStyle: 'hd',    // 'hd' = sharp, full resolution | 'pixel' = chunky pixel-art look
    chainOnKick: 0.3,        // Kick strength (0-1) that starts a chain
    chainCooldown: 0.1,      // Minimum seconds between two kick chains
    chainHopsMin: 2,         // Hops of a chain on a soft kick...
    chainHopsMax: 8,         // ...and on the hardest kick
    chainHopDelay: 0.04,     // Seconds between two hops (the visible "travel" of the chain)
    chainBassInterval: 0.5,  // Seconds between short chains while the bass keeps going (shorter when louder)
    hopMinDist: 5,           // A hop jumps to a star at least this far...
    hopMaxDist: 20,          // ...and at most this far away
    maxArcs: 40,             // Max arcs alive at once (the oldest fades out to make room)
    boltGrowSpeed: 10,       // How fast an arc shoots across (10 = ~0.1 s)
    boltSustainOn: 0.1,      // Bass loudness (0-1) that counts as "bass is still playing"
    boltBranchInterval: 0.35,// Seconds between new branches while the bass keeps going
    boltFadeTime: 0.5,       // Seconds to fade out after the bass stops
    boltMaxLife: 2.5,        // An arc fades out after this many seconds even if the bass never stops
    flashStrength: 0.35,     // Full-screen flash on a kick (0 = off)
    highMinHz: 5000,         // Treble band (hi-hats, synths)...
    highMaxHz: 12000,        // ...that spawns small crackles
    crackleOnHigh: 0.3,      // Treble level (0-1) that fires a crackle
    vocalMinHz: 300,         // Vocal band...
    vocalMaxHz: 2500,        // ...a new syllable/note here fires a short pink chain
    leadMinHz: 2500,         // Lead band (synth/guitar leads, upper vocal harmonics)...
    leadMaxHz: 5000,         // ...a new note here fires a short cyan chain
    midGate: 90,             // Noise gate (0-255) for the vocal/lead bands
    midOnsetJump: 18,        // How far (0-255, ~0.3 dB per step) a band must jump above its recent level to count as a new note
    midCooldown: 0.2,        // Minimum seconds between two chains of the same band
    // Lightning colors per band: [core, inner glow, outer glow]. Keep cores saturated: arcs blend additively,
    // so pale cores stack up to plain white and every band looks the same
    lightningColors: {
        kick:  ['#ffffff', '#dfe8ff', '#8aa0ff'],  // white
        bass:  ['#b48cff', '#7a3cff', '#4b14c8'],  // violet (chains while the bass keeps going)
        vocal: ['#ff8fd0', '#ff3da8', '#a0105e'],  // pink
        lead:  ['#8ffcf0', '#1fe8d8', '#007f86'],  // cyan
        hihat: ['#ffe27a', '#ffb800', '#c25e00']   // gold (treble crackles)
    },

    // Kick shockwave (js/kick-shockwave-rings.js): a ring bursts from the struck star and shoves nearby stars
    shockwaveEnabled: true,  // false = turn the effect off
    shockwaveOnKick: 0.6,    // Kick strength (0-1) needed for a shockwave (only the strong hits)
    shockwaveRadius: 25,     // How far the ring expands on the hardest kick
    shockwaveLife: 0.9,      // Seconds the ring lives
    shockwavePush: 120,      // How hard the wave shoves stars (0 = ring only, stars stay still)
    shockwaveMax: 4,         // Max rings alive at once
    shockwaveColor: '#cfdcff',

    // Impact sparks (js/lightning-impact-sparks.js): sparks in the arc's color fly out wherever lightning hits
    sparksEnabled: true,     // false = turn the effect off
    sparkCount: 14,          // Sparks per hit at full power (softer hits make fewer)
    sparkSpeed: 14,          // Launch speed of the fastest sparks
    sparkLife: 0.8,          // Seconds the longest-lived sparks last
    sparkSize: 0.45,         // Spark size
    sparkMax: 3000,          // Pool size (the oldest sparks get recycled beyond this)

    // Visual mode (the home dropdown picks it; M switches while playing, N toggles automatic switching):
    // 1 = free camera tour of the starfield with lightning | 2 = a galactic giant walks through a city
    visualMode: 2,
    autoModeMin: 30,         // Automatic switching: next mode change after a random time between autoModeMin...
    autoModeMax: 60,         // ...and autoModeMax seconds (then on the next strong kick)
    walkerModel: 'static/models/miss_galaxy.glb', // a GLB with a looping walk animation (in place)
    walkerHeight: 120,       // Her height in world units: a galactic giant (the star cube around the camera is 100
                             // units wide, so the stars read as dust drifting past her)
    walkerZ: 12,             // Where she stands on the z axis (the stars flow from -z toward +z, past her)
    walkerPace: 0.6,         // Her walking speed in heights per second: the stars flow past at exactly this speed
                             // in mode 2, so her steps and the world move together. 0.6 = measured median speed of
                             // the stance foot in the walk clip (change it if you swap the model or its animation)
    walkerAnimSpeed: 0.3,    // Slow motion of her walk (1 = as authored): giants move slowly, this sells her size
    // Her look and lights (mode 2). Intensities: 0 = off, ~1 = normal, 2-3 = strong
    walkerLook: {
        brightness: 0.2,         // MASTER LIGHT: multiplies her whole final color, highlights included
                                 // (0.5 = half as bright, 1 = as lit, 1.5 = 50% brighter). Only her, not the city
        metalness: 1,         // 1 = the file's own look: glossy black metal with colored highlights (nothing to
                                 // reflect here). Lower = her galaxy suit shows more (0.15 = fully lit, flat)
        roughness: 0.25,         // 0 = mirror-glossy highlights, 1 = matte (the file says 0.2)
        ambient: 1.0,            // Soft light from everywhere (sky color from above, ground color from below)
        ambientSky: '#9aa8ff',
        ambientGround: '#1a0830',
        key: 1.3,                // Main light, front-left above
        keyColor: '#f11313',
        rim: 1.4,                // Rim light from behind: outlines her against the dark
        rimColor: '#7f9cff',
        fill: 0.3,               // Soft light from the camera: the side being filmed is never pitch black
        fillColor: '#ffffff',
        kickPump: 0.55           // Extra main light on each kick (0 = steady)
    },

    cityBuildings: 900,      // Mode 2: dark buildings with flickering windows on both sides of her path
                             // (js/giant-city-buildings.js, one draw call however many); 0 = off (whole city)
    cityBarGain: 0.85,       // How high the window "equalizer" can climb (1 = full tower on the loudest peaks;
                             // lower = calmer city)
    skyLightning: true,      // Mode 2: the mode 1 lightning plays in the sky over the buildings, pinned to the city
    skyLightningScale: 5,    // Size of those bolts and their hops vs mode 1 (they must read at city scale, far away)
    skyLightningVertical: true, // Strikes fall from high in the sky down onto real rooftops (false = hop around the sky)
    skyLightningHeight: [1.2, 2.4],  // Height band of that lightning above the street, in her heights (rooftops ~0.5)
    skyLightningDistance: [1.2, 3.5], // How far to either side of her path, in her heights (the street ends at 0.7)
    cityGlow: 0.35,         // Light spilling onto the walls around lit windows: turns each bar into one glowing
                             // column (0 = only the window dots; 0.6+ = neon towers)
    cityWindowSize: 1,       // Window grid scale (1 = 3.5 m floors; 0.5 = twice as many, smaller windows - may
                             // shimmer when far; 1.5 = fewer, bigger)
    cityKickPump: 0.3,      // On each kick every tower jumps this much higher at once (and its windows flare):
                             // the beat reads across the whole city. 0 = towers follow only their own band
    // Deep-space backdrop (js/deep-space-backdrop.js): far-away stars behind everything, one draw call
    backdropStars: 6000,     // 0 = off

    // Camera
    camMinShot: 6,           // Each shot lasts a random time between camMinShot...
    camMaxShot: 12,          // ...and camMaxShot seconds, then waits for a kick to move on
    camCutOnKick: 0.75,      // Kick strength (0-1) that starts the move to the next shot, on the beat
    camBlendTime: 2.5,       // Seconds the camera glides from the old shot to the new one
    camBlendTimeGiant: 7,    // Same in mode 2: a slow, heavy glide around the giant
    shakeBeat: 1,            // Mode 2: camera thud (drop + bounce) on every beat (0 = off, 2 = heavy)
    shakeKick: 0.5,          // Mode 2: small camera jitter while the kick is loud (0 = off)
    camHoldGiant: 1.5,      // Mode 2 shots last this many times longer (6-12 s -> 9-18 s)
    // Motion blur (afterimage trails, js/motion-trail-renderer.js)
    motionBlur: 0,          // MASTER: scales both trails below (0 = off, 0.5 = half, 1.2 = longer)
    trailMoving: 0.8,        // Trail while the camera glides between shots (0 = none, 0.9 = very long)
    trailIdle: 0.25          // Trail while the camera holds a shot (light, keeps the image sharp)
};

// State shared across files
let scene, camera, renderer, analyser, dataArray, source;
let sourceKind = 'file';     // 'share' | 'mic' | 'file', set when the visualizer starts
let visualMode = CONFIG.visualMode; // current mode, toggled with M (see camera-director-shots.js)
let stars = [];
let isStarted = false;
