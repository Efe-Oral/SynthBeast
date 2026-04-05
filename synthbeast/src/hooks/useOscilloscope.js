import { useEffect } from 'react';

// ── Visual constants ─────────────────────────────────────────────────────────
const BG_ACTIVE   = '#060b12';
const BG_INACTIVE = '#030609';
const GRID_DIM    = '#091b28';
const GRID_MID    = '#0d2f47';   // slightly brighter for centre lines
const TRACE_COLOR = '#00c8ff';
const TRACE_GLOW  = '#007acc';
const GRID_COLS   = 8;
const GRID_ROWS   = 6;
const DISPLAY_SAMPLES = 512;     // ~11.6 ms window at 44 100 Hz

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawBackground(ctx, w, h, active) {
  ctx.fillStyle = active ? BG_ACTIVE : BG_INACTIVE;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx, w, h) {
  ctx.lineWidth = 1;

  for (let c = 1; c < GRID_COLS; c++) {
    const x = Math.round((w / GRID_COLS) * c) + 0.5;
    ctx.strokeStyle = c === GRID_COLS / 2 ? GRID_MID : GRID_DIM;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let r = 1; r < GRID_ROWS; r++) {
    const y = Math.round((h / GRID_ROWS) * r) + 0.5;
    ctx.strokeStyle = r === GRID_ROWS / 2 ? GRID_MID : GRID_DIM;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

// Find first upward zero-crossing for a stable (non-drifting) display.
// Searches only the first half of the buffer so there's always room to draw.
function findTrigger(buffer, searchLimit) {
  const threshold = 0.008; // ignore noise floor
  for (let i = 1; i < searchLimit; i++) {
    if (buffer[i - 1] < threshold && buffer[i] >= threshold) return i;
  }
  return 0;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Drives a single oscilloscope canvas.
 *
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @param {() => AnalyserNode | null} getAnalyser  - called every frame; stable ref
 * @param {boolean} enabled
 */
export default function useOscilloscope(canvasRef, getAnalyser, enabled) {
  // Sync canvas buffer resolution to its CSS display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      canvas.width  = canvas.offsetWidth  || 512;
      canvas.height = canvas.offsetHeight || 160;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  // rAF drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dataArray = new Float32Array(2048);
    let rafId;

    function draw() {
      rafId = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;

      drawBackground(ctx, w, h, enabled);
      drawGrid(ctx, w, h);

      if (!enabled) return;

      const analyser = getAnalyser();
      if (!analyser) return;

      analyser.getFloatTimeDomainData(dataArray);

      const trigger    = findTrigger(dataArray, dataArray.length / 2);
      const sliceWidth = w / DISPLAY_SAMPLES;

      // Glow pass (wide, low alpha)
      ctx.shadowBlur   = 0;
      ctx.strokeStyle  = TRACE_GLOW;
      ctx.lineWidth    = 4;
      ctx.globalAlpha  = 0.35;
      ctx.lineJoin     = 'round';
      ctx.beginPath();
      for (let i = 0; i <= DISPLAY_SAMPLES; i++) {
        const s = dataArray[trigger + i] ?? 0;
        const x = i * sliceWidth;
        const y = ((1 - s) / 2) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Core trace pass
      ctx.globalAlpha  = 1;
      ctx.strokeStyle  = TRACE_COLOR;
      ctx.lineWidth    = 1.5;
      ctx.shadowBlur   = 8;
      ctx.shadowColor  = TRACE_COLOR;
      ctx.beginPath();
      for (let i = 0; i <= DISPLAY_SAMPLES; i++) {
        const s = dataArray[trigger + i] ?? 0;
        const x = i * sliceWidth;
        const y = ((1 - s) / 2) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Reset shadow so it doesn't bleed into grid on next frame
      ctx.shadowBlur = 0;
    }

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, getAnalyser, enabled]);
}
