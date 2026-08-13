/* Random source for the whole game.

   Everything that rolls dice goes through an Rng instance instead of calling
   Math.random() directly, so a session can be replayed from its seed and the
   tests can assert on exact rolls. */

/** mulberry32 — small, fast, good enough for dice. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string into a 32-bit seed (FNV-1a). */
export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  /** @param {number|string} [seed] omit for a non-reproducible session. */
  constructor(seed) {
    this.seed = seed === undefined ? (Math.random() * 2 ** 32) >>> 0
      : typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this.count = 0;
    this._next = mulberry32(this.seed);
  }

  /** Float in [0, 1). */
  float() { this.count++; return this._next(); }

  /** Integer in [1, faces] — one die. */
  die(faces) { return 1 + Math.floor(this.float() * faces); }

  /** Integer in [min, max] inclusive. */
  int(min, max) { return min + Math.floor(this.float() * (max - min + 1)); }

  pick(list) { return list[Math.floor(this.float() * list.length)]; }

  /** Weighted pick: entries are `[value, weight]` pairs. */
  weighted(entries) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let t = this.float() * total;
    for (const [value, w] of entries) { t -= w; if (t < 0) return value; }
    return entries[entries.length - 1][0];
  }

  /** Fisher–Yates, on a copy. */
  shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Snapshot / restore so a save file resumes the same stream. */
  save() { return { seed: this.seed, count: this.count }; }

  static restore(state) {
    const rng = new Rng(state?.seed ?? 0);
    for (let i = 0; i < (state?.count || 0); i++) rng.float();
    return rng;
  }
}

/** Shared instance used when a caller does not supply its own. */
export const rng = new Rng();
