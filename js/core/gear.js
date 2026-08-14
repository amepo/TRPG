/* 装備と調達 — 持ち物を買い、売り、持ち替える。

   これまで装備はクラスが作成時に一度配るだけで、以後どうやっても変えられ
   なかった。戦士は最初のロングソードを一生持ち歩き、値段だけが全部の品に
   ついていて、買う手段が無かった。

   ここは世界を知らない。何が売られているかは世界が決め（weapons/armors/items）、
   誰がいくら払うかはその人物の懐が決める。ルールの計算は rules.js のまま。

   スロットは4つ:
     weapon  近接に使う一本   ranged  遠隔に使う一本
     armor   身につける一式   shield  空いた手に持つもの */

import {
  WEAPONS, ARMORS, SHIELD, ITEMS, weaponById, armorById, itemById,
} from './content.js';

/** 売るときは半値。買い戻せない差額が、この街（とこの地方）の取り分。 */
export const RESALE = 0.5;

export const SLOTS = [
  { id: 'weapon', name: '近接', kinds: ['weapon'] },
  { id: 'ranged', name: '遠隔', kinds: ['weapon'] },
  { id: 'armor', name: '防具', kinds: ['armor'] },
  { id: 'shield', name: '盾', kinds: ['shield'] },
];

/* ------------------------------------------------------------ 品ぞろえ */

/**
 * この世界で買えるもの。種類ごとに分けて返す。
 * @returns {{weapons:object[], armors:object[], items:object[]}}
 */
export function catalogue() {
  const buyable = thing => thing && thing.cost !== undefined && thing.cost > 0;
  return {
    weapons: Object.values(WEAPONS).filter(buyable),
    armors: [...Object.values(ARMORS), SHIELD].filter(buyable),
    items: Object.values(ITEMS).filter(buyable),
  };
}

/** id からその品を引く。武器・防具・道具のどれでもよい。 */
export function thingById(id) {
  if (id === 'shield') return SHIELD;
  return weaponById(id) || armorById(id) || itemById(id) || null;
}

/** その品はどのスロットに入るか。入らないなら null。 */
export function slotFor(thing) {
  if (!thing) return null;
  if (thing.id === 'shield') return 'shield';
  if (thing.base !== undefined) return 'armor';                 // 防具は base(AC) を持つ
  if (thing.damage !== undefined) return thing.ranged ? 'ranged' : 'weapon';
  return null;                                                   // 道具は装備しない
}

/* ---------------------------------------------------------------- 売買 */

/**
 * 買う。買ったものは持ち物に入る（装備はしない）。
 * @returns {{ok:boolean, reason?:string, paid?:number, item?:object}}
 */
export function buy(character, id, count = 1) {
  const thing = thingById(id);
  if (!thing) return { ok: false, reason: 'そんなものは売っていません' };
  const price = (thing.cost || 0) * count;
  if (price > (character.gold || 0)) {
    return { ok: false, reason: `足りません（${price} 必要、残り ${character.gold || 0}）` };
  }
  character.gold -= price;
  addToBag(character, thing, count);
  return { ok: true, paid: price, item: thing };
}

/**
 * 売る。装備しているものは外してから売る。
 * @returns {{ok:boolean, reason?:string, got?:number}}
 */
export function sell(character, id, count = 1) {
  const entry = (character.inventory || []).find(i => i.id === id);
  if (!entry) return { ok: false, reason: '持っていません' };
  const sold = Math.min(count, entry.count);
  const got = Math.floor((entry.cost || 0) * RESALE) * sold;

  entry.count -= sold;
  if (entry.count <= 0) character.inventory = character.inventory.filter(i => i.id !== id);
  character.gold = (character.gold || 0) + got;
  return { ok: true, got, count: sold };
}

/* -------------------------------------------------------------- 持ち替え */

/**
 * 装備する。今つけているものは持ち物に戻る。
 * 持っていないものは装備できない——買ってからでないと持てない。
 * @returns {{ok:boolean, reason?:string, replaced?:object}}
 */
export function equip(character, id) {
  const thing = thingById(id);
  const slot = slotFor(thing);
  if (!slot) return { ok: false, reason: 'それは身につけるものではありません' };
  if (!owns(character, id)) return { ok: false, reason: '持っていません' };

  character.equipped = character.equipped || {};
  const replaced = character.equipped[slot];
  if (replaced) addToBag(character, replaced, 1);

  takeFromBag(character, id, 1);
  character.equipped[slot] = { ...thing };
  return { ok: true, slot, replaced };
}

/** 外して持ち物に戻す。 */
export function unequip(character, slot) {
  const thing = character.equipped?.[slot];
  if (!thing) return { ok: false, reason: '何もつけていません' };
  delete character.equipped[slot];
  addToBag(character, thing, 1);
  return { ok: true, item: thing };
}

/** 装備しているものも含めて、その品を持っているか。 */
export const owns = (character, id) =>
  (character.inventory || []).some(i => i.id === id && i.count > 0);

/** 今つけているものの一覧。空きスロットも返す。 */
export const loadout = character => SLOTS.map(slot => ({
  ...slot, item: character.equipped?.[slot.id] || null,
}));

/* 持ち物の出し入れ。character.js の addItem と同じ形にそろえてある。 */
function addToBag(character, thing, count) {
  character.inventory = character.inventory || [];
  const existing = character.inventory.find(i => i.id === thing.id);
  if (existing) existing.count += count;
  else character.inventory.push({ ...thing, count });
}

function takeFromBag(character, id, count) {
  const entry = (character.inventory || []).find(i => i.id === id);
  if (!entry) return false;
  entry.count -= count;
  if (entry.count <= 0) character.inventory = character.inventory.filter(i => i.id !== id);
  return true;
}
