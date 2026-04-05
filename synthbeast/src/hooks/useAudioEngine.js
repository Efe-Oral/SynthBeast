import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

export default function useAudioEngine() {
  const engineRef = useRef(null);
  const analyserRefs = useRef([null, null]);

  useEffect(() => {
    // Shared filter chain -> destination
    const filter = new Tone.Filter({ frequency: 8000, type: 'lowpass' });
    filter.toDestination();

    // Per-oscillator: OmniOscillator -> Gain -> filter
    const oscs = [
      new Tone.OmniOscillator({ frequency: 440, type: 'sawtooth' }),
      new Tone.OmniOscillator({ frequency: 440, type: 'sawtooth' }),
    ];
    const gains = [
      new Tone.Gain(0.7),
      new Tone.Gain(0.7),
    ];

    oscs[0].connect(gains[0]);
    oscs[1].connect(gains[1]);
    gains[0].connect(filter);
    gains[1].connect(filter);

    // Tap a native AnalyserNode off each gain output for oscilloscope use
    const rawCtx = Tone.getContext().rawContext;
    const analysers = oscs.map((_, i) => {
      const analyser = rawCtx.createAnalyser();
      analyser.fftSize = 2048;
      // gains[i].output is the native GainNode — fan out to analyser
      gains[i].output.connect(analyser);
      return analyser;
    });

    analyserRefs.current = analysers;
    engineRef.current = { oscs, gains, filter };

    return () => {
      oscs.forEach((o) => o.dispose());
      gains.forEach((g) => g.dispose());
      filter.dispose();
      analyserRefs.current = [null, null];
      engineRef.current = null;
    };
  }, []);

  // osc2 can be toggled off; osc1 is always active
  const osc2EnabledRef = useRef(true);

  const startOsc = useCallback(async (index) => {
    await Tone.start(); // unlock AudioContext on first user gesture
    const e = engineRef.current;
    if (!e) return;
    const osc = e.oscs[index];
    if (osc.state === 'stopped') {
      osc.start();
      console.log(`[AudioEngine] Oscillator ${index + 1} started — state: ${osc.state}`);
    }
  }, []);

  const stopOsc = useCallback((index) => {
    const e = engineRef.current;
    if (!e) return;
    const osc = e.oscs[index];
    if (osc.state === 'started') {
      osc.stop();
      console.log(`[AudioEngine] Oscillator ${index + 1} stopped`);
    }
  }, []);

  // Play a note on all active oscillators. note: Tone.js frequency string e.g. 'C4', 'A#3', or Hz number.
  const playNote = useCallback(async (note) => {
    await Tone.start();
    const e = engineRef.current;
    if (!e) return;
    e.oscs[0].frequency.value = note;
    if (e.oscs[0].state === 'stopped') e.oscs[0].start();

    if (osc2EnabledRef.current) {
      e.oscs[1].frequency.value = note;
      if (e.oscs[1].state === 'stopped') e.oscs[1].start();
    }
    console.log(`[AudioEngine] playNote: ${note}`);
  }, []);

  // Stop all active oscillators (called when last key is released)
  const releaseNote = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs.forEach((osc) => {
      if (osc.state === 'started') osc.stop();
    });
    console.log('[AudioEngine] releaseNote');
  }, []);

  const setOsc2Enabled = useCallback((enabled) => {
    osc2EnabledRef.current = enabled;
    const e = engineRef.current;
    if (!e) return;
    if (!enabled && e.oscs[1].state === 'started') e.oscs[1].stop();
  }, []);

  // value: 0–1 linear gain
  const setVolume = useCallback((index, value) => {
    const e = engineRef.current;
    if (!e) return;
    e.gains[index].gain.value = Math.max(0, Math.min(1, value));
  }, []);

  // freq in Hz or note name (e.g. 'C4')
  const setFrequency = useCallback((index, freq) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].frequency.value = freq;
  }, []);

  // cents offset, positive or negative
  const setDetune = useCallback((index, cents) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].detune.value = cents;
  }, []);

  // type: 'sawtooth' | 'square' | 'sine' | 'triangle' (or Tone prefixed variants)
  const setWaveform = useCallback((index, type) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].type = type;
  }, []);

  /**
   * Apply an arbitrary one-period waveform to an oscillator.
   * Computes the full DFT (real + imaginary) of the time-domain samples
   * and stores the resulting PeriodicWave on Tone's internal _wave field so it
   * survives start/stop cycles automatically.
   *
   * @param {number} index  0 or 1
   * @param {Float32Array} samples  normalised time-domain values in [-1, 1]
   */
  const setCustomWaveform = useCallback((index, samples) => {
    const e = engineRef.current;
    if (!e) return;

    const N = samples.length;
    const numHarmonics = Math.min(256, Math.floor(N / 2));
    const real = new Float32Array(numHarmonics + 1); // real[0] = DC, always 0
    const imag = new Float32Array(numHarmonics + 1);

    // Full DFT — both cosine (real) and sine (imag) components
    for (let k = 1; k <= numHarmonics; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += samples[n] * Math.cos(angle);
        im += samples[n] * Math.sin(angle);
      }
      real[k] = (2 / N) * re;
      imag[k] = (2 / N) * im;
    }

    const rawCtx = Tone.getContext().rawContext;
    const wave = rawCtx.createPeriodicWave(real, imag);

    // Reach into Tone.Oscillator's internals to set _wave directly.
    // _wave is checked in Oscillator._start() before falling back to _type,
    // so it persists across every start/stop cycle automatically.
    const innerOsc = e.oscs[index]._oscillator; // Tone.Oscillator
    if (innerOsc) {
      innerOsc._wave = wave;
      innerOsc._partials = [];      // prevent stale partials from overriding
      innerOsc._partialCount = 0;
      if (innerOsc._oscillator) {   // native OscillatorNode (non-null while running)
        innerOsc._oscillator.setPeriodicWave(wave);
      }
    }
  }, []);

  // Returns the two native AnalyserNodes (may be null before mount)
  const getAnalysers = useCallback(() => analyserRefs.current, []);

  return {
    startOsc,
    stopOsc,
    playNote,
    releaseNote,
    setOsc2Enabled,
    setVolume,
    setFrequency,
    setDetune,
    setWaveform,
    setCustomWaveform,
    getAnalysers,
  };
}
