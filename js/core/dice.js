/* Dice notation: parse and roll.

   Supported forms, combined freely with + and -:
     d20  2d6  1d8+3  2d6+1d4-1  4d6kh3  2d20kh1 (advantage)  2d20kl1
     1d10!  (exploding: a max face rolls again and adds)
     8      (a bare number is a flat modifier)

   parse() returns a plain object so a scenario file can store a rolled
   expression as text and the engine can still explain every die afterwards. */

import { Rng } from './rng.js';

const TERM = /([+-]?)\s*(?:(\d*)d(\d+)((?:k[hl]\d+)?)(!?)|(\d+))/gi;

export class DiceError extends Error {}

/**
 * @param {string} expr e.g. "2d6+3"
 * @returns {{terms: object[], source: string}}
 */
export function parse(expr) {
  const source = String(expr ?? '').trim();
  if (!source) throw new DiceError('式が空です');
  if (!/^[\dd+\-\s khl!]+$/i.test(source)) throw new DiceError(`読めない式: ${source}`);

  const terms = [];
  let consumed = 0;
  TERM.lastIndex = 0;
  for (let m; (m = TERM.exec(source));) {
    const [all, sign, countRaw, facesRaw, keepRaw, bang, flat] = m;
    consumed += all.length;
    const negative = sign === '-';
    if (flat !== undefined) {
      terms.push({ kind: 'flat', value: negative ? -Number(flat) : Number(flat) });
      continue;
    }
    const count = countRaw === '' ? 1 : Number(countRaw);
    const faces = Number(facesRaw);
    if (count < 1 || count > 100) throw new DiceError('ダイスの個数は 1〜100 です');
    if (faces < 2 || faces > 1000) throw new DiceError('面数は 2〜1000 です');

    let keep = null;
    if (keepRaw) {
      const n = Number(keepRaw.slice(2));
      if (n < 1 || n > count) throw new DiceError(`kh/kl の個数が不正です: ${keepRaw}`);
      keep = { mode: keepRaw[1].toLowerCase(), n };
    }
    terms.push({ kind: 'dice', count, faces, keep, explode: bang === '!', negative });
  }

  if (!terms.length) throw new DiceError(`読めない式: ${source}`);
  // Guard against half-parsed junk like "2d6 banana" slipping through.
  if (consumed < source.replace(/\s/g, '').length) throw new DiceError(`読めない式: ${source}`);
  return { terms, source };
}

/**
 * Roll a parsed or raw expression.
 * @param {string|object} expr
 * @param {object} [opts]
 * @param {import('./rng.js').Rng} [opts.rng]
 * @param {'adv'|'dis'|null} [opts.mode] applied to the first d20 term
 * @returns {{total:number, source:string, detail:object[], text:string, natural:number|null}}
 */
export function roll(expr, opts = {}) {
  const { rng: source, mode = null } = opts;
  const gen = source || defaultRng();
  const parsed = typeof expr === 'string' ? parse(expr) : expr;

  let total = 0;
  let natural = null;              // the kept d20 face, for crit rules
  let modeUsed = false;
  const detail = [];

  for (const term of parsed.terms) {
    if (term.kind === 'flat') {
      total += term.value;
      detail.push({ kind: 'flat', value: term.value });
      continue;
    }

    let { count, faces, keep, explode, negative } = term;
    // Advantage turns the first d20 into 2d20kh1 (disadvantage: kl1).
    if (!modeUsed && mode && faces === 20) {
      count = Math.max(2, count + 1);
      keep = { mode: mode === 'adv' ? 'h' : 'l', n: 1 };
      modeUsed = true;
    }

    const rolls = [];
    for (let i = 0; i < count; i++) {
      let value = gen.die(faces);
      if (explode) {
        let guard = 0;
        for (let extra = value; extra === faces && guard < 20; guard++) {
          extra = gen.die(faces);
          value += extra;
        }
      }
      rolls.push(value);
    }

    let kept = rolls, dropped = [];
    if (keep) {
      const order = rolls.map((v, i) => ({ v, i }))
        .sort((a, b) => (keep.mode === 'h' ? b.v - a.v : a.v - b.v));
      const keptIdx = new Set(order.slice(0, keep.n).map(o => o.i));
      kept = rolls.filter((_, i) => keptIdx.has(i));
      dropped = rolls.filter((_, i) => !keptIdx.has(i));
    }

    const sum = kept.reduce((s, v) => s + v, 0);
    total += negative ? -sum : sum;
    if (natural === null && faces === 20) natural = kept[0];
    detail.push({ kind: 'dice', count, faces, rolls, kept, dropped, negative, explode, sum });
  }

  return { total, source: parsed.source, detail, natural, text: format(detail, total) };
}

/** Human-readable breakdown: "2d6[4,5]+3 = 12" */
export function format(detail, total) {
  const parts = detail.map((d, i) => {
    if (d.kind === 'flat') return (d.value < 0 ? '−' : i ? '+' : '') + Math.abs(d.value);
    const dice = `${d.count}d${d.faces}`;
    const shown = d.dropped.length
      ? `[${d.kept.join(',')}｜落:${d.dropped.join(',')}]`
      : `[${d.rolls.join(',')}]`;
    return (d.negative ? '−' : i ? '+' : '') + dice + shown;
  });
  return `${parts.join('')} = ${total}`;
}

/** Highest and lowest possible results — used by the scenario validator. */
export function range(expr) {
  const parsed = typeof expr === 'string' ? parse(expr) : expr;
  let min = 0, max = 0;
  for (const t of parsed.terms) {
    if (t.kind === 'flat') { min += t.value; max += t.value; continue; }
    const n = t.keep ? t.keep.n : t.count;
    const lo = n, hi = n * t.faces;
    if (t.negative) { min -= hi; max -= lo; } else { min += lo; max += hi; }
  }
  return { min, max };
}

export function isValid(expr) {
  try { parse(expr); return true; } catch { return false; }
}

/** Average result, for balancing scenarios in the editor. */
export function average(expr) {
  const parsed = typeof expr === 'string' ? parse(expr) : expr;
  let avg = 0;
  for (const t of parsed.terms) {
    if (t.kind === 'flat') { avg += t.value; continue; }
    // Keep-highest/lowest uses the exact mean for the common 2-of-1 case
    // (advantage / disadvantage) and the plain mean otherwise.
    const n = t.faces;
    let per = (n + 1) / 2;
    if (t.keep && t.keep.n === 1 && t.count === 2) {
      per = t.keep.mode === 'h'
        ? ((n + 1) * (4 * n - 1)) / (6 * n)      // E[max of 2dN]
        : ((n + 1) * (2 * n + 1)) / (6 * n);     // E[min of 2dN]
    }
    const kept = t.keep ? t.keep.n : t.count;
    avg += (t.negative ? -1 : 1) * per * kept;
  }
  return Math.round(avg * 100) / 100;
}

let _fallback = null;
/** Used only when a caller rolls without passing an Rng of its own. */
function defaultRng() {
  if (!_fallback) _fallback = new Rng();
  return _fallback;
}
