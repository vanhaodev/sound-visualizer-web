// Right-hand panel: pick one of the bundled tracks in static/ and play it in one click, no file picking.
// To change a track, just overwrite its mp3 (same file name) - no code changes needed; add a row to add a track

const TEMPLATES = [
    { title: 'Sample Song 1', audio: 'static/sample_song.mp3' },
    { title: 'Sample Song 2', audio: 'static/sample_song_2.mp3' }
];

const templateBtn = $('btn-template');
const templateSelect = $('template-select');
TEMPLATES.forEach((t, i) => templateSelect.add(new Option(t.title, i)));

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
        await startVisualizer('file', await fetchAsBlobUrl(TEMPLATES[templateSelect.value].audio));
    } catch (e) {
        console.error(e);
        alert('Could not play the template!\n' + e.message);
        templateBtn.disabled = false;
        templateBtn.textContent = '▶ PLAY TEMPLATE';
    }
};
