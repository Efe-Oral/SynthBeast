import OscilloscopePanel from './components/OscilloscopePanel/OscilloscopePanel';
import ControlsPanel from './components/ControlsPanel/ControlsPanel';
import LoopStation from './components/LoopStation/LoopStation';
import KeyboardStrip from './components/KeyboardStrip/KeyboardStrip';
import useAudioEngine from './hooks/useAudioEngine';
import useLoopStation from './hooks/useLoopStation';
import styles from './App.module.css';

export default function App() {
  const audio       = useAudioEngine();
  const loopStation = useLoopStation();

  return (
    <div className={styles.app}>
      <div className={styles.title}>Synthbeast</div>
      <OscilloscopePanel audio={audio} />
      <ControlsPanel audio={audio} />
      <LoopStation audio={audio} loopStation={loopStation} />
      <KeyboardStrip audio={audio} />
    </div>
  );
}
