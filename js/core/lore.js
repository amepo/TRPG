/* 世界の読み物 — 地名・勢力・人物と、卓で振れる表。

   ルールには一切触らない層。数値を持たず、判定にも戦闘にも関わらない。
   ここにあるのは「その世界がどんな場所か」だけで、ソロで遊ぶときは雰囲気の
   補強に、卓を回すときは即席の材料になる。

   content.js と同じく、能動的な世界の眺めとして働く。世界を切り替えれば
   中身も差し替わる。lore を持たない世界（自作の世界を足したとき）でも
   空の器が返るので、UI 側で分岐しなくていい。 */

import { onWorld } from '../worlds/index.js';

const EMPTY = {
  primer: [], timeline: [], truths: [], places: [], factions: [], figures: [],
  economy: null, names: { given: [], family: [] }, tables: [],
};

export let LORE = EMPTY;

onWorld(world => { LORE = { ...EMPTY, ...(world.lore || {}) }; });

export const hasLore = () => LORE.primer.length > 0 || LORE.places.length > 0;

export const tableById = id => LORE.tables.find(t => t.id === id) || null;

/**
 * 表を1つ振る。
 * @param {string|object} table 表かその id
 * @param {object} rng Rng（省略すると Math.random）
 * @returns {string|null}
 */
export function rollTable(table, rng) {
  const t = typeof table === 'string' ? tableById(table) : table;
  if (!t?.entries?.length) return null;
  return rng ? rng.pick(t.entries) : t.entries[Math.floor(Math.random() * t.entries.length)];
}

/** その世界らしい名前を1つ。姓を持つ世界なら姓もつける。 */
export function randomName(rng) {
  const { given = [], family = [] } = LORE.names || {};
  if (!given.length) return null;
  const pick = list => (rng ? rng.pick(list) : list[Math.floor(Math.random() * list.length)]);
  const first = pick(given);
  if (!family.length) return first;
  return `${first}・${pick(family)}`;
}
