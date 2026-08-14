/* 「世界」画面 — その世界がどういう場所なのかを読む場所。

   ルールには関わらない。ソロで遊ぶ前に雰囲気を掴むため、卓を回すときに
   即席の材料を出すための画面。表は押すと振れて、結果がその場に積まれる。 */

import { el, clear, frag, button, richText, toast } from './dom.js';
import { WORLDS, useWorld, activeWorld } from '../worlds/index.js';
import { LORE, rollTable, randomName, hasLore } from '../core/lore.js';
import { Rng } from '../core/rng.js';

const rng = new Rng(Date.now());

export function worldScreen(root, { app }) {
  const draw = () => {
    clear(root).append(el('div', { class: 'stack' }, [
      worldPicker(draw),
      lorePanel({ withHeader: true }),
    ]));
  };
  draw();
}

/**
 * 読み物そのもの。世界の切り替えは呼び出し側が持っているので、ここには置かない。
 * セッション支援のタブからも同じものを開く。
 * @param {object} [opts] {withHeader}
 */
export function lorePanel({ withHeader = false } = {}) {
  if (!hasLore()) return el('p', { class: 'muted', text: 'この世界には、まだ読み物が書かれていません。' });
  return frag(
    withHeader ? header(activeWorld()) : null,
    primer(),
    truthsCard(),
    standingCard(),
    districtsCard(),
    economyCard(),
    timelineCard(),
    listCard('土地', LORE.places, p => [p.name, p.blurb]),
    factionsCard(),
    listCard('顔', LORE.figures, f => [`${f.name}${f.title && f.title !== '——' ? `（${f.title}）` : ''}`, f.blurb]),
    namesCard(),
    ...LORE.tables.map(tableCard),
  );
}

/* ---------------------------------------------------------------- 部品 */

/* 本文の段落。読み物側でも **強調** を効かせる——primer だけ効いて
   決まりごとや勢力で素通しになっていると、書くほうが使い分けを覚えられない。 */
const body = (text, cls = 'tiny muted') => {
  const p = el('div', { class: cls, style: { lineHeight: '1.7' } });
  p.append(richText(text));
  return p;
};

const worldPicker = draw => el('div', { class: 'card card--flat' }, [
  el('div', { class: 'chips' }, WORLDS.map(world => el('button', {
    class: `chip ${activeWorld().id === world.id ? 'is-on' : ''}`,
    onclick: () => { useWorld(world.id); draw(); },
  }, [`${world.icon || ''} ${world.name}`]))),
]);

const header = world => el('div', { class: 'card stack' }, [
  el('h2', { class: 'card__title', text: `${world.icon || ''} ${world.name}` }),
  el('p', { class: 'muted tiny', text: world.tagline || '' }),
  el('p', { text: world.blurb || '' }),
]);

const primer = () => el('div', { class: 'card stack' }, [
  el('h3', { class: 'card__title', text: 'この街／この地方について' }),
  ...LORE.primer.map(paragraph => {
    const p = el('p', { style: { lineHeight: '1.75' } });
    p.append(richText(paragraph));
    return p;
  }),
]);

/** name と blurb の並びを、同じ見た目のカードにする。 */
const listCard = (title, items, shape) => (items.length ? el('div', { class: 'card stack' }, [
  el('h3', { class: 'card__title', text: title }),
  ...items.map(item => {
    const [name, blurb] = shape(item);
    return el('div', { class: 'stack', style: { gap: '2px', marginBottom: '10px' } }, [
      el('div', { style: { fontWeight: '600' }, text: name }),
      body(blurb),
    ]);
  }),
]) : null);

/* 「何ができないか」を先に読ませる。世界の輪郭は、禁止のほうがよく伝わる。 */
const truthsCard = () => (LORE.truths.length ? el('div', { class: 'card stack' }, [
  el('h3', { class: 'card__title', text: '世界の決まりごと' }),
  ...LORE.truths.map(t => el('div', { class: 'stack', style: { gap: '2px', marginBottom: '10px' } }, [
    el('div', { style: { fontWeight: '600' }, text: t.title }),
    body(t.text),
  ])),
]) : null);

/* 信用スコア。設定であってルールではないので、数値ではなく「どうなるか」を並べる。 */
function standingCard() {
  const spec = LORE.standing;
  if (!spec?.tiers?.length) return null;
  return el('div', { class: 'card stack' }, [
    el('h3', { class: 'card__title', text: spec.name }),
    spec.blurb ? body(spec.blurb) : null,
    ...spec.tiers.map(t => el('div', { class: 'stack', style: { gap: '2px', marginBottom: '10px' } }, [
      el('div', { style: { fontWeight: '600' }, text: t.name }),
      body(t.note || ''),
    ])),
  ]);
}

/* 区画。「どこにいるか」で空気も物価も変わる、を一覧で。 */
function districtsCard() {
  if (!LORE.districts?.length) return null;
  return el('div', { class: 'card stack' }, [
    el('h3', { class: 'card__title', text: '区画' }),
    ...LORE.districts.map(d => el('div', { class: 'stack', style: { gap: '2px', marginBottom: '12px' } }, [
      el('div', { class: 'spread' }, [
        el('span', { style: { fontWeight: '600' }, text: d.name }),
        el('span', { class: 'tiny faint', text: `物価 ×${d.priceScale}` }),
      ]),
      body(d.blurb),
      el('div', { class: 'tiny faint', style: { lineHeight: '1.7' }, text: `空気：${d.air}　／　縄張り：${d.turf}` }),
      el('div', { class: 'tiny faint', style: { lineHeight: '1.7' }, text: `▸ ${d.entry}` }),
    ])),
  ]);
}

/* 物価。報酬の数字が何を意味するのか、これが無いと最後まで分からない。 */
function economyCard() {
  const eco = LORE.economy;
  if (!eco?.anchors?.length) return null;
  return el('div', { class: 'card stack' }, [
    el('h3', { class: 'card__title', text: `物価（${eco.unit}）` }),
    eco.note ? el('p', { class: 'tiny muted', style: { lineHeight: '1.7' }, text: eco.note }) : null,
    el('div', {}, eco.anchors.map(a => el('div', { class: 'kv' }, [
      el('span', { class: 'kv__k', text: a.what }),
      el('span', { class: 'tiny', text: `${eco.unit === '€$' ? '€$' : ''}${a.cost.toLocaleString('ja-JP')}${eco.unit === '€$' ? '' : ` ${eco.unit}`}` }),
    ]))),
  ]);
}

const timelineCard = () => (LORE.timeline.length ? el('div', { class: 'card stack' }, [
  el('h3', { class: 'card__title', text: 'ここまでの経緯' }),
  ...LORE.timeline.map(t => el('div', { class: 'stack', style: { gap: '2px', marginBottom: '10px' } }, [
    el('div', { class: 'tiny', style: { fontWeight: '600', color: 'var(--gold)' }, text: t.when }),
    body(t.what),
  ])),
]) : null);

/* 勢力は「誰と誰が噛み合っていないか」まで書いて、初めて使える。 */
const factionsCard = () => (LORE.factions.length ? el('div', { class: 'card stack' }, [
  el('h3', { class: 'card__title', text: '勢力' }),
  ...LORE.factions.map(f => el('div', { class: 'stack', style: { gap: '2px', marginBottom: '12px' } }, [
    el('div', { style: { fontWeight: '600' }, text: f.name }),
    body(f.blurb),
    f.stance ? body(`▸ ${f.stance}`, 'tiny faint') : null,
  ])),
]) : null);

/* 名前は「一人ぶんの手がかり」としていちばんよく使うので、単独で置く。 */
function namesCard() {
  if (!LORE.names?.given?.length) return null;
  const out = el('div', { class: 'stack', style: { gap: '4px' } });
  return el('div', { class: 'card stack' }, [
    el('h3', { class: 'card__title', text: '名前' }),
    el('p', { class: 'tiny faint', text: 'その場で NPC が要るとき用。押すたびに増えます。' }),
    el('div', { class: 'row' }, [
      button('名前を1つ', () => out.prepend(rolled(randomName(rng))), 'btn btn--sm'),
      button('消す', () => clear(out), 'btn btn--sm btn--ghost'),
    ]),
    out,
  ]);
}

function tableCard(table) {
  const out = el('div', { class: 'stack', style: { gap: '4px' } });
  return el('div', { class: 'card stack' }, [
    el('h3', { class: 'card__title', text: table.name }),
    table.hint ? el('p', { class: 'tiny faint', text: table.hint }) : null,
    el('div', { class: 'row' }, [
      button('振る', () => out.prepend(rolled(rollTable(table, rng))), 'btn btn--sm btn--primary'),
      button('全部見る', () => showAll(table, out), 'btn btn--sm btn--ghost'),
      button('消す', () => clear(out), 'btn btn--sm btn--ghost'),
    ]),
    out,
  ]);
}

const rolled = text => el('p', {
  class: 'tiny',
  style: { padding: '8px 10px', borderLeft: '3px solid var(--gold)', background: 'var(--surface-2, transparent)', lineHeight: '1.7' },
  text: text || '—',
});

function showAll(table, out) {
  clear(out);
  for (const entry of table.entries) {
    out.append(el('p', { class: 'tiny muted', style: { lineHeight: '1.7' }, text: `・${entry}` }));
  }
  toast(`${table.name}（全${table.entries.length}項目）`);
}
