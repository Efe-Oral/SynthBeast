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
      <OscilloscopePanel />
      <ControlsPanel />
      <LoopStation />
      <KeyboardStrip audio={audio} />
    </div>
  );
}
