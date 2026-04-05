import * as Tone from 'tone';
import lamejs from 'lamejs';

/**
 * Record the live mix for `durationSec` seconds, encode to MP3 via lamejs,
 * and trigger a browser download.
 *
 * @param {number} durationSec  How many seconds to capture (default 30)
 * @param {function} onProgress Optional callback(0–1) called during encoding
 */
export async function exportMp3(durationSec = 30, onProgress) {
  await Tone.start();

  // ── 1. Record the full mix ──────────────────────────────────────────────────
  const recorder = new Tone.Recorder();
  Tone.getDestination().connect(recorder);
  recorder.start();

  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

  const blob = await recorder.stop();
  Tone.getDestination().disconnect(recorder);
  recorder.dispose();

  // ── 2. Decode to AudioBuffer ────────────────────────────────────────────────
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx    = Tone.getContext().rawContext;
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate  = audioBuffer.sampleRate;

  // Get mono or stereo PCM as Float32 in [-1, 1]
  const left  = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  // ── 3. Encode with lamejs ───────────────────────────────────────────────────
  const kbps    = 128;
  const encoder = new lamejs.Mp3Encoder(2, sampleRate, kbps);
  const chunks  = [];

  // lamejs expects Int16 samples; process in blocks of 1152 (lame's standard frame size)
  const BLOCK = 1152;
  const total = left.length;

  for (let i = 0; i < total; i += BLOCK) {
    const end     = Math.min(i + BLOCK, total);
    const leftInt  = floatToInt16(left.subarray(i, end));
    const rightInt = floatToInt16(right.subarray(i, end));

    const encoded = encoder.encodeBuffer(leftInt, rightInt);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));

    if (onProgress) onProgress(Math.min(i / total, 0.99));
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(new Uint8Array(flushed));
  if (onProgress) onProgress(1);

  // ── 4. Trigger download ─────────────────────────────────────────────────────
  const mp3Blob = new Blob(chunks, { type: 'audio/mpeg' });
  const url     = URL.createObjectURL(mp3Blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `synthbeast-${Date.now()}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
}

// Convert Float32Array [-1,1] → Int16Array for lamejs
function floatToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
