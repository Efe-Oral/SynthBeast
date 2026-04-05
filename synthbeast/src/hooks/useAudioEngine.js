import { useEffect, useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';

const DEFAULT_EQ_BANDS = [
  { frequency: 80,    gain: 0 },
  { frequency: 240,   gain: 0 },
  { frequency: 2400,  gain: 0 },
  { frequency: 8000,  gain: 0 },
  { frequency: 16000, gain: 0 },
];

export default function useAudioEngine() {
  const engineRef      = useRef(null);
  const analyserRefs   = useRef([null, null]);
  // Stores the last Float32Array samples drawn per oscillator (needed for save)
  const customWaveRefs = useRef([null, null]);

  // EQ bands live here as React state so EqPanel is fully controlled and
  // save/load has a single source of truth.
  const [eqBands, setEqBandsState] = useState(DEFAULT_EQ_BANDS);

  useEffect(() => {
    // 5-band EQ chain → Destination
    const eqFilters = [
      new Tone.Filter({ frequency: 80,    type: 'lowshelf',  gain: 0, Q: 0.7,  rolloff: -12 }),
      new Tone.Filter({ frequency: 240,   type: 'peaking',   gain: 0, Q: 1.5,  rolloff: -12 }),
      new Tone.Filter({ frequency: 2400,  type: 'peaking',   gain: 0, Q: 1.5,  rolloff: -12 }),
      new Tone.Filter({ frequency: 8000,  type: 'peaking',   gain: 0, Q: 1.5,  rolloff: -12 }),
      new Tone.Filter({ frequency: 16000, type: 'highshelf', gain: 0, Q: 0.7,  rolloff: -12 }),
    ];
    for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
    eqFilters[eqFilters.length - 1].toDestination();

    // Per-oscillator: OmniOscillator → Gain → EQ chain
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
    gains[0].connect(eqFilters[0]);
    gains[1].connect(eqFilters[0]);

    // Tap a native AnalyserNode off each gain output for oscilloscope use
    const rawCtx = Tone.getContext().rawContext;
    const analysers = oscs.map((_, i) => {
      const analyser = rawCtx.createAnalyser();
      analyser.fftSize = 2048;
      gains[i].output.connect(analyser);
      return analyser;
    });

    analyserRefs.current = analysers;
    engineRef.current = { oscs, gains, eqFilters };

    return () => {
      oscs.forEach((o) => o.dispose());
      gains.forEach((g) => g.dispose());
      eqFilters.forEach((f) => f.dispose());
      analyserRefs.current = [null, null];
      engineRef.current = null;
    };
  }, []);

  const osc2EnabledRef = useRef(true);

  const startOsc = useCallback(async (index) => {
    await Tone.start();
    const e = engineRef.current;
    if (!e) return;
    const osc = e.oscs[index];
    if (osc.state === 'stopped') osc.start();
  }, []);

  const stopOsc = useCallback((index) => {
    const e = engineRef.current;
    if (!e) return;
    const osc = e.oscs[index];
    if (osc.state === 'started') osc.stop();
  }, []);

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
  }, []);

  const releaseNote = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs.forEach((osc) => { if (osc.state === 'started') osc.stop(); });
  }, []);

  const setOsc2Enabled = useCallback((enabled) => {
    osc2EnabledRef.current = enabled;
    const e = engineRef.current;
    if (!e) return;
    if (!enabled && e.oscs[1].state === 'started') e.oscs[1].stop();
  }, []);

  const setVolume = useCallback((index, value) => {
    const e = engineRef.current;
    if (!e) return;
    e.gains[index].gain.value = Math.max(0, Math.min(1, value));
  }, []);

  const setFrequency = useCallback((index, freq) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].frequency.value = freq;
  }, []);

  const setDetune = useCallback((index, cents) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].detune.value = cents;
  }, []);

  const setWaveform = useCallback((index, type) => {
    const e = engineRef.current;
    if (!e) return;
    e.oscs[index].type = type;
  }, []);

  // Shared DFT logic used by both setCustomWaveform and restoreProjectState
  function applyPeriodicWave(index, samples) {
    const e = engineRef.current;
    if (!e) return;
    const N = samples.length;
    const numHarmonics = Math.min(256, Math.floor(N / 2));
    const real = new Float32Array(numHarmonics + 1);
    const imag = new Float32Array(numHarmonics + 1);
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
    const innerOsc = e.oscs[index]._oscillator;
    if (innerOsc) {
      innerOsc._wave = wave;
      innerOsc._partials = [];
      innerOsc._partialCount = 0;
      if (innerOsc._oscillator) innerOsc._oscillator.setPeriodicWave(wave);
    }
  }

  const setCustomWaveform = useCallback((index, samples) => {
    customWaveRefs.current[index] = samples.slice(); // keep a copy for save
    applyPeriodicWave(index, samples);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update one EQ band in the engine AND in React state
  const setEqBand = useCallback((index, { frequency, gain }) => {
    const e = engineRef.current;
    if (!e) return;
    e.eqFilters[index].frequency.value = frequency;
    e.eqFilters[index].gain.value      = gain;
    setEqBandsState((prev) => {
      const next = [...prev];
      next[index] = { frequency, gain };
      return next;
    });
  }, []);

  const getEqResponse = useCallback((N = 200) => {
    const e = engineRef.current;
    if (!e) return null;
    const combined = new Float32Array(N).fill(1);
    for (const filter of e.eqFilters) {
      const resp = filter.getFrequencyResponse(N);
      for (let i = 0; i < N; i++) combined[i] *= resp[i];
    }
    const frequencies = new Float32Array(N);
    for (let i = 0; i < N; i++) frequencies[i] = Math.pow(i / N, 2) * 19980 + 20;
    return { magnitudes: combined, frequencies };
  }, []);

  // ── Project save/load ────────────────────────────────────────────────────────

  /**
   * Returns a plain-JS snapshot of all audio engine settings.
   * customWave is stored as a plain Array (JSON-safe) so IndexedDB can clone it.
   */
  const getProjectState = useCallback(() => {
    const e = engineRef.current;
    if (!e) return null;
    return {
      oscillators: e.oscs.map((osc, i) => ({
        type:       osc.type,
        volume:     e.gains[i].gain.value,
        frequency:  osc.frequency.value,
        detune:     osc.detune.value,
        customWave: customWaveRefs.current[i]
          ? Array.from(customWaveRefs.current[i])
          : null,
      })),
      eqBands: e.eqFilters.map((f) => ({
        frequency: f.frequency.value,
        gain:      f.gain.value,
      })),
    };
  }, []);

  /**
   * Restores all audio engine settings from a previously saved snapshot.
   */
  const restoreProjectState = useCallback((state) => {
    const e = engineRef.current;
    if (!e || !state) return;

    // Oscillators
    (state.oscillators || []).forEach(({ type, volume, frequency, detune, customWave }, i) => {
      if (type)       e.oscs[i].type                 = type;
      if (volume != null) e.gains[i].gain.value       = volume;
      if (frequency != null) e.oscs[i].frequency.value = frequency;
      if (detune != null)    e.oscs[i].detune.value    = detune;
      if (customWave) {
        const samples = new Float32Array(customWave);
        customWaveRefs.current[i] = samples;
        applyPeriodicWave(i, samples);
      }
    });

    // EQ
    const bands = state.eqBands || [];
    bands.forEach(({ frequency, gain }, i) => {
      e.eqFilters[i].frequency.value = frequency;
      e.eqFilters[i].gain.value      = gain;
    });
    if (bands.length) setEqBandsState(bands);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    eqBands,
    setEqBand,
    getEqResponse,
    getProjectState,
    restoreProjectState,
    getAnalysers,
  };
}
