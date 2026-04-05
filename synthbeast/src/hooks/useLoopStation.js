import { useState, useRef, useCallback } from 'react';
import * as Tone from 'tone';

const STATE = { IDLE: 'idle', RECORDING: 'recording' };

export default function useLoopStation() {
  const [recordState, setRecordState] = useState(STATE.IDLE);
  const [layerCount,  setLayerCount]  = useState(0);

  const recorderRef    = useRef(null); // Tone.Recorder while recording
  const playersRef     = useRef([]);   // active Tone.Player instances
  const loopBuffersRef = useRef([]);   // ArrayBuffer per loop (for save)

  // First press → start recording. Second press → stop, create looping player.
  const handleRecord = useCallback(async () => {
    await Tone.start();

    if (recordState === STATE.IDLE) {
      const recorder = new Tone.Recorder();
      Tone.getDestination().connect(recorder);
      recorder.start();
      recorderRef.current = recorder;
      setRecordState(STATE.RECORDING);
    } else {
      const recorder = recorderRef.current;
      if (!recorder) return;

      const blob = await recorder.stop();
      Tone.getDestination().disconnect(recorder);
      recorder.dispose();
      recorderRef.current = null;

      // Keep the ArrayBuffer for project save
      const arrayBuffer = await blob.arrayBuffer();
      loopBuffersRef.current.push(arrayBuffer);

      const url = URL.createObjectURL(new Blob([arrayBuffer]));
      const player = new Tone.Player({ url, loop: true, autostart: true }).toDestination();
      playersRef.current.push(player);

      setLayerCount((n) => n + 1);
      setRecordState(STATE.IDLE);
    }
  }, [recordState]);

  // Stop and destroy every active player
  const clearAll = useCallback(() => {
    playersRef.current.forEach((p) => { p.stop(); p.dispose(); });
    playersRef.current  = [];
    loopBuffersRef.current = [];
    setLayerCount(0);

    if (recorderRef.current) {
      recorderRef.current.stop().catch(() => {});
      Tone.getDestination().disconnect(recorderRef.current);
      recorderRef.current.dispose();
      recorderRef.current = null;
      setRecordState(STATE.IDLE);
    }
  }, []);

  // Returns a copy of the stored ArrayBuffers for project save
  const getLoopBuffers = useCallback(() => [...loopBuffersRef.current], []);

  // Restore loops from saved ArrayBuffers (called during project load)
  const loadLoops = useCallback(async (arrayBuffers) => {
    // Tear down whatever is currently playing
    playersRef.current.forEach((p) => { p.stop(); p.dispose(); });
    playersRef.current     = [];
    loopBuffersRef.current = [];
    setLayerCount(0);

    if (!arrayBuffers || arrayBuffers.length === 0) return;

    await Tone.start();

    for (const ab of arrayBuffers) {
      loopBuffersRef.current.push(ab);
      const url    = URL.createObjectURL(new Blob([ab]));
      const player = new Tone.Player({ url, loop: true, autostart: true }).toDestination();
      playersRef.current.push(player);
    }

    setLayerCount(arrayBuffers.length);
  }, []);

  return {
    recordState,
    layerCount,
    isRecording: recordState === STATE.RECORDING,
    handleRecord,
    clearAll,
    getLoopBuffers,
    loadLoops,
  };
}
