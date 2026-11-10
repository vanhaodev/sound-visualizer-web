// UI màn hình bắt đầu: nạp ảnh, chọn nguồn âm thanh (share / mic / file), khởi động visualizer

const $ = (id) => document.getElementById(id);
const srcRadio = (value) => document.querySelector(`input[name="src"][value="${value}"]`);
const getSrc = () => document.querySelector('input[name="src"]:checked').value;

// Firefox không trả audio qua getDisplayMedia → khoá lựa chọn "share" và mặc định sang file
const canShareAudio = !/firefox/i.test(navigator.userAgent) && !!navigator.mediaDevices?.getDisplayMedia;

// Tắt xử lý giọng nói để giữ nguyên dải bass khi dùng micro / Stereo Mix
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

let audioFile = null;

if (!canShareAudio) {
    $('opt-share').classList.add('disabled');
    srcRadio('share').disabled = true;
    $('share-hint').textContent = 'Not supported in this browser (use Chrome/Edge)';
}
srcRadio(canShareAudio ? 'share' : 'file').checked = true;

// Bật nút khi đã có ảnh, và đã có file nếu chọn nguồn "file"
function updateStartBtn() {
    const ready = textures.length > 0 && (getSrc() !== 'file' || audioFile);
    $('btn-start').disabled = !ready;
}

document.querySelectorAll('input[name="src"]').forEach(r => r.onchange = updateStartBtn);
// Bấm ô "FILE" → mở hộp chọn file ngay
srcRadio('file').onclick = () => $('f-audio').click();

// Nạp ảnh làm Texture
$('f-img').onchange = (e) => {
    const loader = new THREE.TextureLoader();
    Array.from(e.target.files).forEach(f => {
        loader.load(URL.createObjectURL(f), (txt) => {
            textures.push(txt);
            updateStartBtn();
        });
    });
};

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
    stream.getVideoTracks().forEach(t => t.stop()); // chỉ cần audio
    return stream;
}

const ERROR_TIPS = {
    share: 'When sharing, make sure to check "Share system audio".',
    mic: 'Please allow microphone access (or pick "Stereo Mix").',
    file: 'Could not play this file, try another one.'
};

let audioCtx = null;

// Phải gọi đồng bộ trong click (trước mọi await), nếu không trình duyệt chặn autoplay
// khi phải chờ tải file lâu
function unlockAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    return audioCtx;
}

// Khởi động âm thanh + scene. src: 'share' | 'mic' | 'file' (audioUrl bắt buộc khi 'file').
// Ném lỗi ra ngoài để nơi gọi tự hiển thị thông báo phù hợp.
async function startVisualizer(src, audioUrl) {
    unlockAudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;              // ~23Hz/ngăn → tách được dải bass thật (20–150Hz)
    analyser.smoothingTimeConstant = 0.5; // ít làm mượt hơn → kick bật nhanh, gọn
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;           // nới đỉnh để nhạc to và nhỏ khác biệt rõ

    if (src === 'file') {
        const audioEl = new Audio(audioUrl);
        audioEl.loop = true;
        source = audioCtx.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(audioCtx.destination); // để nghe được nhạc
        await audioEl.play();
    } else {
        const stream = src === 'share'
            ? await getShareStream()
            : await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO, video: false });
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser); // không nối ra loa để tránh vọng tiếng
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
