// Panel bên phải: phát nhanh bài + ảnh có sẵn trong static/, không cần chọn file.
// Đổi bài: chỉ cần ghi đè file static/sample_song.mp3, không phải sửa code

const TEMPLATE = {
    title: 'Sample Song',
    audio: 'static/sample_song.mp3',
    image: 'static/template-cover.png'
};

const templateBtn = $('btn-template');
$('template-cover').src = TEMPLATE.image;
$('template-title').textContent = TEMPLATE.title;

// Mở bằng file:// thì WebGL texture và analyser bị chặn (CORS) → bắt buộc chạy qua server cục bộ
if (location.protocol === 'file:') {
    templateBtn.disabled = true;
    $('template-hint').textContent = 'Run start-visualizer.cmd, then open http://localhost:5173';
}

// Tải về thành blob URL → luôn same-origin, kể cả khi host redirect file lớn sang CDN/domain khác
// (nếu dùng URL trực tiếp, createMediaElementSource sẽ trả về im lặng vì CORS)
async function fetchAsBlobUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    return URL.createObjectURL(await res.blob());
}

templateBtn.onclick = async () => {
    unlockAudioContext(); // trước mọi await để giữ quyền phát âm thanh từ cú click
    templateBtn.disabled = true;
    templateBtn.textContent = 'LOADING...';
    try {
        const [tex, audioUrl] = await Promise.all([
            new THREE.TextureLoader().loadAsync(TEMPLATE.image),
            fetchAsBlobUrl(TEMPLATE.audio)
        ]);
        textures = [tex];
        await startVisualizer('file', audioUrl);
    } catch (e) {
        console.error(e);
        alert('Could not play the template!\n' + e.message);
        templateBtn.disabled = false;
        templateBtn.textContent = '▶ PLAY TEMPLATE';
    }
};
