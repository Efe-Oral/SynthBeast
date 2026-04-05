import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './KeyboardStrip.module.css';

// Standard browser-synth QWERTY-to-piano mapping, one chromatic octave (C4–B4)
// White keys on bottom QWERTY row, black keys on home row
const KEYBOARD_MAP = [
  { note: 'C4',  key: 'z', isBlack: false, label: 'C' },
  { note: 'C#4', key: 's', isBlack: true  },
  { note: 'D4',  key: 'x', isBlack: false, label: 'D' },
  { note: 'D#4', key: 'd', isBlack: true  },
  { note: 'E4',  key: 'c', isBlack: false, label: 'E' },
  { note: 'F4',  key: 'v', isBlack: false, label: 'F' },
  { note: 'F#4', key: 'g', isBlack: true  },
  { note: 'G4',  key: 'b', isBlack: false, label: 'G' },
  { note: 'G#4', key: 'h', isBlack: true  },
  { note: 'A4',  key: 'n', isBlack: false, label: 'A' },
  { note: 'A#4', key: 'j', isBlack: true  },
  { note: 'B4',  key: 'm', isBlack: false, label: 'B' },
];

// Build a fast lookup: qwerty key → { note }
const KEY_TO_NOTE = Object.fromEntries(KEYBOARD_MAP.map((e) => [e.key, e.note]));

const WHITE_KEYS = KEYBOARD_MAP.filter((e) => !e.isBlack);
const BLACK_KEYS = KEYBOARD_MAP.filter((e) => e.isBlack);

const WHITE_KEY_W = 52; // px
const BLACK_KEY_W = 32; // px

// Position each black key: center it over the gap between adjacent white keys.
// afterWhiteIndex = the white-key index immediately to the left of the gap.
const BLACK_KEY_POSITIONS = {
  'C#4': 1, // after C  (white idx 0)
  'D#4': 2, // after D  (white idx 1)
  'F#4': 4, // after F  (white idx 3)
  'G#4': 5, // after G  (white idx 4)
  'A#4': 6, // after A  (white idx 5)
};

function blackKeyLeft(note) {
  const afterIdx = BLACK_KEY_POSITIONS[note];
  return afterIdx * WHITE_KEY_W - BLACK_KEY_W / 2;
}

export default function KeyboardStrip({ audio }) {
  const [pressedKeys, setPressedKeys] = useState(new Set());
  // Track held keys in a ref so event handlers never go stale
  const heldRef = useRef(new Set());

  const handleKeyDown = useCallback((e) => {
    if (e.repeat) return; // ignore key-repeat
    const key = e.key.toLowerCase();
    const note = KEY_TO_NOTE[key];
    if (!note) return;

    heldRef.current.add(key);
    setPressedKeys(new Set(heldRef.current));
    audio.playNote(note);
  }, [audio]);

  const handleKeyUp = useCallback((e) => {
    const key = e.key.toLowerCase();
    if (!KEY_TO_NOTE[key]) return;

    heldRef.current.delete(key);
    setPressedKeys(new Set(heldRef.current));

    if (heldRef.current.size === 0) {
      audio.releaseNote();
    }
  }, [audio]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Also handle mouse/touch on visual keys
  const handlePianoMouseDown = useCallback((note, key) => {
    heldRef.current.add(key);
    setPressedKeys(new Set(heldRef.current));
    audio.playNote(note);
  }, [audio]);

  const handlePianoMouseUp = useCallback((key) => {
    heldRef.current.delete(key);
    setPressedKeys(new Set(heldRef.current));
    if (heldRef.current.size === 0) audio.releaseNote();
  }, [audio]);

  return (
    <div className={styles.strip}>
      <div className={styles.keyboard}>
        {/* White keys */}
        {WHITE_KEYS.map(({ note, key, label }) => {
          const active = pressedKeys.has(key);
          return (
            <div
              key={note}
              className={`${styles.whiteKey} ${active ? styles.whiteActive : ''}`}
              onMouseDown={() => handlePianoMouseDown(note, key)}
              onMouseUp={() => handlePianoMouseUp(key)}
              onMouseLeave={() => handlePianoMouseUp(key)}
            >
              <span className={styles.noteLabel}>{label}</span>
              <span className={styles.keyHint}>{key.toUpperCase()}</span>
            </div>
          );
        })}

        {/* Black keys — absolutely positioned over white keys */}
        {BLACK_KEYS.map(({ note, key }) => {
          const active = pressedKeys.has(key);
          return (
            <div
              key={note}
              className={`${styles.blackKey} ${active ? styles.blackActive : ''}`}
              style={{ left: blackKeyLeft(note) }}
              onMouseDown={(e) => { e.stopPropagation(); handlePianoMouseDown(note, key); }}
              onMouseUp={(e) => { e.stopPropagation(); handlePianoMouseUp(key); }}
              onMouseLeave={() => handlePianoMouseUp(key)}
            >
              <span className={styles.keyHint}>{key.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
