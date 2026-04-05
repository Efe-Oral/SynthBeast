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
    getAnalysers,
  };
}
