# Storm 3D - Sound Visualizer

A 3D music visualizer in the browser: Matrix rain floating in space, a camera that moves with the beat,
and chain lightning that jumps between the characters in time with the music.

**Live demo:** https://vanhaodev.github.io/sound-visualizer-web/

## Features

- **Chain lightning** - every kick starts a chain that jumps from character to character (x -> y -> j -> k);
  harder kicks make longer chains, sustained bass keeps firing and branching, treble makes small crackles
- **Beat-synced** - arcs pulse white-hot on each kick, struck characters flash, the screen flashes on strong hits
- **Camera director** - 5 shots (wide orbit, close orbit, top-down, fly-through, low dolly) with smooth glides
  that start on the beat, plus motion blur while gliding and a camera shake on kicks
- **Volume-aware beat detection** - real bass band (20-150 Hz), noise gate and kick transient detection
- **Audio sources** - share system audio (Chrome/Edge), microphone / Stereo Mix, an audio file,
  or the bundled template track in one click
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

GitHub Pages lets browsers cache files for 10 minutes, so CSS/JS URLs carry an asset version (`?v=5`).
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
js/three-scene-setup.js                 Matrix rain scene
js/camera-director-shots.js             camera shots and transitions
js/motion-trail-renderer.js             motion blur (afterimage trails)
js/music-reactive-lightning.js          chain lightning driven by the music (ES module)
js/lightning-bolt-geometry-3d.js        3D bolt shapes with forks
js/lightning-letter-targets.js          picks characters to strike, flashes them
serve-visualizer-locally.js             tiny local static server
build-release-zip.js                    npm run build -> minimal release zip
```

## Credits

Made by [vanhaodev](https://github.com/vanhaodev). Built with [three.js](https://threejs.org/) r128.
The sample tracks are included for demo purposes only, see `static/readme.txt`.
