import { useRef, useState, useCallback } from 'react';
import useOscilloscope from '../../hooks/useOscilloscope';
import styles from './OscilloscopePanel.module.css';

export default function OscilloscopePanel({ audio }) {
  const [osc2Enabled, setOsc2Enabled] = useState(true);

  const canvas0Ref = useRef(null);
  const canvas1Ref = useRef(null);

  // Stable getters — audio.getAnalysers is a useCallback so its identity is stable
  const getAnalyser0 = useCallback(() => audio.getAnalysers()[0], [audio.getAnalysers]);
  const getAnalyser1 = useCallback(() => audio.getAnalysers()[1], [audio.getAnalysers]);

  useOscilloscope(canvas0Ref, getAnalyser0, true);
  useOscilloscope(canvas1Ref, getAnalyser1, osc2Enabled);

  function handleOsc2Toggle() {
    const next = !osc2Enabled;
    setOsc2Enabled(next);
    audio.setOsc2Enabled(next);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelLabel}>Oscilloscope</div>
      <div className={styles.screens}>
        <div className={styles.screen}>
          <div className={styles.screenLabel}>OSC 1</div>
          <canvas ref={canvas0Ref} className={styles.canvas} />
        </div>

        <div className={`${styles.screen} ${!osc2Enabled ? styles.screenOff : ''}`}>
          <div className={styles.screenLabel}>
            OSC 2
            <button
              className={`${styles.toggleBtn} ${osc2Enabled ? styles.toggleOn : styles.toggleOff}`}
              onClick={handleOsc2Toggle}
            >
              {osc2Enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <canvas ref={canvas1Ref} className={styles.canvas} />
        </div>
      </div>
    </div>
  );
}
