// Audio file sources: ONE constant gain for the whole song, measured on the whole song before it matters.
// The live auto gain (visualizer-animation-loop.js) suits shared audio / mic, whose level depends on the app or
// Windows volume. A file has a fixed, mastered level, but songs are mastered differently (the bundled ones sit
// ~6 dB under the level the beat detector is tuned for, so most kicks were missed at 0 dB), and calibrating live
// on the first seconds - usually a quiet intro - boosted it by up to 40 dB. So: decode the file, scan it offline
// (much faster than real time) with the same analyser settings, take the level of its loud parts, and use the gain
// that brings them to CONFIG.autoGainTarget. Constant for the whole song: its quiet / loud contrast is untouched.
// Until the scan is done (a second or two) the gain is 0.

let fileGainDb = 0;           // read by updateAutoGain() for sourceKind === 'file'
const SCAN_RATE = 20;         // spectrum samples per second of audio
// "the loud parts" = the peak, like the live auto gain of shared audio (which remembers the loudest moment), so a
// file reacts exactly like the same song shared; 99.9 % only skips a stray glitch frame. A lower percentile
// (98 %) boosted files ~2 dB hotter than sharing them and soft bass notes started to read as kicks
const LOUD_PERCENTILE = 0.999;

// blob: the File / Blob being played. Read straight from memory, not fetched from its blob: URL, because
// sandboxed hosts block fetching blob URLs (CSP connect-src) while still letting <audio> play them
async function calibrateFileGain(blob) {
    fileGainDb = 0;
    try {
        const encoded = await blob.arrayBuffer();
        const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(encoded);
        const ctx = new OfflineAudioContext(1, audio.length, audio.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = audio;
        // same settings as the live analyser (audio-source-selector-and-start.js), with no gain
        const an = ctx.createAnalyser();
        an.fftSize = 2048; an.smoothingTimeConstant = 0.5; an.minDecibels = -90; an.maxDecibels = -10;
        src.connect(an);
        an.connect(ctx.destination);

        const data = new Uint8Array(an.frequencyBinCount), binHz = audio.sampleRate / an.fftSize, levels = [];
        for (let t = 1 / SCAN_RATE; t < audio.duration - 0.05; t += 1 / SCAN_RATE) {
            ctx.suspend(t).then(() => {
                an.getByteFrequencyData(data);
                // the same "loudest part" measure as the live auto gain: bass, or the mids + offset
                const bass = bandLevelOf(data, binHz, CONFIG.kickMinHz, CONFIG.bassMaxHz);
                const mids = bandLevelOf(data, binHz, 250, 2000);
                levels.push(Math.max(bass, mids + MID_REF_OFFSET));
                ctx.resume();
            });
        }
        src.start();
        await ctx.startRendering();

        const loud = levels.filter(l => l > 40).sort((a, b) => a - b); // ignore silence
        if (!loud.length) return;
        const ref = loud[Math.floor(loud.length * LOUD_PERCENTILE)];
        const max = CONFIG.autoGainMaxDb;
        fileGainDb = Math.min(max, Math.max(-max, (CONFIG.autoGainTarget - ref) * DB_PER_BYTE));
        console.info(`File loudness calibrated: ${fileGainDb.toFixed(1)} dB`);
    } catch (e) {
        console.warn('File loudness calibration failed, using 0 dB:', e);
    }
}
