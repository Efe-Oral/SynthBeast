const DB_NAME    = 'synthbeast';
const DB_VERSION = 1;
const STORE      = 'projects';
const KEY        = 'default';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      // Create the object store on first open / version bump
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Persist the project to IndexedDB.
 * `data` shape:
 *   {
 *     oscillators: Array<{ type, volume, frequency, detune, customWave: Array|null }>,
 *     eqBands:     Array<{ frequency, gain }>,
 *     loops:       Array<ArrayBuffer>,
 *   }
 * IndexedDB's structured-clone algorithm handles ArrayBuffers natively.
 */
export async function saveProject(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/**
 * Load the most recently saved project from IndexedDB.
 * Returns `null` if nothing has been saved yet.
 */
export async function loadProject() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}
