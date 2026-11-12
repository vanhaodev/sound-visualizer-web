// Audio file sources: ONE constant gain for the whole song, measured on the whole song before it matters.
// The live auto gain (visualizer-animation-loop.js) suits shared audio / mic, whose level depends on the app or
// Windows volume. A file has a fixed, mastered level, but songs are mastered differently (the bundled ones sit
// ~6 dB under the level the beat detector is tuned for, so most kicks were missed at 0 dB), and calibrating live
// on the first seconds - usually a quiet intro - boosted it by up to 40 dB. So: decode the file, scan its spectrum
// (much faster than real time) exactly like the live analyser would see it, take the level of its loud parts, and
// use the gain that brings them to CONFIG.autoGainTarget. Constant for the whole song: its quiet / loud contrast
// is untouched. Until the scan is done (a second or two) the gain is 0.
//
// The spectrum is computed here in JS, replicating AnalyserNode (Blackman window, FFT, 1/N magnitude, time
// smoothing, dB -> byte), instead of pausing an OfflineAudioContext with suspend(t): Firefox has no suspend()
// on offline contexts, and this way every browser gets the same numbers.

let fileGainDb = 0;           // read by updateAutoGain() for sourceKind === 'file'
const SCAN_RATE = 20;         // spectrum samples per second of audio
// "the loud parts" = the peak, like the live auto gain of shared audio (which remembers the loudest moment), so a
// file reacts exactly like the same song shared; 99.9 % only skips a stray glitch frame. A lower percentile
// (98 %) boosted files ~2 dB hotter than sharing them and soft bass notes started to read as kicks
const LOUD_PERCENTILE = 0.999;
// the same settings as the live analyser (audio-source-selector-and-start.js), with no gain
const SCAN_FFT = 2048, SCAN_SMOOTHING = 0.5, SCAN_MIN_DB = -90, SCAN_MAX_DB = -10;

// Mono mix of a decoded buffer, the way a 1-channel analyser hears it (average of the channels)
function monoSamples(audio) {
    const out = new Float32Array(audio.length), n = audio.numberOfChannels;
    for (let c = 0; c < n; c++) {
        const ch = audio.getChannelData(c);
        for (let i = 0; i < out.length; i++) out[i] += ch[i] / n;
    }
    return out;
}

// A reusable AnalyserNode look-alike: frame(samples, end, bytes) fills bytes (N/2 values) with the spectrum of
// the N samples ending at `end`, smoothed against the previous frame like getByteFrequencyData does
function makeSpectrumScanner(N) {
    const win = new Float64Array(N), re = new Float64Array(N), im = new Float64Array(N);
    const smooth = new Float64Array(N / 2), rev = new Uint32Array(N), bits = Math.log2(N);
    for (let i = 0; i < N; i++) {
        const x = i / N; // Blackman window, as specified for AnalyserNode
        win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
        let r = 0;
        for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
        rev[i] = r;
    }
    const range = SCAN_MAX_DB - SCAN_MIN_DB;
    return function frame(samples, end, bytes) {
        for (let i = 0; i < N; i++) {
            const s = end - N + i;
            re[rev[i]] = s >= 0 ? samples[s] * win[i] : 0;
            im[rev[i]] = 0;
        }
        // iterative radix-2 FFT
        for (let size = 2; size <= N; size *= 2) {
            const half = size / 2, step = -2 * Math.PI / size;
            for (let k = 0; k < half; k++) {
                const wr = Math.cos(step * k), wi = Math.sin(step * k);
                for (let j = k; j < N; j += size) {
                    const l = j + half, tr = re[l] * wr - im[l] * wi, ti = re[l] * wi + im[l] * wr;
                    re[l] = re[j] - tr; im[l] = im[j] - ti;
                    re[j] += tr; im[j] += ti;
                }
            }
        }
        for (let k = 0; k < N / 2; k++) {
            const mag = Math.hypot(re[k], im[k]) / N;
            smooth[k] = SCAN_SMOOTHING * smooth[k] + (1 - SCAN_SMOOTHING) * mag;
            const db = 20 * Math.log10(smooth[k]);
            bytes[k] = Math.max(0, Math.min(255, Math.floor(255 * (db - SCAN_MIN_DB) / range)));
        }
    };
}

// blob: the File / Blob being played. Read straight from memory, not fetched from its blob: URL, because
// sandboxed hosts block fetching blob URLs (CSP connect-src) while still letting <audio> play them
async function calibrateFileGain(blob) {
    fileGainDb = 0;
    try {
        const encoded = await blob.arrayBuffer();
        const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(encoded);
        const samples = monoSamples(audio), sr = audio.sampleRate;
        const frame = makeSpectrumScanner(SCAN_FFT), data = new Uint8Array(SCAN_FFT / 2), binHz = sr / SCAN_FFT;
        const levels = [];
        let n = 0;
        for (let t = 1 / SCAN_RATE; t < audio.duration - 0.05; t += 1 / SCAN_RATE) {
            frame(samples, Math.round(t * sr), data);
            // the same "loudest part" measure as the live auto gain: bass, or the mids + offset
            const bass = bandLevelOf(data, binHz, CONFIG.kickMinHz, CONFIG.bassMaxHz);
            const mids = bandLevelOf(data, binHz, 250, 2000);
            levels.push(Math.max(bass, mids + MID_REF_OFFSET));
            if (++n % 200 === 0) await new Promise(r => setTimeout(r)); // let the visualizer keep rendering
        }

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
