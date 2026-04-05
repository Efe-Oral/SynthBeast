import { useState } from 'react';
import { exportMp3 }   from '../../utils/mp3Export';
import { saveProject, loadProject } from '../../utils/projectStorage';
import styles from './LoopStation.module.css';

const EXPORT_DURATION_SEC = 30;

export default function LoopStation({ audio, loopStation }) {
  const { isRecording, layerCount, handleRecord, clearAll, getLoopBuffers, loadLoops } = loopStation;

  const [exportState, setExportState] = useState('idle'); // 'idle' | 'capturing' | 'encoding'
  const [progress,    setProgress]    = useState(0);
  const [saveStatus,  setSaveStatus]  = useState('idle'); // 'idle' | 'saving' | 'saved' | 'loading' | 'error'

  // ── Export MP3 ───────────────────────────────────────────────────────────────

  async function handleExport() {
    if (exportState !== 'idle') return;
    setExportState('capturing');
    setProgress(0);
    try {
      await exportMp3(EXPORT_DURATION_SEC, (p) => {
        if (p >= 1) setExportState('encoding');
        setProgress(p);
      });
    } finally {
      setExportState('idle');
      setProgress(0);
    }
  }

  const exportLabel =
    exportState === 'capturing' ? `CAPTURING ${Math.round(progress * 100)}%` :
    exportState === 'encoding'  ? 'ENCODING…' :
    'EXPORT MP3';

  // ── Save project ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (saveStatus !== 'idle') return;
    setSaveStatus('saving');
    try {
      const audioState = audio.getProjectState();
      const loops      = getLoopBuffers();
      await saveProject({ ...audioState, loops });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (err) {
      console.error('[LoopStation] save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }

  // ── Load project ─────────────────────────────────────────────────────────────

  async function handleLoad() {
    if (saveStatus !== 'idle') return;
    setSaveStatus('loading');
    try {
      const data = await loadProject();
      if (!data) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return;
      }
      audio.restoreProjectState(data);
      await loadLoops(data.loops || []);
      setSaveStatus('idle');
    } catch (err) {
      console.error('[LoopStation] load failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }

  const saveLabel =
    saveStatus === 'saving'  ? 'SAVING…'  :
    saveStatus === 'saved'   ? 'SAVED ✓'  :
    saveStatus === 'loading' ? 'LOADING…' :
    saveStatus === 'error'   ? 'FAILED ✗' :
    'SAVE';

  const loadLabel = saveStatus === 'loading' ? 'LOADING…' : 'LOAD';

  const persistBusy = saveStatus !== 'idle';

  return (
    <div className={styles.panel}>
      <div className={styles.panelLabel}>Loop Station</div>
      <div className={styles.inner}>

        {/* RECORD */}
        <button
          className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
          onClick={handleRecord}
          disabled={exportState !== 'idle'}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <span className={styles.recordDot} />
          {isRecording ? 'STOP' : 'REC'}
        </button>

        {/* Layer counter */}
        <div className={styles.counter}>
          <span className={styles.counterNum}>{layerCount}</span>
          <span className={styles.counterLabel}>LOOP{layerCount !== 1 ? 'S' : ''}</span>
        </div>

        {/* Status pill */}
        <div className={`${styles.status} ${isRecording ? styles.statusRecording : ''}`}>
          {isRecording ? 'RECORDING…' : layerCount > 0 ? 'PLAYING' : 'READY'}
        </div>

        {/* Export MP3 */}
        <button
          className={`${styles.exportBtn} ${exportState !== 'idle' ? styles.exporting : ''}`}
          onClick={handleExport}
          disabled={exportState !== 'idle'}
        >
          {exportLabel}
        </button>

        {/* Save / Load */}
        <div className={styles.persistGroup}>
          <button
            className={`${styles.persistBtn} ${saveStatus === 'saved' ? styles.persistOk : saveStatus === 'error' ? styles.persistErr : ''}`}
            onClick={handleSave}
            disabled={persistBusy}
          >
            {saveLabel}
          </button>
          <button
            className={styles.persistBtn}
            onClick={handleLoad}
            disabled={persistBusy}
          >
            {loadLabel}
          </button>
        </div>

        {/* Clear all */}
        <button
          className={styles.clearBtn}
          onClick={clearAll}
          disabled={layerCount === 0 && !isRecording}
        >
          CLEAR ALL
        </button>

      </div>

      {/* Export progress bar */}
      {exportState !== 'idle' && (
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
