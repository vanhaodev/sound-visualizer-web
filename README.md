# Sound Visualizer

A 3D music visualizer in the browser: a twinkling starfield floating in space, a camera that moves with the beat,
and chain lightning that jumps between the stars in time with the music.

**Live demo:** https://vanhaodev.github.io/sound-visualizer-web/

## Features

- **Two visual modes** (home dropdown + Shuffle; M switches, N toggles shuffle; mode 1 by default) - mode 1: a camera tour of the starfield with all the lightning effects;
  mode 2: a galactic giant walks through space in slow motion, filmed like a giant from street level
  (feet passing by, down the street behind and ahead of her, a slow orbit around her legs); the lightning plays in the sky over the rooftops, pinned to the city; she walks down a city street: dark buildings that light up floor by floor like a giant equalizer, faint lane markings
  and street lamps (all shader-driven, a handful of draw calls)
- **Chain lightning** - every kick starts a chain that jumps from star to star;
  harder kicks make longer chains, sustained bass keeps firing and branching, treble makes small crackles
- **Beat-synced** - arcs pulse on each kick, struck stars flash in the arc's color, the screen flashes on strong hits
- **Camera director** - 5 shots (wide orbit, close orbit, top-down, fly-through, low dolly) with smooth glides
  that start on the beat, plus motion blur while gliding and a camera shake on kicks
- **Volume-aware beat detection** - real bass band (20-150 Hz), noise gate and kick transient detection
- **Audio sources** - share system audio (Chrome/Edge), microphone / Stereo Mix, an audio file,
  or the bundled template track in one click
- **Kick shockwave** (optional) - strong kicks burst a glowing ring from the struck star that shoves nearby stars;
  turn off with `shockwaveEnabled: false` or delete its `<script>` line in `index.html`
- **Impact sparks** (optional) - every hit throws white-hot sparks that cool to the arc's color;
  turn off with `sparksEnabled: false` or delete its `<script>` line in `index.html`
- **Picture-in-picture** (Chrome/Edge) - the ⧉ button or the P key moves the visualizer into a small always-on-top
  window that keeps running while you use other apps; Esc shows/hides the on-screen controls (hidden by default)
- **Colored by frequency** - kick white, sustained bass violet, vocals pink, lead cyan, hi-hats gold
- **Two lightning styles** - `hd` (sharp, full resolution) or `pixel` (chunky pixel-art look)

## Run locally

Opening `index.html` directly over `file://` does not work (browsers block ES modules and audio analysis there),
so serve it locally:

```bash
npm start          # or double-click start-visualizer.cmd on Windows
```

Then open http://localhost:5173. Requires Node.js; there are no dependencies to install.

## Change the template tracks

The template panel has a dropdown of bundled tracks. Replace `static/sample_song.mp3` or
`static/sample_song_2.mp3` with any mp3 using the same file name - no code changes needed.
To add more, drop an mp3 into `static/` and add a row to `TEMPLATES` in `js/template-preset-player.js`.

## Tweak it

All settings live in `js/visualizer-config-and-state.js`, each with a comment: beat detector thresholds,
lightning (chain length, hop speed, density, fade, style), camera pacing and motion blur.

## Deployment

Hosted for free on **GitHub Pages**, built from the root of the `main` branch
(repo Settings -> Pages). Every push to `main` redeploys the site within about a minute.

GitHub Pages lets browsers cache files for 10 minutes, so CSS/JS URLs carry an asset version (`?v=6`).
When you change any CSS/JS file, bump that number everywhere it appears (`index.html` and the imports at the
top of `js/music-reactive-lightning.js`), otherwise visitors may get a new page with old cached scripts.

### Release zip for other hosts

```
npm run build      # -> release/sound-visualizer-web.zip
```

Packs only what the page needs at runtime (`index.html`, `css/`, `js/`, `static/`), without the dev server,
scripts, docs or git files. Unzip it into the host's web root. No dependencies, plain Node.

## Project structure

```
index.html                              start screen + script loading order
css/visualizer-styles.css               UI styles
js/visualizer-config-and-state.js       CONFIG + shared state
js/audio-source-selector-and-start.js   audio sources, analyser setup, start
js/template-preset-player.js            template track dropdown + one-click play
js/visualizer-animation-loop.js         beat detection + render loop
js/three-scene-setup.js                 starfield scene
js/camera-director-shots.js             camera shots and transitions
js/visual-mode-switcher.js              mode dropdown + shuffle, M / N keys
js/motion-trail-renderer.js             motion blur (afterimage trails)
js/music-reactive-lightning.js          chain lightning driven by the music (ES module)
js/lightning-bolt-geometry-3d.js        3D bolt shapes with forks
js/lightning-frequency-colors.js        band colors + vocal/lead onset detector
js/lightning-star-targets.js            picks stars to strike, flashes them
js/kick-shockwave-rings.js              optional kick shockwave ring + star push
js/lightning-impact-sparks.js           optional sparks where lightning hits
js/picture-in-picture-window.js         optional always-on-top mini window
js/galaxy-walker-model.js               optional mode 2: the walking model, her lights, lightning focus
js/camera-walker-follow-shots.js        mode 2 camera shots around the model
js/deep-space-backdrop.js               optional far-away star shell behind everything
js/giant-city-buildings.js              optional mode 2 city: dark buildings, windows flickering / flashing on the beat
js/giant-city-street.js                 mode 2 street: ground + lane markings, street lamps
js/giant-city-layout.js                 shared city layout + shader helpers (flow/wrap, fog)
js/giant-city-sky-anchors.js            mode 2 sky lightning anchors, flowing with the city
static/models/miss_galaxy.glb           the mode 2 model (CC BY 4.0, see Credits)
serve-visualizer-locally.js             tiny local static server
build-release-zip.js                    npm run build -> minimal release zip
```

## Credits

Made by [vanhaodev](https://github.com/vanhaodev). Built with [three.js](https://threejs.org/) r128.
The sample tracks are included for demo purposes only, see `static/readme.txt`.

Mode 2 model: ["Miss Galaxy"](https://sketchfab.com/3d-models/miss-galaxy-32ca79bf7c4043dcbc36d28b22436303)
by [Donte_Loves_Art](https://sketchfab.com/Donte_Loves_Art), licensed under
[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Used unmodified (scaled and lit at runtime).
