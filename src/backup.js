// Full-progress backup: export/import every ChessLab store as one JSON file.
// Pure functions over a storage-like object (localStorage in the app, a plain
// mock in tests). The Gemini API key is ALWAYS stripped from exports so a
// backup file is safe to move between devices or share.
const STORE_KEYS = ['chesslab_stats_v2', 'chesslab_settings_v1', 'chesslab_muted'];
export const BACKUP_SCHEMA = 1;

export function exportBackup(storage) {
  const stores = {};
  for (const key of STORE_KEYS) {
    const raw = storage.getItem(key);
    if (raw == null) continue;
    if (key === 'chesslab_settings_v1') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.state) delete parsed.state.geminiKey; // never in a backup file
        stores[key] = JSON.stringify(parsed);
        continue;
      } catch { /* fall through, store raw */ }
    }
    stores[key] = raw;
  }
  return { app: 'chesslab', schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), stores };
}

// Validates and applies a backup. Existing geminiKey on THIS device survives.
// Returns { ok: true } or { ok: false, error }.
export function importBackup(data, storage) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Not a valid backup file.' };
  if (data.app !== 'chesslab') return { ok: false, error: 'This file is not a ChessLab backup.' };
  if (typeof data.schema !== 'number' || data.schema > BACKUP_SCHEMA) {
    return { ok: false, error: `Backup schema ${data.schema} is newer than this app understands — update ChessLab first.` };
  }
  if (!data.stores || typeof data.stores !== 'object') return { ok: false, error: 'Backup contains no data.' };
  // every store must at least be parseable before we touch anything
  for (const [key, raw] of Object.entries(data.stores)) {
    if (!STORE_KEYS.includes(key)) return { ok: false, error: `Unknown store "${key}" — refusing to import.` };
    if (key !== 'chesslab_muted') {
      try { JSON.parse(raw); } catch { return { ok: false, error: `Store "${key}" is corrupted.` }; }
    }
  }
  // preserve this device's key: the backup never carries one
  let keptKey = null;
  try {
    const cur = JSON.parse(storage.getItem('chesslab_settings_v1') || 'null');
    keptKey = cur && cur.state && cur.state.geminiKey ? cur.state.geminiKey : null;
  } catch { /* nothing to keep */ }
  for (const [key, raw] of Object.entries(data.stores)) {
    if (key === 'chesslab_settings_v1' && keptKey) {
      try {
        const parsed = JSON.parse(raw);
        parsed.state = parsed.state || {};
        parsed.state.geminiKey = keptKey;
        storage.setItem(key, JSON.stringify(parsed));
        continue;
      } catch { /* validated above; can't happen */ }
    }
    storage.setItem(key, raw);
  }
  return { ok: true };
}
