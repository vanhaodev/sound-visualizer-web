// Frequency -> color for the lightning: every instrument band gets its own palette
// (kick = white, sustained bass = violet, vocals = pink, lead = cyan, hi-hats = gold; see CONFIG.lightningColors),
// plus a small onset detector that tells when a mid band (vocals, lead) hits a new note or syllable.

const WHITE = new THREE.Color(1, 1, 1);

// CONFIG.lightningColors[band] = [core, inner glow, outer glow] -> THREE.Color triplets, built once
const palettes = {};
export function paletteFor(band) {
    if (!palettes[band]) {
        const hex = CONFIG.lightningColors[band] || CONFIG.lightningColors.kick;
        const [core, inner, outer] = hex.map(c => new THREE.Color(c));
        // "hot" = the same hue pushed a quarter of the way to white, so a flare stays recognizable instead of all-white
        palettes[band] = { core, inner, outer, hotCore: core.clone().lerp(WHITE, 0.25), hotInner: inner.clone().lerp(WHITE, 0.25) };
    }
    return palettes[band];
}

// Onset of one band: its level (0-255) jumps clearly above its own recent average, above a noise gate.
// getByteFrequencyData is dB-scaled, so a fixed jump in bytes = a fixed jump in dB at any loudness.
export function makeOnsetDetector() {
    return { avg: 0, cooldown: 0 };
}

/** Returns 0 (no onset) or the onset strength 0-1. Call once per frame. */
export function detectOnset(d, level, dt) {
    const jump = level - d.avg;
    d.avg += (level - d.avg) * Math.min(1, dt * 3); // ~0.3 s memory
    d.cooldown -= dt;
    if (d.cooldown > 0 || level < CONFIG.midGate || jump < CONFIG.midOnsetJump) return 0;
    d.cooldown = CONFIG.midCooldown;
    return Math.min(1, jump / (CONFIG.midOnsetJump * 3));
}
