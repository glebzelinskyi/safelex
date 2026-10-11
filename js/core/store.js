export const sameShape = (v, def) => Array.isArray(def) ? Array.isArray(v)
  : def !== null && typeof def === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
  : typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v));

export function createStore(getStorage, onFail = () => {}) {
  const storage = () => { try { return getStorage(); } catch { return null; } };
  return {
    get(key, def) {
      try { const v = JSON.parse(storage().getItem(key)); return v != null && sameShape(v, def) ? v : def; } catch { return def; }
    },
    set(key, val) {
      try { storage().setItem(key, JSON.stringify(val)); return true; } catch { onFail(key); return false; }
    },
    remove(key) { try { storage().removeItem(key); } catch {} }
  };
}

let failHandler = null;
export const onSaveFail = fn => { failHandler = fn; };

export const store = createStore(() => globalThis.localStorage, key => failHandler?.(key));
