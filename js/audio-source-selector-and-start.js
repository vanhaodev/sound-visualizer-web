// Start screen: pick the audio source (share / mic / file) and boot the visualizer

const $ = (id) => document.getElementById(id);
const srcRadio = (value) => document.querySelector(`input[name="src"][value="${value}"]`);
const getSrc = () => document.querySelector('input[name="src"]:checked').value;

// Firefox returns no audio track from getDisplayMedia -> lock the "share" option and default to file
const canShareAudio = !/firefox/i.test(navigator.userAgent) && !!navigator.mediaDevices?.getDisplayMedia;

// Disable voice processing so the bass band survives when using a mic / Stereo Mix
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

let audioFile = null;

if (!canShareAudio) {
    $('opt-share').classList.add('disabled');
    srcRadio('share').disabled = true;
    $('share-hint').textContent = 'Not supported in this browser (use Chrome/Edge)';
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
    stream.getVideoTracks().forEach(t => t.stop()); // only the audio is needed
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
        source.connect(analyser); // not routed to speakers to avoid echo
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
