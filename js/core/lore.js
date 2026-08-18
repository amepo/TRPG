/* 世界の読み物 — 地名・勢力・人物と、卓で振れる表。

   ルールには一切触らない層。数値を持たず、判定にも戦闘にも関わらない。
   ここにあるのは「その世界がどんな場所か」だけで、ソロで遊ぶときは雰囲気の
   補強に、卓を回すときは即席の材料になる。

   content.js と同じく、能動的な世界の眺めとして働く。世界を切り替えれば
   中身も差し替わる。lore を持たない世界（自作の世界を足したとき）でも
   空の器が返るので、UI 側で分岐しなくていい。 */

import { onWorld } from '../worlds/index.js';

const EMPTY = {
  primer: [], timeline: [], truths: [], districts: [], places: [], factions: [], figures: [],
  economy: null, standing: null, calendar: null, names: { given: [], family: [] }, tables: [],
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

/**
 * その世界らしい名前を1つ。
 *
 * 世界によって名前の作りが違う。企業の街では全員が登録された姓を持つが、
 * 灯火の地方では姓を名乗れるのは一部の人間だけで、大半は「どこの誰」で
 * 呼ばれる——粉屋のミラ、ヴェルナのガレス。bynames はその「どこの」にあたる。
 */
export function randomName(rng) {
  const { given = [], family = [], bynames = [] } = LORE.names || {};
  if (!given.length) return null;
  const pick = list => (rng ? rng.pick(list) : list[Math.floor(Math.random() * list.length)]);
  const chance = () => (rng ? rng.float() : Math.random());
  const first = pick(given);
  if (family.length) return `${first}・${pick(family)}`;
  // 三人に二人は出自で呼ばれる。残りは名前だけ——顔見知りのあいだではそれで足りる。
  if (bynames.length && chance() < 0.66) return `${pick(bynames)}の${first}`;
  return first;
}
