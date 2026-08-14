/* Character sheet rendering, shared by solo play and the session tool. */

import { el, frag, hpBar, signed, openSheet, toast, button } from './dom.js';
import { sheet as buildSheet } from '../core/character.js';
import { ABILITIES, SKILLS, abilityName, CONDITIONS } from '../core/rules.js';
import { conditionName } from '../core/combat.js';
import { spellById, label } from '../core/content.js';
import { catalogue as augmentCatalogue, summary as augmentSummary, install, remove, hasAugments } from '../core/augment.js';
import { recalculate } from '../core/character.js';
import {
  catalogue as gearCatalogue, loadout, slotFor, thingById, owns, buy, sell, equip, unequip, RESALE,
} from '../core/gear.js';
import { traitList } from '../core/traits.js';

/** One row in the party list. */
export function partyRow(pc, { onClick, current = false } = {}) {
  const down = pc.hp <= 0;
  return el('button', {
    class: `pc ${down ? 'is-down' : ''} ${current ? 'is-turn' : ''}`,
    onclick: onClick ? () => onClick(pc) : null,
  }, [
    el('span', { class: 'pc__face', text: pc.portrait || '🎲' }),
    el('span', { class: 'pc__body' }, [
      el('span', { class: 'pc__name' }, [
        pc.name,
        el('span', { class: 'pc__lv', text: `Lv${pc.level}` }),
        pc.ac ? el('span', { class: 'pc__lv', text: `AC${pc.ac}` }) : null,
      ]),
      hpBar(pc.hp, pc.maxHp),
      pc.conditions?.length
        ? el('span', { class: 'pc__tags' }, pc.conditions.map(id =>
          el('span', { class: 'tag tag--bad', text: conditionName(id) })))
        : null,
    ]),
    el('span', { class: 'pc__hp', text: pc.dead ? '死亡' : `${pc.hp}/${pc.maxHp}` }),
  ]);
}

export const partyList = (party, opts = {}) =>
  el('div', { class: 'party' }, party.map(pc => partyRow(pc, opts)));

/** The full sheet, rendered into the bottom sheet dialog. */
/**
 * @param {object} opts {onChange, canShop} — 買い物は冒険の外だけ。
 *   洞窟の中で店は開かないし、開くと緊張が消える。
 */
export function openCharacterSheet(character, { onChange, canShop = false } = {}) {
  openSheet(`${character.portrait || '🎲'} ${character.name}`, characterSheet(character, { onChange, canShop }));
}

export function characterSheet(character, { onChange, canShop = false } = {}) {
  const view = buildSheet(character);

  const abilities = el('div', { class: 'stats' }, ABILITIES.map(a => el('div', { class: 'stat' }, [
    el('div', { class: 'stat__name', text: a.name }),
    el('div', { class: 'stat__mod', text: signed(view.mods[a.id]) }),
    el('div', { class: 'stat__score', text: view.abilities[a.id] }),
  ])));

  const vitals = el('div', {}, [
    kv('ヒットポイント', `${view.hp} / ${view.maxHp}${view.tempHp ? ` (+${view.tempHp})` : ''}`),
    kv('アーマークラス', view.ac),
    kv('イニシアチブ', signed(view.initiative)),
    kv('習熟ボーナス', signed(view.proficiency)),
    kv('受動知覚', view.passivePerception),
    kv('移動速度', `${view.speed} m`),
    kv(label('hitDice', 'ヒットダイス'), `${view.hitDice ?? view.level} × ${view.hitDie}`),
    kv('経験点', `${view.xp || 0}`),
    view.gold !== undefined ? kv(label('gold', '所持金'), money(view.gold)) : null,
  ]);

  const saves = el('div', { class: 'chips' }, ABILITIES.map(a =>
    el('span', { class: `chip ${character.saves?.includes(a.id) ? 'is-on' : ''}` },
      [`${a.name} ${signed(view.saveMods[a.id])}`])));

  /* 技能は押すと何をする技能なのかが出る。名前だけ並んでいても、
     はじめて遊ぶ人には「運動」で何ができるのか分からない。 */
  const skills = el('div', { class: 'skills' }, SKILLS.map(s => {
    const trained = character.skills?.includes(s.id);
    const expert = character.expertise?.includes(s.id);
    return el('button', {
      class: `skill ${trained ? 'is-trained' : ''}`,
      title: s.desc || '',
      onclick: () => openSkillHelp(s, view.skillMods[s.id]),
    }, [
      el('span', { text: `${s.name}${expert ? '◎' : trained ? '●' : ''}` }),
      el('span', { class: 'skill__mod', text: signed(view.skillMods[s.id]) }),
    ]);
  }));

  const attacks = el('div', {}, view.attacks.map(a =>
    kv(a.name, `${a.damage} ${a.type}${a.ranged ? '（遠隔）' : ''}`)));

  const features = el('div', {}, (view.features || []).map(f =>
    el('div', { class: 'kv' }, [
      el('span', { class: 'kv__k', text: f.name }),
      el('span', { class: 'tiny muted', style: { textAlign: 'right', maxWidth: '62%' }, text: f.desc }),
    ])));

  /* 特性。描写だけのものは「（描写）」と添えて、ルールと区別できるようにする。
     ここを曖昧にすると「書いてあるのに効かない」が積み上がる。 */
  const traits = el('div', {}, traitList(character).map(t => el('div', { class: 'kv' }, [
    el('span', { class: 'kv__k', text: t.text.split('：')[0] }),
    el('span', {
      class: 'tiny muted', style: { textAlign: 'right', maxWidth: '62%' },
      text: `${t.text.split('：').slice(1).join('：') || t.text}${t.def?.kind === 'flavor' ? '（描写）' : ''}`,
    }),
  ])));

  const spellBlock = view.klass.caster ? el('div', {}, [
    kv(`${label('spell', '呪文')}の能力値`, abilityName(view.spellAbility)),
    kv(`${label('spell', '呪文')}セーヴDC`, view.spellDC),
    kv(`${label('spell', '呪文')}攻撃`, signed(view.spellAttack)),
    ...Object.entries(view.slots || {}).map(([lv, slot]) =>
      kv(`${lv}レベル${label('spellSlot', '呪文スロット')}`, `${slot.max - slot.used} / ${slot.max}`)),
    el('div', { class: 'chips', style: { marginTop: '8px' } }, [
      ...(character.cantrips || []).map(id => el('span', { class: 'chip', text: `《${spellById(id)?.name || id}》初級` })),
      ...(character.spells || []).map(id => el('span', { class: 'chip is-on', text: `《${spellById(id)?.name || id}》` })),
    ]),
  ]) : null;

  /* 装備・持ち物・調達は同じ懐を触るので、どれか一つでも動いたら全部描き直す。 */
  const refresh = () => {
    recalculate(character);
    onChange?.(character);
    openCharacterSheet(character, { onChange, canShop });
  };
  const act = result => {
    if (!result.ok) { toast(result.reason); return; }
    refresh();
  };

  const gearBlock = el('div', {}, loadout(character).map(slot => el('div', { class: 'kv' }, [
    el('span', { class: 'kv__k', text: `${slot.name}：${slot.item?.name || '—'}` }),
    el('span', { class: 'row', style: { gap: '4px' } }, [
      el('button', {
        class: 'btn btn--sm btn--ghost',
        onclick: () => openSwap(character, slot, refresh),
      }, ['持ち替え']),
      slot.item ? el('button', {
        class: 'btn btn--sm btn--ghost',
        onclick: () => act(unequip(character, slot.id)),
      }, ['外す']) : null,
    ]),
  ])));

  const inventory = el('div', {}, (character.inventory || []).length
    ? character.inventory.map(i => el('div', { class: 'kv' }, [
      el('span', { class: 'kv__k', text: `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}` }),
      el('span', { class: 'row', style: { gap: '4px' } }, [
        slotFor(i) ? el('button', {
          class: 'btn btn--sm btn--ghost', onclick: () => act(equip(character, i.id)),
        }, ['装備']) : null,
        i.cost ? el('button', {
          class: 'btn btn--sm btn--ghost', onclick: () => act(sell(character, i.id, 1)),
        }, [`売る ${money(Math.floor(i.cost * RESALE))}`]) : null,
      ]),
    ]))
    : [el('p', { class: 'muted tiny', text: '何も持っていない。' })]);

  const shop = canShop
    ? el('div', { class: 'stack' }, [
      el('p', { class: 'tiny faint', text: `手持ち ${money(character.gold || 0)}。売ると定価の${Math.round(RESALE * 100)}%。` }),
      el('div', { class: 'row' }, [
        button('武器', () => openStore(character, 'weapons', refresh), 'btn btn--sm grow'),
        button('防具', () => openStore(character, 'armors', refresh), 'btn btn--sm grow'),
        button('道具', () => openStore(character, 'items', refresh), 'btn btn--sm grow'),
      ]),
    ])
    : null;

  const conditions = character.conditions?.length
    ? el('div', { class: 'chips' }, character.conditions.map(c =>
      el('span', { class: 'chip', text: `${conditionName(c.id)}${c.rounds ? `（${c.rounds}R）` : ''}` })))
    : null;

  return frag(
    el('p', { class: 'muted tiny', text: `${view.ancestry.name}／${view.klass.name}／${view.background.name}　レベル ${view.level}` }),
    abilities,
    section('状態', vitals),
    conditions ? section('現在の状態', conditions) : null,
    section('セーヴィングスロー', saves),
    section('技能', skills),
    section('攻撃', attacks),
    spellBlock ? section(label('spellPlural', '呪文'), spellBlock) : null,
    hasAugments() ? section(label('strain', '適合度'), augmentBlock(character, onChange)) : null,
    traitList(character).length ? section('種族特性', traits) : null,
    section('クラス特徴', features),
    section('装備', gearBlock),
    section('持ち物', inventory),
    shop ? section('調達', shop) : null,
    character.notes ? section('メモ', el('p', { class: 'muted', text: character.notes })) : null,
    onChange ? el('div', { class: 'row', style: { marginTop: '14px' } }, [
      el('button', { class: 'btn btn--sm', onclick: () => adjustHp(character, -1, onChange) }, ['HP −1']),
      el('button', { class: 'btn btn--sm', onclick: () => adjustHp(character, +1, onChange) }, ['HP +1']),
      el('button', { class: 'btn btn--sm', onclick: () => adjustHp(character, -5, onChange) }, ['−5']),
      el('button', { class: 'btn btn--sm', onclick: () => adjustHp(character, +5, onChange) }, ['+5']),
    ]) : null,
  );
}

function adjustHp(character, delta, onChange) {
  character.hp = Math.max(0, Math.min(character.maxHp, character.hp + delta));
  toast(`${character.name}: HP ${character.hp}/${character.maxHp}`);
  onChange?.(character);
}


/* 改造の一覧と着脱。上限を超えても入れられるが、超過ぶんは全判定に響く。 */
function augmentBlock(character, onChange) {
  const info = augmentSummary(character);
  const ratio = info.capacity ? Math.min(1.4, info.used / info.capacity) : 0;

  const gauge = el('div', { class: 'strain' }, [
    el('div', { class: 'spread tiny' }, [
      el('span', { class: 'muted', text: `${info.used} / ${info.capacity}` }),
      el('span', { class: info.over ? '' : 'muted', style: info.over ? { color: 'var(--blood)' } : {}, text: info.note }),
    ]),
    el('div', { class: 'strain__bar' }, [
      el('div', {
        class: `strain__fill ${info.state === 'over' ? 'is-over' : info.state === 'full' ? 'is-full' : ''}`,
        style: { width: `${Math.min(100, ratio * 100)}%` },
      }),
    ]),
  ]);

  const rows = augmentCatalogue().map(aug => {
    const installed = character.augments?.includes(aug.id);
    return el('button', {
      class: 'aug', 'aria-pressed': installed,
      onclick: () => {
        const result = installed ? remove(character, aug.id) : install(character, aug.id);
        if (!result.ok) { toast(result.reason); return; }
        recalculate(character);
        if (result.over > 0) toast(`適合度を ${result.over} 超過 — すべての判定に −${result.over}`);
        onChange?.(character);
        openCharacterSheet(character, { onChange });     // redraw with the new totals
      },
    }, [
      el('span', { class: 'grow' }, [
        el('span', { class: 'aug__name', text: `${installed ? '● ' : '○ '}${aug.name}` }),
        el('span', { class: 'aug__meta', text: `${aug.slot}　${aug.desc}` }),
      ]),
      el('span', { class: 'aug__strain' }, [
        el('span', { text: `負荷 ${aug.strain}` }),
        // 負荷だけでなく値段も見せる。天秤が両方ないと、入れない理由が消える。
        installed ? null : el('span', { class: 'tiny faint', style: { display: 'block' }, text: money(aug.cost) }),
      ]),
    ]);
  });

  return frag(gauge, el('div', { class: 'stack', style: { marginTop: '10px', gap: '6px' } }, rows));
}

/* 通貨の書き方は世界のもの。€$1,500 と 銀貨15枚では、置き場所が違う。 */
function money(cost) {
  if (cost === undefined || cost === null) return '';
  const unit = label('goldUnit', '枚');
  const n = cost.toLocaleString('ja-JP');
  return unit === '€$' ? `€$${n}` : `${n} ${unit}`;
}

/* そのスロットに入れられる持ち物を並べる。持っていないものは出さない——
   買ってから持ち替える、という順序を崩さないため。 */
function openSwap(character, slot, refresh) {
  const mine = (character.inventory || []).filter(i => slotFor(i) === slot.id);
  openSheet(`${slot.name}を持ち替える`, mine.length
    ? el('div', { class: 'stack' }, mine.map(i => el('button', {
      class: 'tile',
      onclick: () => {
        const result = equip(character, i.id);
        if (!result.ok) { toast(result.reason); return; }
        refresh();
      },
    }, [
      el('div', { class: 'tile__head' }, [el('span', { class: 'tile__name', text: i.name })]),
      el('div', { class: 'tile__desc', text: describeThing(i) }),
    ])))
    : el('p', { class: 'muted center tiny', text: `${slot.name}に入れられるものを持っていない。` }));
}

/* 店。世界が売っているものを並べる。持っているものには印をつける。 */
function openStore(character, kind, refresh) {
  const titles = { weapons: '武器', armors: '防具', items: '道具' };
  const stock = gearCatalogue()[kind] || [];
  openSheet(`${titles[kind]}を買う（手持ち ${money(character.gold || 0)}）`,
    el('div', { class: 'stack' }, stock.map(thing => {
      const tooDear = (thing.cost || 0) > (character.gold || 0);
      return el('button', {
        class: 'tile', disabled: tooDear,
        style: tooDear ? { opacity: '0.45' } : {},
        onclick: () => {
          const result = buy(character, thing.id);
          if (!result.ok) { toast(result.reason); return; }
          toast(`${thing.name} を買った`);
          refresh();
        },
      }, [
        el('div', { class: 'tile__head' }, [
          el('span', { class: 'tile__name', text: `${owns(character, thing.id) ? '● ' : ''}${thing.name}` }),
          el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: money(thing.cost) }),
        ]),
        el('div', { class: 'tile__desc', text: describeThing(thing) }),
      ]);
    })));
}

/** 品の一行説明。武器はダメージ、防具はAC、道具は説明文。 */
function describeThing(thing) {
  if (thing.damage) return `${thing.damage} ${thing.type || ''}　${(thing.tags || []).join('・')}`;
  if (thing.base !== undefined) return `AC ${thing.base}${thing.maxDex !== undefined ? `（敏捷は+${thing.maxDex}まで）` : ''}`;
  if (thing.ac) return `AC +${thing.ac}`;
  return thing.desc || '';
}

/** その技能で何ができるのか。判定を選ぶ前に読めるように。 */
export function openSkillHelp(skill, mod) {
  openSheet(`【${skill.name}】${mod === undefined ? '' : signed(mod)}`, el('div', { class: 'stack' }, [
    el('p', { text: skill.desc || '' }),
    skill.example ? el('p', { class: 'muted tiny', style: { lineHeight: '1.8' }, text: skill.example }) : null,
    el('p', { class: 'tiny faint', text: `能力値：${abilityName(skill.ability)}` }),
  ]));
}

const kv = (k, v) => el('div', { class: 'kv' }, [
  el('span', { class: 'kv__k', text: k }),
  el('span', { class: 'kv__v', text: String(v) }),
]);

const section = (title, body) => el('div', { style: { marginTop: '16px' } }, [
  el('h3', { class: 'card__title', text: title }),
  body,
]);

export { kv, section };
