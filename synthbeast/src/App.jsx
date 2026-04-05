import OscilloscopePanel from './components/OscilloscopePanel/OscilloscopePanel';
import ControlsPanel from './components/ControlsPanel/ControlsPanel';
import LoopStation from './components/LoopStation/LoopStation';
import KeyboardStrip from './components/KeyboardStrip/KeyboardStrip';
import useAudioEngine from './hooks/useAudioEngine';
import styles from './App.module.css';

export default function App() {
  const audio = useAudioEngine();

  return (
    <div className={styles.app}>
      {/* Temporary test controls — remove when audio engine is wired into real UI */}
      <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => audio.startOsc(0)}>Start Osc 1</button>
        <button onClick={() => audio.stopOsc(0)}>Stop Osc 1</button>
        <button onClick={() => audio.startOsc(1)}>Start Osc 2</button>
        <button onClick={() => audio.stopOsc(1)}>Stop Osc 2</button>
      </div>
      <OscilloscopePanel />
      <ControlsPanel />
      <LoopStation />
      <KeyboardStrip />
    </div>
  );
}
