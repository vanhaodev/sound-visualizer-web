// Start screen: pick the audio source (share / mic / file) and boot the visualizer

const $ = (id) => document.getElementById(id);
const srcRadio = (value) => document.querySelector(`input[name="src"][value="${value}"]`);
const getSrc = () => document.querySelector('input[name="src"]:checked').value;

// Unrestricted build of this site, offered when the current host blocks sharing
const FULL_VERSION_URL = 'https://vanhaodev.github.io/sound-visualizer-web/';

// Why screen/audio sharing is unavailable here: { reason, byHost } or null if it is available.
// byHost = the hosting setup blocks it (another host would work), as opposed to a real browser limit.
function getShareBlock() {
    if (!window.isSecureContext) return { reason: 'Needs HTTPS - open this page over https://', byHost: true };
    // Sandboxed page (CSP "sandbox" or a sandboxed iframe without allow-same-origin): the origin is opaque and
    // Chromium rejects getDisplayMedia with "SecurityError: Invalid security origin"
    if (window.origin === 'null') return { reason: 'Blocked: this host runs the page in a sandbox (no origin)', byHost: true };
    const policy = document.permissionsPolicy || document.featurePolicy; // Chromium only
    if (policy && !policy.allowsFeature('display-capture')) {
        return { reason: 'Blocked by the host (Permissions-Policy: display-capture)', byHost: true };
    }
    if (/firefox/i.test(navigator.userAgent)) return { reason: 'Firefox cannot share system audio (use Chrome/Edge)', byHost: false };
    if (!navigator.mediaDevices?.getDisplayMedia) return { reason: 'Not supported in this browser (use Chrome/Edge)', byHost: false };
    return null;
}
const shareBlock = getShareBlock();
const canShareAudio = !shareBlock;

// Disable voice processing so the bass band survives when using a mic / Stereo Mix
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

let audioFile = null;

if (!canShareAudio) {
    $('opt-share').classList.add('disabled');
    srcRadio('share').disabled = true;
    $('share-hint').textContent = shareBlock.reason;
    console.warn('Share system audio unavailable:', shareBlock.reason);
    // Hosting problem (not the browser) -> offer the GitHub Pages build, where sharing works
    if (shareBlock.byHost) {
        const link = Object.assign(document.createElement('a'), {
            href: FULL_VERSION_URL, target: '_blank', rel: 'noopener', textContent: ' Open the full version ↗'
        });
        $('share-hint').append(link);
    }
}
srcRadio(canShareAudio ? 'share' : 'file').checked = true;

// Enabled unless the "file" source is picked without a file
function updateStartBtn() {
    $('btn-start').disabled = getSrc() === 'file' && !audioFile;
}

document.querySelectorAll('input[name="src"]').forEach(r => r.onchange = updateStartBtn);
// Clicking the "FILE" option opens the file picker right away
srcRadio('file').onclick = () => $('f-audio').click();
updateStartBtn();

$('f-audio').onchange = (e) => {
    audioFile = e.target.files[0] || null;
    if (audioFile) {
        $('audio-label').textContent = '♪ ' + audioFile.name;
        srcRadio('file').checked = true;
    }
    updateStartBtn();
};

async function getShareStream() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No audio track: "Share system audio" was not checked.');
    }
    // Only the audio is needed, but do NOT stop the video track: in Chrome stopping it ends the whole
    // capture session, so the audio track goes silent/ended right away. Disabling it just drops the frames.
    stream.getVideoTracks().forEach(t => { t.enabled = false; });
    const audioTrack = stream.getAudioTracks()[0];
    console.info('Share audio track:', audioTrack.label, audioTrack.readyState, audioTrack.getSettings());
    audioTrack.onended = () => console.warn('Shared audio track ended (sharing stopped)');
    audioTrack.onmute = () => console.warn('Shared audio track muted (no audio coming in)');
    return stream;
}

const ERROR_TIPS = {
    share: 'When sharing, make sure to check "Share system audio".',
    mic: 'Please allow microphone access (or pick "Stereo Mix").',
    file: 'Could not play this file, try another one.'
};

let audioCtx = null;

// Must run synchronously inside the click handler (before any await), otherwise the browser's
// autoplay policy blocks playback after a long download
function unlockAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    return audioCtx;
}

// Boot audio + scene. src: 'share' | 'mic' | 'file' (audioUrl required for 'file').
// Throws so the caller can show a fitting message.
async function startVisualizer(src, audioUrl) {
    unlockAudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;              // ~23Hz per bin -> isolates the real bass band (20-150Hz)
    analyser.smoothingTimeConstant = 0.5; // less smoothing -> kicks hit fast and tight
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;           // more headroom so loud and quiet music read differently

    if (src === 'file') {
        const audioEl = new Audio(audioUrl);
        audioEl.loop = true;
        source = audioCtx.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(audioCtx.destination); // so the music is audible
        await audioEl.play();
    } else {
        const stream = src === 'share'
            ? await getShareStream()
            : await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO, video: false });
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        useAutoGain = true;
        // Not routed to the speakers (echo), but still pull the graph through a silent gain to the
        // destination so Chromium keeps processing the stream -> analyser gets real data, not zeros
        const mute = audioCtx.createGain();
        mute.gain.value = 0;
        analyser.connect(mute).connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    $('ui').style.display = 'none';
    init3DEngine();
    isStarted = true;
    animate();
}

$('btn-start').onclick = async () => {
    const src = getSrc();
    try {
        await startVisualizer(src, audioFile && URL.createObjectURL(audioFile));
    } catch (e) {
        console.error(e);
        alert('Could not capture audio!\n' + ERROR_TIPS[src]);
    }
};
