/* 効果と条件の編集 — 工房で「物語に状態を持たせる」ための部品。

   ここが無いあいだ、工房で書けるのは一本道と分岐までだった。集めた手がかりで
   扉が開く、報酬が入る、時間切れが迫る——収録シナリオが当たり前に使っている
   ものが、自作では一つも書けなかった。

   扱う形は scenario.js の DSL そのまま。凝った合成（入れ子の all/any）は
   JSON で書いてもらう前提で、ここでは「よく使う形が迷わず書ける」ことだけを狙う。
   実際に収録シナリオで使われているのは、変数・印・持ち物・報酬でほぼ全部だった。 */

import { el, frag, field, button } from './dom.js';
import { SKILLS, skillName } from '../core/rules.js';

/* ------------------------------------------------------------------ 効果 */

/* 種類ごとに「どの入力が要るか」だけを持つ。並び順は使用頻度。 */
export const EFFECT_KINDS = [
  { id: 'var', name: '変数を動かす', fields: ['var', 'amount'], make: () => ({ var: '', add: 1 }) },
  { id: 'setFlag', name: '印をつける', fields: ['flag'], make: () => ({ setFlag: '' }) },
  { id: 'clearFlag', name: '印を消す', fields: ['flag'], make: () => ({ clearFlag: '' }) },
  { id: 'gold', name: '所持金', fields: ['gold'], make: () => ({ gold: 10 }) },
  { id: 'giveItem', name: '持ち物を渡す', fields: ['item', 'count'], make: () => ({ giveItem: '', count: 1 }) },
  { id: 'takeItem', name: '持ち物を取る', fields: ['item', 'count'], make: () => ({ takeItem: '', count: 1 }) },
  { id: 'damage', name: 'ダメージ', fields: ['dice', 'target'], make: () => ({ damage: '1d6', target: 'party' }) },
  { id: 'heal', name: '回復', fields: ['dice', 'target'], make: () => ({ heal: '1d6', target: 'party' }) },
  { id: 'rest', name: '休憩', fields: ['rest'], make: () => ({ rest: 'short' }) },
  { id: 'xp', name: '経験点', fields: ['xp'], make: () => ({ xp: 50 }) },
  { id: 'log', name: 'ログに一行', fields: ['log'], make: () => ({ log: '', kind: 'system' }) },
];

/** その効果がどの種類か。最初に見つかったキーで決める。 */
export const kindOf = effect =>
  EFFECT_KINDS.find(k => effect && effect[k.id] !== undefined) || null;

/** 一覧に出す一行の説明。何をする効果なのかを畳んだ形。 */
export function describeEffect(effect) {
  const kind = kindOf(effect);
  if (!kind) return '（不明な効果）';
  switch (kind.id) {
    case 'var': {
      const move = effect.set !== undefined ? `= ${effect.set}` : `${effect.add >= 0 ? '+' : ''}${effect.add}`;
      return `${effect.var} ${move}`;
    }
    case 'setFlag': return `印「${effect.setFlag}」をつける`;
    case 'clearFlag': return `印「${effect.clearFlag}」を消す`;
    case 'gold': return `所持金 ${typeof effect.gold === 'object' ? `= 変数 ${effect.gold.var}` : `${effect.gold >= 0 ? '+' : ''}${effect.gold}`}`;
    case 'giveItem': return `【${effect.giveItem}】を ${effect.count || 1} 個渡す`;
    case 'takeItem': return `【${effect.takeItem}】を ${effect.count || 1} 個取る`;
    case 'damage': return `${effect.damage} のダメージ（${effect.target === 'active' ? '振った人' : '一行'}）`;
    case 'heal': return `${effect.heal} 回復（${effect.target === 'active' ? '振った人' : '一行'}）`;
    case 'rest': return effect.rest === 'long' ? '長い休憩（全快）' : '短い休憩';
    case 'xp': return `経験点 +${effect.xp}`;
    case 'log': return `ログ：${effect.log}`;
    default: return kind.name;
  }
}

/**
 * 効果の並びを編集する箱。
 * @param {object[]} list その場で書き換える配列
 * @param {object} ctx {vars, items, onChange, onMark}
 */
export function effectsEditor(list, ctx) {
  const { onChange, onMark } = ctx;
  const change = () => { onChange(); };
  const mark = () => onMark?.();

  const rows = list.map((effect, index) => {
    const kind = kindOf(effect);
    return el('div', { class: 'card card--flat stack', style: { gap: '6px', marginBottom: '6px' } }, [
      el('div', { class: 'spread' }, [
        el('span', { class: 'tiny', style: { fontWeight: '600' }, text: kind?.name || '不明' }),
        el('button', {
          class: 'btn btn--sm btn--danger',
          onclick: () => { mark(); list.splice(index, 1); change(); },
        }, ['×']),
      ]),
      ...(kind?.fields || []).map(f => effectField(f, effect, ctx, change)),
    ]);
  });

  return frag(
    ...rows,
    el('div', { class: 'row' }, [
      el('select', {
        class: 'select select--add-effect',
        onchange: e => {
          if (!e.target.value) return;
          mark();
          list.push(EFFECT_KINDS.find(k => k.id === e.target.value).make());
          e.target.value = '';
          change();
        },
      }, [
        el('option', { value: '', text: '＋ 効果を足す' }),
        ...EFFECT_KINDS.map(k => el('option', { value: k.id, text: k.name })),
      ]),
    ]),
  );
}

/* 効果ひとつぶんの入力欄。種類ごとに要るものだけを出す。
   文字と数値は「打つたびに保存、描き直しはしない」。ここで描き直すと
   一文字ごとに入力欄から指が外れ、画面が上まで飛ぶ。 */
function effectField(name, effect, ctx, change) {
  const typed = () => (ctx.onTyped ? ctx.onTyped() : change());
  const text = (label, get, set, placeholder = '') => field(label, el('input', {
    class: 'input', value: get() ?? '', placeholder,
    oninput: e => { set(e.target.value); typed(); },
  }));
  const number = (label, get, set) => field(label, el('input', {
    class: 'input', type: 'number', value: get() ?? 0,
    oninput: e => { set(Number(e.target.value) || 0); typed(); },
  }));

  switch (name) {
    case 'var':
      return field('変数', pickOrType(ctx.vars, effect.var,
        (v, o) => { effect.var = v; (o?.typing ? typed : change)(); }, '変数名'));
    case 'amount':
      return el('div', { class: 'row' }, [
        el('div', { class: 'grow' }, [field(
          effect.set !== undefined ? 'この値にする' : '増減',
          el('input', {
            class: 'input', type: 'number',
            value: effect.set !== undefined ? effect.set : (effect.add ?? 0),
            oninput: e => {
              const value = Number(e.target.value) || 0;
              if (effect.set !== undefined) effect.set = value; else effect.add = value;
              typed();
            },
          }),
        )]),
        el('label', { class: 'chip' }, [
          el('input', {
            type: 'checkbox', checked: effect.set !== undefined,
            onchange: e => {
              if (e.target.checked) { effect.set = effect.add ?? 0; delete effect.add; }
              else { effect.add = effect.set ?? 0; delete effect.set; }
              change();
            },
          }),
          ' 代入',
        ]),
      ]);
    case 'flag': {
      const key = effect.setFlag !== undefined ? 'setFlag' : 'clearFlag';
      return text('印の名前', () => effect[key], v => { effect[key] = v; }, 'sawTracks など');
    }
    case 'gold':
      return number('増減（マイナスで支払い）', () => effect.gold, v => { effect.gold = v; });
    case 'item': {
      const key = effect.giveItem !== undefined ? 'giveItem' : 'takeItem';
      return field('持ち物', pickOrType(ctx.items, effect[key],
        (v, o) => { effect[key] = v; (o?.typing ? typed : change)(); }, 'アイテムの id'));
    }
    case 'count':
      return number('個数', () => effect.count ?? 1, v => { effect.count = Math.max(1, v); });
    case 'dice': {
      const key = effect.damage !== undefined ? 'damage' : 'heal';
      return text('ダイス式', () => effect[key], v => { effect[key] = v; }, '2d6+2');
    }
    case 'target':
      return field('だれに', el('select', {
        class: 'select',
        onchange: e => { effect.target = e.target.value; change(); },
      }, [
        el('option', { value: 'party', text: '一行ぜんぶ', selected: effect.target !== 'active' }),
        el('option', { value: 'active', text: '判定した人', selected: effect.target === 'active' }),
      ]));
    case 'rest':
      return field('種類', el('select', {
        class: 'select',
        onchange: e => { effect.rest = e.target.value; change(); },
      }, [
        el('option', { value: 'short', text: '短い休憩（ヒットダイスで回復）', selected: effect.rest !== 'long' }),
        el('option', { value: 'long', text: '長い休憩（全快・呪文も戻る）', selected: effect.rest === 'long' }),
      ]));
    case 'xp':
      return number('経験点', () => effect.xp, v => { effect.xp = v; });
    case 'log':
      return frag(
        text('本文', () => effect.log, v => { effect.log = v; }, 'ログに出す一行'),
        field('色', el('select', {
          class: 'select',
          onchange: e => { effect.kind = e.target.value; change(); },
        }, [
          ['system', 'ふつう'], ['good', 'よい'], ['bad', 'わるい'],
        ].map(([v, t]) => el('option', { value: v, text: t, selected: (effect.kind || 'system') === v })))),
      );
    default:
      return null;
  }
}

/* 既にある名前から選ぶか、新しく打つか。変数もアイテムも、
   打ち間違えると黙って効かなくなるので、候補を出すほうが安全。 */
function pickOrType(known, value, onPick, placeholder, ctx) {
  /* 打っている最中は書き込むだけで、描き直さない。候補を押したときだけ
     描き直す（選ばれた札に印をつけるため）。 */
  const input = el('input', {
    class: 'input', value: value ?? '', placeholder,
    oninput: e => onPick(e.target.value, { typing: true }),
  });
  if (!known?.length) return input;
  return frag(
    el('div', { class: 'chips' }, known.map(name => el('button', {
      class: `chip ${name === value ? 'is-on' : ''}`,
      onclick: () => { input.value = name; onPick(name); },
    }, [name]))),
    input,
  );
}

/* ------------------------------------------------------------------ 条件 */

export const CONDITION_KINDS = [
  { id: 'flag', name: '印がある', make: () => ({ flag: '' }) },
  { id: 'noFlag', name: '印がない', make: () => ({ noFlag: '' }) },
  { id: 'var', name: '変数が…', make: () => ({ var: '', gte: 1 }) },
  { id: 'has', name: '持ち物がある', make: () => ({ has: '' }) },
  { id: 'skillIn', name: '技能を持つ者がいる', make: () => ({ skillIn: [] }) },
  { id: 'visited', name: 'あの場面を通った', make: () => ({ visited: '' }) },
];

const condKindOf = cond => CONDITION_KINDS.find(k => cond && cond[k.id] !== undefined) || null;

/** 条件を一行で言い直す。ロックの理由をそのまま書けるように。 */
export function describeConditionShort(cond) {
  if (!cond) return '';
  if (cond.all) return cond.all.map(describeConditionShort).join(' かつ ');
  if (cond.any) return cond.any.map(describeConditionShort).join(' または ');
  if (cond.flag !== undefined) return `印「${cond.flag}」`;
  if (cond.noFlag !== undefined) return `印「${cond.noFlag}」が無い`;
  if (cond.var !== undefined) {
    if (cond.gte !== undefined) return `${cond.var} が ${cond.gte} 以上`;
    if (cond.lte !== undefined) return `${cond.var} が ${cond.lte} 以下`;
    if (cond.eq !== undefined) return `${cond.var} が ${cond.eq}`;
    return `${cond.var} が 0 でない`;
  }
  if (cond.has !== undefined) return `【${cond.has}】を持っている`;
  if (cond.visited !== undefined) return `「${cond.visited}」を通った`;
  if (cond.skillIn) return `技能（${cond.skillIn.map(skillName).join('/')}）を持つ者がいる`;
  return '条件';
}

/**
 * 条件を編集する箱。中身は「並べたものを全部満たす（かつ）」か
 * 「どれか一つ（または）」の二択に絞る。入れ子は JSON で書いてもらう。
 * @param {object|null} cond いまの条件
 * @param {(next:object|null) => void} onSet 書き換わったら呼ぶ
 * @param {object} ctx {vars, items, onMark}
 */
export function conditionEditor(cond, onSet, ctx) {
  const anyMode = !!cond?.any;
  const parts = cond ? (cond.all || cond.any || [cond]) : [];

  const commit = next => {
    if (!next.length) { onSet(undefined); return; }
    if (next.length === 1 && !anyMode) { onSet(next[0]); return; }
    onSet(anyMode ? { any: next } : { all: next });
  };

  const rows = parts.map((part, index) => {
    const kind = condKindOf(part);
    return el('div', { class: 'card card--flat stack', style: { gap: '6px', marginBottom: '6px' } }, [
      el('div', { class: 'spread' }, [
        el('span', { class: 'tiny', style: { fontWeight: '600' }, text: kind?.name || '不明' }),
        el('button', {
          class: 'btn btn--sm btn--danger',
          onclick: () => { ctx.onMark?.(); const next = [...parts]; next.splice(index, 1); commit(next); },
        }, ['×']),
      ]),
      ...conditionFields(part, kind, ctx, () => commit(parts)),
    ]);
  });

  return frag(
    parts.length > 1 ? el('label', { class: 'chip' }, [
      el('input', {
        type: 'checkbox', checked: anyMode,
        onchange: e => { ctx.onMark?.(); onSet(e.target.checked ? { any: parts } : { all: parts }); },
      }),
      ' どれか一つでよい',
    ]) : null,
    ...rows,
    el('div', { class: 'row' }, [
      el('select', {
        class: 'select select--add-condition',
        onchange: e => {
          if (!e.target.value) return;
          ctx.onMark?.();
          commit([...parts, CONDITION_KINDS.find(k => k.id === e.target.value).make()]);
        },
      }, [
        el('option', { value: '', text: '＋ 条件を足す' }),
        ...CONDITION_KINDS.map(k => el('option', { value: k.id, text: k.name })),
      ]),
    ]),
  );
}

function conditionFields(part, kind, ctx, change) {
  if (!kind) return [];
  switch (kind.id) {
    case 'flag':
    case 'noFlag':
      return [field('印の名前', el('input', {
        class: 'input', value: part[kind.id] ?? '', placeholder: 'sawTracks など',
        // 打っている最中は保存だけ。part は条件そのものなので、書き換えは即座に届く。
        oninput: e => { part[kind.id] = e.target.value; (ctx.onTyped || change)(); },
      }))];
    case 'has':
      return [field('持ち物', pickOrType(ctx.items, part.has,
        (v, o) => { part.has = v; (o?.typing ? (ctx.onTyped || change) : change)(); }, 'アイテムの id'))];
    /* 印を立てなくても「あそこを見たか」で分岐できる。印より先に思いつく形。 */
    case 'visited':
      return [field('通った場面', el('select', {
        class: 'select',
        onchange: e => { part.visited = e.target.value; change(); },
      }, [
        el('option', { value: '', text: '（選ぶ）', selected: !part.visited }),
        ...(ctx.nodes || []).map(n => el('option', {
          value: n.id, text: n.title || n.id, selected: n.id === part.visited,
        })),
      ]))];
    case 'var': {
      const op = part.lte !== undefined ? 'lte' : part.eq !== undefined ? 'eq' : 'gte';
      return [
        field('変数', pickOrType(ctx.vars, part.var,
          (v, o) => { part.var = v; (o?.typing ? (ctx.onTyped || change) : change)(); }, '変数名')),
        el('div', { class: 'row' }, [
          el('div', { style: { width: '130px' } }, [field('くらべ方', el('select', {
            class: 'select',
            onchange: e => {
              const value = part[op] ?? 1;
              delete part.gte; delete part.lte; delete part.eq;
              part[e.target.value] = value;
              change();
            },
          }, [
            el('option', { value: 'gte', text: '以上', selected: op === 'gte' }),
            el('option', { value: 'lte', text: '以下', selected: op === 'lte' }),
            el('option', { value: 'eq', text: 'ちょうど', selected: op === 'eq' }),
          ]))]),
          el('div', { class: 'grow' }, [field('値', el('input', {
            class: 'input', type: 'number', value: part[op] ?? 1,
            oninput: e => { part[op] = Number(e.target.value) || 0; (ctx.onTyped || change)(); },
          }))]),
        ]),
      ];
    }
    case 'skillIn':
      return [field('技能（複数選べる）', el('div', { class: 'chips' }, SKILLS.map(s => el('button', {
        class: `chip ${(part.skillIn || []).includes(s.id) ? 'is-on' : ''}`,
        onclick: () => {
          part.skillIn = (part.skillIn || []).includes(s.id)
            ? part.skillIn.filter(x => x !== s.id)
            : [...(part.skillIn || []), s.id];
          change();
        },
      }, [s.name]))))];
    default:
      return [];
  }
}
