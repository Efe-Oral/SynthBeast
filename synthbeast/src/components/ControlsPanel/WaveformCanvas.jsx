import { useRef, useEffect, useCallback } from 'react';
import styles from './WaveformCanvas.module.css';

const SAMPLES   = 256;
const GRID_COLS = 8;
const GRID_ROWS = 4;
const BG     = '#060b12';
const GRID   = '#091b28';
const CENTER = '#0d2f47';
const TRACE  = '#ff8c00';
const GLOW   = '#aa4400';

// ── canvas drawing ────────────────────────────────────────────────────────────

function drawGrid(ctx, w, h) {
  ctx.lineWidth = 1;
  for (let c = 1; c < GRID_COLS; c++) {
    const x = Math.round((w / GRID_COLS) * c) + 0.5;
    ctx.strokeStyle = c === GRID_COLS / 2 ? CENTER : GRID;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    const y = Math.round((h / GRID_ROWS) * r) + 0.5;
    ctx.strokeStyle = r === GRID_ROWS / 2 ? CENTER : GRID;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function redraw(canvas, samples) {
  const ctx = canvas.getContext('2d');
  const w   = canvas.width;
  const h   = canvas.height;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  // Glow pass
  ctx.strokeStyle  = GLOW;
  ctx.lineWidth    = 4;
  ctx.globalAlpha  = 0.35;
  ctx.lineJoin     = 'round';
  ctx.beginPath();
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * w;
    const y = ((1 - samples[i]) / 2) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Core trace
  ctx.globalAlpha  = 1;
  ctx.strokeStyle  = TRACE;
  ctx.lineWidth    = 1.5;
  ctx.shadowBlur   = 7;
  ctx.shadowColor  = TRACE;
  ctx.beginPath();
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * w;
    const y = ((1 - samples[i]) / 2) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function WaveformCanvas({ oscIndex, label, audio }) {
  const canvasRef  = useRef(null);
  const samplesRef = useRef(new Float32Array(SAMPLES)); // all-zero = flat line
  const isDrawing  = useRef(false);
  const prevPos    = useRef({ x: 0, y: 0 });

  // Sync canvas buffer size to CSS display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      canvas.width  = canvas.offsetWidth  || 256;
      canvas.height = canvas.offsetHeight || 80;
      redraw(canvas, samplesRef.current);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── pointer helpers ──────────────────────────────────────────────────────

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pixelToSample(x, y) {
    const canvas = canvasRef.current;
    const idx = Math.round((x / canvas.offsetWidth)  * (SAMPLES - 1));
    const val = 1.0 - (2.0 * y) / canvas.offsetHeight;
    return {
      idx: Math.max(0, Math.min(SAMPLES - 1, idx)),
      val: Math.max(-1, Math.min(1, val)),
    };
  }

  // Fill samples between prevPos and current position (handles fast mouse moves)
  function stampLine(x, y) {
    const cur  = pixelToSample(x, y);
    const prev = pixelToSample(prevPos.current.x, prevPos.current.y);
    const steps = Math.max(Math.abs(cur.idx - prev.idx), 1);
    for (let s = 0; s <= steps; s++) {
      const t  = s / steps;
      const si = Math.round(prev.idx + t * (cur.idx - prev.idx));
      samplesRef.current[Math.max(0, Math.min(SAMPLES - 1, si))] =
        prev.val + t * (cur.val - prev.val);
    }
    prevPos.current = { x, y };
  }

  // ── mouse handlers ───────────────────────────────────────────────────────

  const onMouseDown = useCallback((e) => {
    isDrawing.current = true;
    const { x, y }   = getPos(e);
    prevPos.current   = { x, y };
    stampLine(x, y);
    redraw(canvasRef.current, samplesRef.current);
    audio.setCustomWaveform(oscIndex, samplesRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, oscIndex]);

  const onMouseMove = useCallback((e) => {
    if (!isDrawing.current) return;
    const { x, y } = getPos(e);
    stampLine(x, y);
    redraw(canvasRef.current, samplesRef.current);
    audio.setCustomWaveform(oscIndex, samplesRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, oscIndex]);

  const onMouseUp = useCallback(() => {
    isDrawing.current = false;
  }, []);

  // ── reset button ─────────────────────────────────────────────────────────

  function handleReset() {
    samplesRef.current.fill(0);
    redraw(canvasRef.current, samplesRef.current);
    // Revert oscillator to its default preset type (clears _wave internally)
    audio.setWaveform(oscIndex, 'sawtooth');
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <button className={styles.resetBtn} onClick={handleReset}>RESET</button>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <span className={styles.hint}>drag to draw custom waveform</span>
    </div>
  );
}
