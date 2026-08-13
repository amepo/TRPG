/* Game content: ancestries, classes, backgrounds, gear, spells and monsters.

   Plain data only. The rules engine reads these; nothing here imports the UI.
   Scenario files may add their own monsters and items with the same shape. */

/* -------------------------------------------------------------- ancestry */

export const ANCESTRIES = [
  {
    id: 'human', name: '人間', blurb: '順応性が高く、どんな道でも並以上に歩ける。',
    bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 9, traits: ['多才：技能をもう1つ習得する'], extraSkills: 1,
  },
  {
    id: 'elf', name: 'エルフ', blurb: '森と星の民。感覚が鋭く、魅了を寄せつけない。',
    bonus: { dex: 2, wis: 1 }, speed: 10.5,
    traits: ['鋭敏な感覚：【知覚】を習得', '妖精の血：魅了への抵抗', '夜目：暗がりでも見える'],
    grantSkills: ['perception'], keywords: ['darkvision', 'charm-resist'],
  },
  {
    id: 'dwarf', name: 'ドワーフ', blurb: '岩の下で鍛えられた頑健な工人。',
    bonus: { con: 2, str: 1 }, speed: 7.5,
    traits: ['頑健：毒セーヴに有利、最大HP +1/レベル', '石工の目：石造建築を見抜く', '夜目'],
    hpPerLevel: 1, keywords: ['darkvision', 'poison-resist'],
  },
  {
    id: 'halfling', name: 'ハーフリング', blurb: '小柄で運が良い。誰よりも先に危険を嗅ぎつける。',
    bonus: { dex: 2, cha: 1 }, speed: 7.5,
    traits: ['幸運：ナチュラル1を1度だけ振り直せる', '身軽：大型の相手の脇をすり抜ける'],
    keywords: ['lucky'],
  },
  {
    id: 'dragonborn', name: '竜血', blurb: '古竜の血を継ぎ、喉の奥に炎を宿す。',
    bonus: { str: 2, cha: 1 }, speed: 9,
    traits: ['竜の吐息：範囲攻撃（休憩ごとに1回）', '竜鱗：属性への抵抗'],
    keywords: ['breath-weapon'],
  },
  {
    id: 'tiefling', name: '魔筋', blurb: '遠い昔に交わった異界の血。影と炎に好かれる。',
    bonus: { cha: 2, int: 1 }, speed: 9,
    traits: ['地獄の抵抗：火ダメージ半減', '闇の知恵：暗がりで見える'],
    resistances: ['火'], keywords: ['darkvision'],
  },
];

export const ancestryById = id => ANCESTRIES.find(a => a.id === id) || ANCESTRIES[0];

/* ---------------------------------------------------------------- classes */

export const CLASSES = [
  {
    id: 'fighter', name: '戦士', blurb: '前線で受けて、前線で殴る。生き残る技術の専門家。',
    hitDie: '1d10', hpBase: 10, saves: ['str', 'con'],
    skillChoices: 2,
    skillList: ['athletics', 'acrobatics', 'perception', 'survival', 'intimidation', 'insight', 'animal', 'history'],
    armor: 'chain', weapon: 'longsword', offhand: 'shield',
    primary: 'str',
    features: [
      { level: 1, id: 'secondWind', name: '再起', desc: '休憩ごとに1回、ボーナス行動で 1d10＋レベル 回復する。' },
      { level: 2, id: 'surge', name: '猛攻', desc: '戦闘ごとに1回、追加で1回攻撃できる。' },
      { level: 3, id: 'defender', name: '守勢', desc: '味方が隣にいる間、AC +1。' },
      { level: 5, id: 'extraAttack', name: '追撃', desc: '攻撃行動で2回攻撃する。' },
    ],
  },
  {
    id: 'rogue', name: '盗剣士', blurb: '正面から戦わない。隙を作り、そこだけを刺す。',
    hitDie: '1d8', hpBase: 8, saves: ['dex', 'int'],
    skillChoices: 4,
    skillList: ['stealth', 'sleight', 'acrobatics', 'perception', 'investigation', 'deception', 'persuasion', 'insight', 'athletics'],
    expertiseChoices: 2,
    armor: 'leather', weapon: 'shortsword', ranged: 'shortbow',
    primary: 'dex',
    features: [
      { level: 1, id: 'sneakAttack', name: '急所突き', desc: '有利な状況の攻撃が命中したとき、追加ダメージ（レベルに応じて増える）。' },
      { level: 1, id: 'expertise', name: '熟達', desc: '選んだ2技能の習熟ボーナスが2倍。' },
      { level: 2, id: 'cunning', name: '狡知', desc: 'ボーナス行動で隠れる／離脱できる。' },
      { level: 5, id: 'uncanny', name: '危機回避', desc: '敏捷セーヴの失敗ダメージを半分にする。' },
    ],
  },
  {
    id: 'mage', name: '秘術師', blurb: '知識で世界を書き換える。ただし紙より脆い。',
    hitDie: '1d6', hpBase: 6, saves: ['int', 'wis'],
    skillChoices: 2,
    skillList: ['arcana', 'history', 'investigation', 'nature', 'religion', 'insight', 'medicine'],
    armor: null, weapon: 'staff', primary: 'int',
    caster: { ability: 'int', cantrips: ['firebolt', 'lightTouch'], known: 6 },
    features: [
      { level: 1, id: 'spellcasting', name: '呪文行使', desc: '知力を基準に秘術呪文を唱える。' },
      { level: 2, id: 'arcaneRecovery', name: '秘術回復', desc: '小休憩で呪文スロットを1つ取り戻す（1日1回）。' },
      { level: 3, id: 'shieldSelf', name: '護りの符', desc: '被弾時に反応でAC +5（呪文スロットを消費）。' },
      { level: 5, id: 'empower', name: '増幅', desc: 'ダメージ呪文のダイス1個を振り直せる。' },
    ],
  },
  {
    id: 'cleric', name: '司祭', blurb: '祈りで傷を塞ぎ、必要なら鈍器で決着をつける。',
    hitDie: '1d8', hpBase: 8, saves: ['wis', 'cha'],
    skillChoices: 2,
    skillList: ['religion', 'medicine', 'insight', 'persuasion', 'history', 'perception'],
    armor: 'chain', weapon: 'mace', offhand: 'shield', primary: 'wis',
    caster: { ability: 'wis', cantrips: ['sacredSpark', 'guidance'], known: 6 },
    features: [
      { level: 1, id: 'spellcasting', name: '祈祷', desc: '判断力を基準に神聖呪文を唱える。' },
      { level: 1, id: 'channelHeal', name: '癒しの手', desc: '休憩ごとに1回、味方1体を 2d8＋レベル 回復。' },
      { level: 2, id: 'turnUndead', name: '退散', desc: 'アンデッドに恐怖を与える（判断セーヴ）。' },
      { level: 5, id: 'divineStrike', name: '神威の一撃', desc: '近接攻撃に +1d8 の聖ダメージ。' },
    ],
  },
  {
    id: 'ranger', name: '追跡者', blurb: '道なき道を読み、遠くから確実に仕留める。',
    hitDie: '1d10', hpBase: 10, saves: ['str', 'dex'],
    skillChoices: 3,
    skillList: ['survival', 'perception', 'stealth', 'nature', 'animal', 'athletics', 'investigation'],
    armor: 'leather', weapon: 'shortsword', ranged: 'longbow', primary: 'dex',
    caster: { ability: 'wis', cantrips: [], known: 3, halfCaster: true },
    features: [
      { level: 1, id: 'favoredFoe', name: '宿敵', desc: '選んだ種別の相手を追跡する判定に有利、初撃に +1d4。' },
      { level: 2, id: 'trailwise', name: '道読み', desc: '移動中の遭遇判定に有利。' },
      { level: 3, id: 'hunterMark', name: '狩人の印', desc: '印をつけた相手への攻撃に +1d6。' },
      { level: 5, id: 'extraAttack', name: '追撃', desc: '攻撃行動で2回攻撃する。' },
    ],
  },
];

export const classById = id => CLASSES.find(c => c.id === id) || CLASSES[0];

/** Sneak attack scales with level: 1d6 at 1–2, 2d6 at 3–4, and so on. */
export const sneakAttackDice = level => `${Math.ceil(Math.max(1, level) / 2)}d6`;

/* ------------------------------------------------------------ backgrounds */

export const BACKGROUNDS = [
  { id: 'soldier', name: '元兵士', skills: ['athletics', 'intimidation'], gear: ['軍の記章', '賽子一組'], blurb: '国境の砦で数年。命令には慣れているが、もう聞く気はない。' },
  { id: 'scholar', name: '学院崩れ', skills: ['arcana', 'history'], gear: ['書きかけの手記', 'インク壺'], blurb: '学位を取る前に追い出された。理由は本人だけが知っている。' },
  { id: 'thief', name: '路地育ち', skills: ['stealth', 'deception'], gear: ['盗品の指輪', '鍵開け道具'], blurb: '街の裏側の地図なら頭に入っている。' },
  { id: 'acolyte', name: '寺院育ち', skills: ['religion', 'insight'], gear: ['聖印', '祈祷書'], blurb: '信仰は残っているが、教団への忠誠は残っていない。' },
  { id: 'hunter', name: '罠猟師', skills: ['survival', 'animal'], gear: ['罠一式', '毛皮の外套'], blurb: '森の静けさの読み方を知っている。' },
  { id: 'merchant', name: '行商人', skills: ['persuasion', 'investigation'], gear: ['帳簿', '天秤'], blurb: '値段のつかないものにも値段をつける癖がある。' },
  { id: 'performer', name: '旅芸人', skills: ['performance', 'acrobatics'], gear: ['竪琴', '派手な衣装'], blurb: '拍手で食っていた。今は別の稼ぎ方を探している。' },
];

export const backgroundById = id => BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];

/* ------------------------------------------------------------------ gear */

export const WEAPONS = {
  longsword: { id: 'longsword', name: 'ロングソード', damage: '1d8', type: '斬撃', ability: 'str', tags: ['近接'] },
  shortsword: { id: 'shortsword', name: 'ショートソード', damage: '1d6', type: '刺突', ability: 'dex', tags: ['近接', '軽量'] },
  greataxe: { id: 'greataxe', name: 'グレートアクス', damage: '1d12', type: '斬撃', ability: 'str', tags: ['近接', '両手'] },
  mace: { id: 'mace', name: 'メイス', damage: '1d6', type: '打撃', ability: 'str', tags: ['近接'] },
  dagger: { id: 'dagger', name: 'ダガー', damage: '1d4', type: '刺突', ability: 'dex', tags: ['近接', '軽量', '投擲'] },
  staff: { id: 'staff', name: 'クォータースタッフ', damage: '1d6', type: '打撃', ability: 'str', tags: ['近接'] },
  spear: { id: 'spear', name: 'スピア', damage: '1d6', type: '刺突', ability: 'str', tags: ['近接', 'リーチ'] },
  shortbow: { id: 'shortbow', name: 'ショートボウ', damage: '1d6', type: '刺突', ability: 'dex', tags: ['遠隔'], ranged: true },
  longbow: { id: 'longbow', name: 'ロングボウ', damage: '1d8', type: '刺突', ability: 'dex', tags: ['遠隔', '両手'], ranged: true },
  crossbow: { id: 'crossbow', name: 'クロスボウ', damage: '1d8', type: '刺突', ability: 'dex', tags: ['遠隔'], ranged: true },
  sling: { id: 'sling', name: 'スリング', damage: '1d4', type: '打撃', ability: 'dex', tags: ['遠隔'], ranged: true },
  unarmed: { id: 'unarmed', name: '素手', damage: '1d2', type: '打撃', ability: 'str', tags: ['近接'] },
};

export const ARMORS = {
  leather: { id: 'leather', name: 'レザーアーマー', base: 11, maxDex: undefined, stealth: 0 },
  studded: { id: 'studded', name: 'スタッデッドレザー', base: 12, maxDex: undefined, stealth: 0 },
  hide: { id: 'hide', name: 'ハイドアーマー', base: 12, maxDex: 2, stealth: 0 },
  chain: { id: 'chain', name: 'チェインシャツ', base: 13, maxDex: 2, stealth: 0 },
  breastplate: { id: 'breastplate', name: 'ブレストプレート', base: 14, maxDex: 2, stealth: 0 },
  plate: { id: 'plate', name: 'プレートアーマー', base: 16, maxDex: 0, stealth: -2 },
};

export const SHIELD = { id: 'shield', name: 'シールド', ac: 2 };

export const ITEMS = {
  potion: { id: 'potion', name: '治癒の薬', use: 'heal', amount: '2d4+2', desc: '飲むと 2d4+2 回復する。', consumable: true },
  greaterPotion: { id: 'greaterPotion', name: '上級治癒薬', use: 'heal', amount: '4d4+4', desc: '飲むと 4d4+4 回復する。', consumable: true },
  antidote: { id: 'antidote', name: '解毒薬', use: 'cure', cures: ['poisoned'], desc: '毒状態を取り除く。', consumable: true },
  bomb: { id: 'bomb', name: '発火瓶', use: 'damage', amount: '2d6', type: '火', area: true, desc: '投げつけて 2d6 の火ダメージ（範囲）。', consumable: true },
  rope: { id: 'rope', name: '麻縄（15m）', desc: '登攀や拘束に使う。' },
  torch: { id: 'torch', name: '松明', desc: '暗所を照らす。手が1つ塞がる。' },
  lockpicks: { id: 'lockpicks', name: '鍵開け道具', desc: '錠前を開ける判定に必要。' },
  rations: { id: 'rations', name: '携行食（3日分）', desc: '野営に使う。' },
  holySymbol: { id: 'holySymbol', name: '聖印', desc: '神聖呪文の焦点具。' },
  spellbook: { id: 'spellbook', name: '呪文書', desc: '秘術呪文の焦点具。' },
};

/* ---------------------------------------------------------------- spells */

/* effect.kind:
     damage  — roll `damage`; `save` lets the target halve or negate it
     heal    — restore `amount`
     condition — apply `condition` for `rounds` (save negates when set)
     buff    — apply a helpful condition to an ally or self
     utility — narrative only; the scenario decides what it unlocks       */

export const SPELLS = {
  firebolt: {
    id: 'firebolt', name: '火矢', level: 0, school: '力術', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '1d10', type: '火', attack: true },
    scale: level => `${Math.ceil(level / 4) || 1}d10`,
    desc: '指先から火の矢を放つ。攻撃ロールで命中判定。',
  },
  sacredSpark: {
    id: 'sacredSpark', name: '聖火', level: 0, school: '力術', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '1d8', type: '聖', save: 'dex' },
    scale: level => `${Math.ceil(level / 4) || 1}d8`,
    desc: '光の柱が降る。敏捷セーヴ成功で無効。',
  },
  lightTouch: {
    id: 'lightTouch', name: '灯火', level: 0, school: '力術', target: 'self', range: '接触',
    effect: { kind: 'utility', flag: 'light' }, desc: '触れたものが1時間光る。暗所の判定不利を打ち消す。',
  },
  guidance: {
    id: 'guidance', name: '導き', level: 0, school: '占術', target: 'ally', range: '接触',
    effect: { kind: 'buff', condition: 'guided', rounds: 10 }, desc: '次の能力判定に +1d4。',
  },
  magicMissile: {
    id: 'magicMissile', name: '魔法の矢', level: 1, school: '力術', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '3d4+3', type: '力', autoHit: true },
    desc: '必ず命中する光の矢。回避もセーヴもできない。',
  },
  burningHands: {
    id: 'burningHands', name: '燃える手', level: 1, school: '力術', target: 'area', range: '扇形',
    effect: { kind: 'damage', damage: '3d6', type: '火', save: 'dex', halfOnSave: true },
    desc: '前方の敵すべてに炎を浴びせる。敏捷セーヴで半減。',
  },
  cureWounds: {
    id: 'cureWounds', name: '傷の治癒', level: 1, school: '召喚術', target: 'ally', range: '接触',
    effect: { kind: 'heal', amount: '1d8+3' }, desc: '触れた相手の傷を塞ぐ。',
  },
  bless: {
    id: 'bless', name: '祝福', level: 1, school: '心術', target: 'ally', range: '近距離',
    effect: { kind: 'buff', condition: 'blessed', rounds: 10 }, desc: '攻撃とセーヴに +1d4。',
  },
  shieldOfFaith: {
    id: 'shieldOfFaith', name: '信仰の盾', level: 1, school: '防御術', target: 'ally', range: '近距離',
    effect: { kind: 'buff', acBonus: 2, rounds: 10 }, desc: '対象の AC を 2 上げる。',
  },
  sleep: {
    id: 'sleep', name: '眠りの雲', level: 1, school: '心術', target: 'enemy', range: '遠隔',
    effect: { kind: 'condition', condition: 'unconscious', rounds: 3, save: 'wis' },
    desc: '判断セーヴに失敗した相手を眠らせる。',
  },
  charm: {
    id: 'charm', name: '魅了', level: 1, school: '心術', target: 'enemy', range: '近距離',
    effect: { kind: 'condition', condition: 'frightened', rounds: 4, save: 'wis' },
    desc: '相手の敵意を鈍らせる。交渉中に使うと場面が変わることがある。',
  },
  huntersMark: {
    id: 'huntersMark', name: '狩人の印', level: 1, school: '占術', target: 'enemy', range: '遠隔',
    effect: { kind: 'mark', bonusDamage: '1d6', rounds: 10 }, desc: '印をつけた相手への攻撃に +1d6。',
  },
  scorchingRay: {
    id: 'scorchingRay', name: '灼熱光線', level: 2, school: '力術', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '6d6', type: '火', attack: true }, desc: '三条の熱線を放つ。',
  },
  holdPerson: {
    id: 'holdPerson', name: '人間縛り', level: 2, school: '心術', target: 'enemy', range: '遠隔',
    effect: { kind: 'condition', condition: 'stunned', rounds: 3, save: 'wis' }, desc: '人型の相手を硬直させる。',
  },
  spiritGuardians: {
    id: 'spiritGuardians', name: '守護霊', level: 2, school: '召喚術', target: 'area', range: '自身周囲',
    effect: { kind: 'damage', damage: '3d8', type: '聖', save: 'wis', halfOnSave: true }, desc: '周囲の敵を裁く光の霊。',
  },
  aid: {
    id: 'aid', name: '援護', level: 2, school: '防御術', target: 'party', range: '近距離',
    effect: { kind: 'heal', amount: '5', temp: true }, desc: '仲間全員に一時HPを与える。',
  },
};

export const spellById = id => SPELLS[id] || null;

/** Slots per spell level for a caster of the given class level. */
export function spellSlots(level, halfCaster = false) {
  const effective = halfCaster ? Math.ceil(level / 2) : level;
  const table = {
    1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 }, 6: { 1: 4, 2: 3, 3: 3 },
    7: { 1: 4, 2: 3, 3: 3, 4: 1 }, 8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  };
  return table[Math.min(10, Math.max(1, effective))] || { 1: 2 };
}

/** Spells a class can learn, by class id. */
export const CLASS_SPELLS = {
  mage: ['magicMissile', 'burningHands', 'sleep', 'charm', 'scorchingRay', 'holdPerson'],
  cleric: ['cureWounds', 'bless', 'shieldOfFaith', 'charm', 'spiritGuardians', 'aid'],
  ranger: ['huntersMark', 'cureWounds', 'charm'],
};

/* -------------------------------------------------------------- monsters */

/* `hp` is rolled when the monster enters play; `hpAvg` is the fallback.
   `tactics` steers the very small combat AI:
     brute    — attack whoever is closest / most wounded
     skirmish — prefer the weakest target, retreat when badly hurt
     caster   — open with a spell-like attack, then melee
     support  — buff and heal its allies first                       */

export const MONSTERS = {
  goblin: {
    id: 'goblin', name: 'ゴブリン', kind: '人型', cr: 0.25, xp: 50,
    acOverride: 15, hp: '2d6+2', hpAvg: 9, speed: 9,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [{ name: '錆びた短刀', bonus: 4, damage: '1d6+2', type: '刺突' }],
    tactics: 'skirmish', traits: ['臆病：仲間が半減すると逃走判定'],
    blurb: '汚れた革鎧。数が揃うと途端に強気になる。',
  },
  goblinArcher: {
    id: 'goblinArcher', name: 'ゴブリンの射手', kind: '人型', cr: 0.25, xp: 50,
    acOverride: 14, hp: '2d6+2', hpAvg: 9, speed: 9,
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [{ name: '粗末な弓', bonus: 4, damage: '1d6+2', type: '刺突', ranged: true }],
    tactics: 'skirmish', blurb: '木の上や物陰から狙ってくる。',
  },
  goblinBoss: {
    id: 'goblinBoss', name: 'ゴブリンの頭目', kind: '人型', cr: 1, xp: 200,
    acOverride: 17, hp: '6d6+6', hpAvg: 27, speed: 9,
    abilities: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 12 },
    attacks: [
      { name: '曲刀', bonus: 4, damage: '1d6+2', type: '斬撃' },
      { name: '曲刀（連撃）', bonus: 4, damage: '1d6+2', type: '斬撃' },
    ],
    tactics: 'brute', traits: ['号令：味方の攻撃に有利を与える'],
    blurb: '略奪品の胸当てを着けた、群れで一番大きな個体。',
  },
  wolf: {
    id: 'wolf', name: '狼', kind: '獣', cr: 0.25, xp: 50,
    acOverride: 13, hp: '2d8+2', hpAvg: 11, speed: 12,
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: '噛みつき', bonus: 4, damage: '2d4+2', type: '刺突', onHit: { save: 'str', dc: 11, condition: 'prone' } }],
    tactics: 'brute', traits: ['群れ戦術：味方が隣接する相手への攻撃に有利'],
    blurb: '痩せている。空腹は狼を大胆にする。',
  },
  direWolf: {
    id: 'direWolf', name: '大狼', kind: '獣', cr: 1, xp: 200,
    acOverride: 14, hp: '5d10+5', hpAvg: 32, speed: 15,
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    attacks: [{ name: '噛み砕き', bonus: 5, damage: '2d6+3', type: '刺突', onHit: { save: 'str', dc: 13, condition: 'prone' } }],
    tactics: 'brute', blurb: '馬ほどもある。目だけが理性を欠いている。',
  },
  skeleton: {
    id: 'skeleton', name: 'スケルトン', kind: '不死', cr: 0.25, xp: 50,
    acOverride: 13, hp: '2d8+4', hpAvg: 13, speed: 9,
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    attacks: [{ name: '朽ちた剣', bonus: 4, damage: '1d6+2', type: '斬撃' }],
    resistances: ['刺突'], vulnerabilities: ['打撃'],
    tactics: 'brute', blurb: '関節の隙間から土がこぼれる。命令だけが残っている。',
  },
  zombie: {
    id: 'zombie', name: '歩く骸', kind: '不死', cr: 0.25, xp: 50,
    acOverride: 8, hp: '3d8+9', hpAvg: 22, speed: 6,
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    attacks: [{ name: '殴打', bonus: 3, damage: '1d6+1', type: '打撃' }],
    tactics: 'brute', traits: ['不死の頑健さ：0HPになったとき耐久セーヴDC10で1HP残る'],
    blurb: '遅い。ただし止まらない。',
  },
  cultist: {
    id: 'cultist', name: 'カルトの信者', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 12, hp: '2d8', hpAvg: 9, speed: 9,
    abilities: { str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: '儀式用短剣', bonus: 3, damage: '1d4+1', type: '刺突' }],
    tactics: 'brute', blurb: '目だけが妙に落ち着いている。',
  },
  cultLeader: {
    id: 'cultLeader', name: '祭儀者', kind: '人型', cr: 2, xp: 450,
    acOverride: 13, hp: '6d8+6', hpAvg: 33, speed: 9,
    abilities: { str: 11, dex: 12, con: 12, int: 13, wis: 16, cha: 14 },
    attacks: [
      { name: '暗黒の光条', bonus: 5, damage: '2d8', type: '死', ranged: true },
      { name: '儀式の刃', bonus: 3, damage: '1d6+1', type: '刺突' },
    ],
    tactics: 'caster', traits: ['闇の加護：1度だけ、受けたダメージを半分にする'],
    blurb: '灯りを背にして立つと、影が人の形をしていない。',
  },
  giantSpider: {
    id: 'giantSpider', name: '大蜘蛛', kind: '獣', cr: 1, xp: 200,
    acOverride: 14, hp: '4d10+4', hpAvg: 26, speed: 9,
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    attacks: [{ name: '毒牙', bonus: 5, damage: '1d8+3', type: '毒', onHit: { save: 'con', dc: 12, condition: 'poisoned', rounds: 3 } }],
    tactics: 'skirmish', traits: ['蜘蛛歩き：壁も天井も移動できる'],
    blurb: '天井の糸が、さっきより低い位置にある。',
  },
  bandit: {
    id: 'bandit', name: '野盗', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 12, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    attacks: [{ name: 'シミター', bonus: 3, damage: '1d6+1', type: '斬撃' }],
    tactics: 'skirmish', blurb: '金さえ置いていけば見逃す、と言っている。たぶん嘘だ。',
  },
  banditCaptain: {
    id: 'banditCaptain', name: '野盗の頭', kind: '人型', cr: 2, xp: 450,
    acOverride: 15, hp: '10d8', hpAvg: 45, speed: 9,
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    attacks: [
      { name: 'シミター', bonus: 5, damage: '1d6+3', type: '斬撃' },
      { name: '投げ短剣', bonus: 5, damage: '1d4+3', type: '刺突', ranged: true },
    ],
    tactics: 'brute', blurb: '交渉に応じる程度には賢い。裏切る程度にも賢い。',
  },
  shadow: {
    id: 'shadow', name: '影', kind: '不死', cr: 0.5, xp: 100,
    acOverride: 12, hp: '3d8+3', hpAvg: 16, speed: 12,
    abilities: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
    attacks: [{ name: '力を吸う手', bonus: 4, damage: '2d6+2', type: '死' }],
    resistances: ['斬撃', '刺突'], immunities: ['毒'],
    tactics: 'skirmish', traits: ['光への弱さ：明るい場所では攻撃に不利'],
    blurb: '壁の染みが動いた、と思ったときにはもう近い。',
  },
  ogre: {
    id: 'ogre', name: 'オーガ', kind: '巨人', cr: 2, xp: 450,
    acOverride: 11, hp: '7d10+21', hpAvg: 59, speed: 12,
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    attacks: [{ name: '大棍棒', bonus: 6, damage: '2d8+4', type: '打撃' }],
    tactics: 'brute', blurb: '一撃が重い。当たらなければ問題ない。',
  },
  ratSwarm: {
    id: 'ratSwarm', name: '鼠の群れ', kind: '獣', cr: 0.25, xp: 50,
    acOverride: 10, hp: '5d8', hpAvg: 24, speed: 9,
    abilities: { str: 9, dex: 11, con: 11, int: 2, wis: 10, cha: 3 },
    attacks: [{ name: '無数の牙', bonus: 2, damage: '2d6', type: '刺突' }],
    resistances: ['斬撃', '刺突'],
    tactics: 'brute', blurb: '床が波打っている。床ではない。',
  },
  guard: {
    id: 'guard', name: '衛兵', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 16, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: '長槍', bonus: 3, damage: '1d8+1', type: '刺突' }],
    tactics: 'brute', blurb: '仕事でやっている。死ぬ気はない。',
  },
};

export const monsterById = id => MONSTERS[id] || null;

/** Rough encounter budget: sum of XP scaled by party size. */
export function encounterDifficulty(monsterIds, partyLevel = 1, partySize = 1) {
  const xp = monsterIds.reduce((s, id) => s + (monsterById(id)?.xp || 0), 0);
  const multiplier = monsterIds.length >= 5 ? 2 : monsterIds.length >= 3 ? 1.5 : monsterIds.length === 2 ? 1.25 : 1;
  const adjusted = xp * multiplier;
  const budgetPerChar = { 1: 25, 2: 50, 3: 75, 4: 125, 5: 250 }[Math.min(5, partyLevel)] || 250;
  const easy = budgetPerChar * partySize;
  if (adjusted <= easy) return { level: 'easy', name: '楽勝', xp, adjusted };
  if (adjusted <= easy * 2) return { level: 'medium', name: '手応えあり', xp, adjusted };
  if (adjusted <= easy * 3) return { level: 'hard', name: '苦戦', xp, adjusted };
  return { level: 'deadly', name: '致命的', xp, adjusted };
}
