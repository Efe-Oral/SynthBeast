# SynthBeast — Browser Synthesizer

## What This Is

A single-page browser synthesizer with a loop station. Users play notes via QWERTY keyboard, shape sounds using two oscillators, sculpt the tone with a drag-point EQ, record and layer loops, and export as MP3 or save the session.

## Visual Style

Epic Spell Wars aesthetic: hand-drawn thick panel borders, grungy comic-book textures, bold saturated colors, thick outlines. The oscilloscope screens are the contrast element: clean clinical CRT displays (blue phosphor glow, dark background, grid lines) embedded inside the chaotic hand-drawn UI panels, like instruments in a mad scientist's lab.

## Tech Stack

- Vite + React (no Next.js, no SSR needed)
- Tone.js for all audio (oscillators, EQ, recording)
- Web Audio API AnalyserNode for oscilloscope visualization
- Canvas API for oscilloscope rendering and custom waveform drawing
- lamejs for MP3 encoding and export
- IndexedDB for project save/load
- CSS Modules for styling

## App Structure

Three vertical zones on one page:

### Top Zone: Oscilloscope Panel

- Two side-by-side Canvas elements, one per oscillator
- Blue phosphor glow on dark background, CRT grid lines
- Live waveform trace at 60fps via requestAnimationFrame
- Oscillator 2 can be toggled on/off

### Middle Zone: Controls Panel

Per oscillator controls:

- Waveform type selector (sawtooth, square, sine, triangle)
- Custom waveform canvas: user draws shape with mouse, mapped to Tone.js PeriodicWave
- Volume knob and pitch/detune knob
- All knobs are drag-based (mouse up/down to change value)

Shared controls:

- 5-point drag EQ: SVG overlay, points draggable, mapped to Tone.Filter chain
- Drag point up/down = gain, left/right = frequency

### Bottom Zone: Loop Station

- One large RECORD button (loop pedal style)
- First press: starts recording via Tone.Recorder
- Second press: stops, creates looping Tone.Player, plays back
- Each new recording captures the full mix including active loops
- Layer counter showing number of active loops
- CLEAR ALL button
- EXPORT MP3 button (lamejs encode + browser download)
- SAVE PROJECT / LOAD PROJECT buttons (IndexedDB)

### Keyboard Strip

- Visual piano keyboard at the bottom
- QWERTY rows mapped to piano keys (standard browser synth layout)
- Keys highlight on press

## Key Technical Notes

- Each oscillator routes: OmniOscillator → GainNode → shared EQ chain → Destination
- AnalyserNode tapped off each oscillator's gain node for oscilloscope
- Custom waveform: user draws on canvas, values sampled into Float32Array, passed to Tone.PeriodicWave
- Project save: serialize oscillator settings, EQ points, custom waveform data, and loop audio buffers to IndexedDB
- MP3 export: use Tone.Recorder to capture full mix, decode to AudioBuffer, encode with lamejs

## Coding Conventions

- Functional React components with hooks only, no class components
- One component per file, named same as file
- Audio engine logic in a separate useAudioEngine hook, not inside components
- Keep components focused: UI only, no direct Tone.js calls in components
- CSS Modules only, no inline styles except for dynamic values
- No TypeScript for now, plain JavaScript

## File Structure

src/
components/
OscilloscopePanel/
ControlsPanel/
LoopStation/
KeyboardStrip/
hooks/
useAudioEngine.js
useOscilloscope.js
useLoopStation.js
utils/
mp3Export.js
projectStorage.js
App.jsx
main.jsx
