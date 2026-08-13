/* Character sheet rendering, shared by solo play and the session tool. */

import { el, frag, hpBar, signed, openSheet, toast } from './dom.js';
import { sheet as buildSheet } from '../core/character.js';
import { ABILITIES, SKILLS, abilityName, CONDITIONS } from '../core/rules.js';
import { conditionName } from '../core/combat.js';
import { spellById } from '../core/content.js';

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
export function openCharacterSheet(character, { onChange } = {}) {
  openSheet(`${character.portrait || '🎲'} ${character.name}`, characterSheet(character, { onChange }));
}

export function characterSheet(character, { onChange } = {}) {
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
    kv('ヒットダイス', `${view.hitDice ?? view.level} × ${view.hitDie}`),
    kv('経験点', `${view.xp || 0}`),
    view.gold !== undefined ? kv('所持金', `${view.gold} 枚`) : null,
  ]);

  const saves = el('div', { class: 'chips' }, ABILITIES.map(a =>
    el('span', { class: `chip ${character.saves?.includes(a.id) ? 'is-on' : ''}` },
      [`${a.name} ${signed(view.saveMods[a.id])}`])));

  const skills = el('div', { class: 'skills' }, SKILLS.map(s => {
    const trained = character.skills?.includes(s.id);
    const expert = character.expertise?.includes(s.id);
    return el('div', { class: `skill ${trained ? 'is-trained' : ''}` }, [
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

  const spellBlock = view.klass.caster ? el('div', {}, [
    kv('呪文能力値', abilityName(view.spellAbility)),
    kv('呪文セーヴDC', view.spellDC),
    kv('呪文攻撃', signed(view.spellAttack)),
    ...Object.entries(view.slots || {}).map(([lv, slot]) =>
      kv(`${lv}レベル枠`, `${slot.max - slot.used} / ${slot.max}`)),
    el('div', { class: 'chips', style: { marginTop: '8px' } }, [
      ...(character.cantrips || []).map(id => el('span', { class: 'chip', text: `《${spellById(id)?.name || id}》初級` })),
      ...(character.spells || []).map(id => el('span', { class: 'chip is-on', text: `《${spellById(id)?.name || id}》` })),
    ]),
  ]) : null;

  const inventory = el('div', {}, (character.inventory || []).length
    ? character.inventory.map(i => kv(`${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`, i.desc ? '' : ''))
    : [el('p', { class: 'muted tiny', text: '何も持っていない。' })]);

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
    spellBlock ? section('呪文', spellBlock) : null,
    section('クラス特徴', features),
    section('持ち物', inventory),
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

const kv = (k, v) => el('div', { class: 'kv' }, [
  el('span', { class: 'kv__k', text: k }),
  el('span', { class: 'kv__v', text: String(v) }),
]);

const section = (title, body) => el('div', { style: { marginTop: '16px' } }, [
  el('h3', { class: 'card__title', text: title }),
  body,
]);

export { kv, section };
