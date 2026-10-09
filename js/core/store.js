export const sameShape = (v, def) => Array.isArray(def) ? Array.isArray(v)
  : def !== null && typeof def === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
  : typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v));

export function createStore(getStorage) {
  const storage = () => { try { return getStorage(); } catch { return null; } };
  return {
    get(key, def) {
      try { const v = JSON.parse(storage().getItem(key)); return v != null && sameShape(v, def) ? v : def; } catch { return def; }
    },
    set(key, val) { try { storage().setItem(key, JSON.stringify(val)); } catch {} },
    remove(key) { try { storage().removeItem(key); } catch {} }
  };
}

export const store = createStore(() => globalThis.localStorage);
