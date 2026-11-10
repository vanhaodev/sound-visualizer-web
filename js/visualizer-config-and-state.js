// --- TWEAKABLE CONFIG ---
const CONFIG = {
    matrixRainCount: 500,    // Number of floating Matrix characters

    // Bass beat detector
    bassMaxHz: 150,          // Upper edge of the bass band (lower = only kick/sub)
    bassThreshold: 180,      // Noise gate (0-255): bass below this counts as silence
    pulseRelease: 0.9,       // How slowly a beat fades out (0-1, higher = slower)
    autoGainTarget: 235,     // Share/mic only: lift the recent bass peak up to this level (0-255)...
    autoGainMax: 90,         // ...by at most this much (~28 dB), so near-silence stays silent
    autoGainDecay: 6,        // How fast the remembered peak drops per second (lower = steadier gain)

    // Lightning: chains that jump from character to character (x -> y -> j -> k), pulsing with the beat
    lightningStyle: 'hd',    // 'hd' = sharp, full resolution | 'pixel' = chunky pixel-art look
    chainOnKick: 0.3,        // Kick strength (0-1) that starts a chain
    chainCooldown: 0.1,      // Minimum seconds between two kick chains
    chainHopsMin: 2,         // Hops of a chain on a soft kick...
    chainHopsMax: 8,         // ...and on the hardest kick
    chainHopDelay: 0.04,     // Seconds between two hops (the visible "travel" of the chain)
    chainBassInterval: 0.5,  // Seconds between short chains while the bass keeps going (shorter when louder)
    hopMinDist: 5,           // A hop jumps to a character at least this far...
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
    crackleOnHigh: 0.45,     // Treble level (0-1) that fires a crackle

    // Camera
    camMinShot: 6,           // Each shot lasts a random time between camMinShot...
    camMaxShot: 12,          // ...and camMaxShot seconds, then waits for a kick to move on
    camCutOnKick: 0.75,      // Kick strength (0-1) that starts the move to the next shot, on the beat
    camBlendTime: 2.5,       // Seconds the camera glides from the old shot to the new one
    trailMoving: 0.8,        // Motion blur trail while the camera glides (0 = off, 0.9 = very long)
    trailIdle: 0.25          // Trail while the camera is still (light, keeps the image sharp)
};

// State shared across files
let scene, camera, renderer, analyser, dataArray, source;
let matrixChars = [];
let isStarted = false;
let useAutoGain = false; // true for share/mic sources (set on start), files play at a known level
