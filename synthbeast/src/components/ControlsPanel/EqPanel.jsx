import { useEffect, useRef, useMemo } from 'react';
import styles from './EqPanel.module.css';

// ── constants ─────────────────────────────────────────────────────────────────

const VB_W = 800;
const VB_H = 150;
const MIN_FREQ  =   20;
const MAX_FREQ  = 20000;
const MIN_GAIN  = -15;
const MAX_GAIN  =  15;
const ZERO_Y    = VB_H / 2;
const PT_R      = 7;
const LOG_RANGE = Math.log10(MAX_FREQ / MIN_FREQ); // = 3

const FREQ_MARKERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GAIN_MARKERS = [-12, -6, 6, 12];

// ── coordinate helpers ────────────────────────────────────────────────────────

function freqToX(freq) {
  return (Math.log10(Math.max(freq, MIN_FREQ) / MIN_FREQ) / LOG_RANGE) * VB_W;
}

function xToFreq(x) {
  return MIN_FREQ * Math.pow(10, (Math.max(0, Math.min(VB_W, x)) / VB_W) * LOG_RANGE);
}

function gainToY(gain) {
  return ((MAX_GAIN - gain) / (MAX_GAIN - MIN_GAIN)) * VB_H;
}

function yToGain(y) {
  return MAX_GAIN - (y / VB_H) * (MAX_GAIN - MIN_GAIN);
}

function svgPoint(e, svgEl) {
  const r = svgEl.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width)  * VB_W,
    y: ((e.clientY - r.top)  / r.height) * VB_H,
  };
}

// ── response curve ────────────────────────────────────────────────────────────

function buildCurvePaths(getEqResponse, N = 200) {
  const result = getEqResponse(N);
  if (!result) {
    return {
      stroke: `M0,${ZERO_Y} L${VB_W},${ZERO_Y}`,
      fill:   `M0,${ZERO_Y} L${VB_W},${ZERO_Y} L${VB_W},${ZERO_Y} L0,${ZERO_Y} Z`,
    };
  }
  const { magnitudes, frequencies } = result;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const x  = freqToX(frequencies[i]);
    const db = 20 * Math.log10(Math.max(magnitudes[i], 1e-6));
    const y  = gainToY(Math.max(MIN_GAIN, Math.min(MAX_GAIN, db)));
    pts.push({ x: x.toFixed(2), y: y.toFixed(2) });
  }
  const stroke = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fill   = stroke + ` L${VB_W},${ZERO_Y} L0,${ZERO_Y} Z`;
  return { stroke, fill };
}

// ── component ─────────────────────────────────────────────────────────────────

// bands and setEqBand come from audio (useAudioEngine) — fully controlled, no local state.
export default function EqPanel({ audio }) {
  const bands = audio.eqBands; // single source of truth
  const svgRef  = useRef(null);
  const dragRef = useRef(null);

  const { stroke: curvePath, fill: fillPath } = useMemo(
    () => buildCurvePaths(audio.getEqResponse),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bands, audio.getEqResponse],
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current || !svgRef.current) return;
      const { idx } = dragRef.current;
      const { x, y } = svgPoint(e, svgRef.current);
      const frequency = Math.round(Math.max(MIN_FREQ, Math.min(MAX_FREQ, xToFreq(x))));
      const gain      = Math.round(Math.max(MIN_GAIN, Math.min(MAX_GAIN, yToGain(y))) * 10) / 10;
      audio.setEqBand(idx, { frequency, gain }); // updates engine + eqBands state in hook
    };
    const onUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [audio]);

  function onPointDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { idx };
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>EQ</span>
      </div>

      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        <rect width={VB_W} height={VB_H} fill="#060b12" />

        {FREQ_MARKERS.map((f) => {
          const x = freqToX(f).toFixed(2);
          return (
            <g key={f}>
              <line x1={x} y1="0" x2={x} y2={VB_H} stroke="#091b28" strokeWidth="1" />
              <text x={+x + 3} y={VB_H - 4} fill="#1e4060" fontSize="9" fontFamily="monospace">
                {f >= 1000 ? `${f / 1000}k` : f}
              </text>
            </g>
          );
        })}

        {GAIN_MARKERS.map((g) => {
          const y = gainToY(g).toFixed(2);
          return (
            <g key={g}>
              <line x1="0" y1={y} x2={VB_W} y2={y} stroke="#091b28" strokeWidth="1" />
              <text x="4" y={+y - 2} fill="#1e4060" fontSize="9" fontFamily="monospace">
                {g > 0 ? `+${g}` : g}dB
              </text>
            </g>
          );
        })}

        <line x1="0" y1={ZERO_Y} x2={VB_W} y2={ZERO_Y} stroke="#0d2f47" strokeWidth="1.5" />
        <text x="4" y={ZERO_Y - 3} fill="#1e4060" fontSize="9" fontFamily="monospace">0dB</text>

        <path d={fillPath} fill="rgba(0,200,255,0.08)" />
        <path
          d={curvePath}
          fill="none"
          stroke="#00c8ff"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 0 3px #007acc)' }}
        />

        {bands.map(({ frequency, gain }, idx) => {
          const cx = freqToX(frequency).toFixed(2);
          const cy = gainToY(gain).toFixed(2);
          return (
            <g key={idx} style={{ cursor: 'grab' }}>
              <circle cx={cx} cy={cy} r={PT_R + 4} fill="none" stroke="#00c8ff" strokeWidth="1" opacity="0.25" />
              <circle
                cx={cx} cy={cy} r={PT_R}
                fill={dragRef.current?.idx === idx ? '#00c8ff' : '#003d5c'}
                stroke="#00c8ff"
                strokeWidth="1.5"
                onMouseDown={(e) => onPointDown(e, idx)}
                style={{ cursor: 'grab' }}
              />
              <text
                x={cx} y={+cy + 3.5}
                textAnchor="middle"
                fill="#00c8ff"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {idx + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className={styles.readout}>
        {bands.map(({ frequency, gain }, idx) => (
          <div key={idx} className={styles.band}>
            <span className={styles.bandFreq}>
              {frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}k` : frequency}Hz
            </span>
            <span className={`${styles.bandGain} ${gain > 0 ? styles.pos : gain < 0 ? styles.neg : ''}`}>
              {gain > 0 ? '+' : ''}{gain.toFixed(1)}dB
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
