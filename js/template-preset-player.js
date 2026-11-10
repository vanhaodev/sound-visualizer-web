// Right-hand panel: one-click play of the bundled track in static/, no file picking.
// To change the track, just overwrite static/sample_song.mp3 - no code changes needed

const TEMPLATE = {
    title: 'Sample Song',
    audio: 'static/sample_song.mp3'
};

const templateBtn = $('btn-template');
$('template-title').textContent = TEMPLATE.title;

// Over file:// ES modules and the analyser are blocked (CORS) -> a local server is required
if (location.protocol === 'file:') {
    templateBtn.disabled = true;
    $('template-hint').textContent = 'Run start-visualizer.cmd, then open http://localhost:5173';
}

// Download into a blob URL -> always same-origin, even if the host redirects large files to a CDN/other domain
// (with a direct URL, createMediaElementSource would output silence because of CORS)
async function fetchAsBlobUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    return URL.createObjectURL(await res.blob());
}

templateBtn.onclick = async () => {
    unlockAudioContext(); // before any await, to keep the click's permission to play audio
    templateBtn.disabled = true;
    templateBtn.textContent = 'LOADING...';
    try {
        await startVisualizer('file', await fetchAsBlobUrl(TEMPLATE.audio));
    } catch (e) {
        console.error(e);
        alert('Could not play the template!\n' + e.message);
        templateBtn.disabled = false;
        templateBtn.textContent = '▶ PLAY TEMPLATE';
    }
};
