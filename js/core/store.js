/* Everything the app keeps between visits, in localStorage.

   Four buckets, each independently readable so a corrupt entry never takes
   the whole app down:
     trpg.saves      solo play save slots
     trpg.chars      characters made in the builder / session tool
     trpg.scenarios  scenarios written in the editor
     trpg.prefs      small UI preferences  */

const KEYS = {
  saves: 'trpg.saves',
  chars: 'trpg.chars',
  scenarios: 'trpg.scenarios',
  prefs: 'trpg.prefs',
};

const MAX_SAVES = 12;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch (err) {
    console.warn(`[trpg] ${key} が読めませんでした`, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[trpg] ${key} を保存できませんでした`, err);
    return false;
  }
}

/* ------------------------------------------------------------- save slots */

export const listSaves = () =>
  read(KEYS.saves, []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

export function getSave(id) {
  return read(KEYS.saves, []).find(s => s.id === id) || null;
}

/**
 * Store a session snapshot. Passing the same id overwrites that slot.
 * @returns {string} the slot id
 */
export function putSave(snapshot, { id, label } = {}) {
  const saves = read(KEYS.saves, []);
  const slotId = id || `save_${Date.now().toString(36)}`;
  const entry = {
    id: slotId,
    label: label || snapshot.scenario?.title || '無題の冒険',
    scenarioId: snapshot.scenarioId,
    scenarioTitle: snapshot.scenario?.title || '',
    nodeTitle: snapshot.scenario?.nodes?.[snapshot.nodeId]?.title || '',
    party: (snapshot.party || []).map(p => ({ name: p.name, level: p.level, hp: p.hp, maxHp: p.maxHp, portrait: p.portrait })),
    finished: !!snapshot.finished,
    savedAt: Date.now(),
    data: snapshot,
  };
  const next = [entry, ...saves.filter(s => s.id !== slotId)].slice(0, MAX_SAVES);
  write(KEYS.saves, next);
  return slotId;
}

export function deleteSave(id) {
  write(KEYS.saves, read(KEYS.saves, []).filter(s => s.id !== id));
}

/* ------------------------------------------------------------ characters */

export const listCharacters = () => read(KEYS.chars, []);

export function putCharacter(character) {
  const all = read(KEYS.chars, []);
  const next = [character, ...all.filter(c => c.id !== character.id)];
  write(KEYS.chars, next);
  return character.id;
}

export function deleteCharacter(id) {
  write(KEYS.chars, read(KEYS.chars, []).filter(c => c.id !== id));
}

/* ------------------------------------------------------------- scenarios */

export const listScenarios = () => read(KEYS.scenarios, []);

export function putScenario(scenario) {
  const all = read(KEYS.scenarios, []);
  const stamped = { ...scenario, updatedAt: Date.now() };
  write(KEYS.scenarios, [stamped, ...all.filter(s => s.id !== scenario.id)]);
  return stamped;
}

export function deleteScenario(id) {
  write(KEYS.scenarios, read(KEYS.scenarios, []).filter(s => s.id !== id));
}

/* ----------------------------------------------------------------- prefs */

export const getPrefs = () => read(KEYS.prefs, {});

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  write(KEYS.prefs, prefs);
  return prefs;
}

/* ------------------------------------------------------------ file import */

/** Download any JSON as a file. */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for a .json file and parse it. */
export function pickJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('ファイルが選ばれませんでした')); return; }
      try { resolve(JSON.parse(await file.text())); }
      catch { reject(new Error('JSON として読めませんでした')); }
    });
    input.click();
  });
}

/** Rough usage report, shown in the settings sheet. */
export function usage() {
  let bytes = 0;
  for (const key of Object.values(KEYS)) bytes += (localStorage.getItem(key) || '').length;
  return { bytes, kb: Math.round(bytes / 1024) };
}
