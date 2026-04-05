import WaveformCanvas from './WaveformCanvas';
import styles from './ControlsPanel.module.css';

export default function ControlsPanel({ audio }) {
  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <WaveformCanvas oscIndex={0} label="OSC 1 — Custom Wave" audio={audio} />
        <WaveformCanvas oscIndex={1} label="OSC 2 — Custom Wave" audio={audio} />
      </div>
    </div>
  );
}
