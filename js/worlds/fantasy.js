/* 世界観「灯火のテーブル」— 剣と魔法のファンタジー。

   純粋なデータだけを置く。ルールの計算は core/ が行い、この層は
   「何が存在するか」だけを決める。別の世界観を足すときは、同じ形の
   オブジェクトを作って js/worlds/index.js に登録すればいい。 */

/* --------------------------------------------------------------- 能力値 */

const ABILITIES = [
  { id: 'str', name: '筋力', short: '筋', desc: '力任せの行動、近接攻撃、荷物' },
  { id: 'dex', name: '敏捷', short: '敏', desc: '回避、隠密、手先、射撃' },
  { id: 'con', name: '耐久', short: '耐', desc: '体力、毒や疲労への抵抗' },
  { id: 'int', name: '知力', short: '知', desc: '知識、推理、魔術の理論' },
  { id: 'wis', name: '判断', short: '判', desc: '観察、直感、信仰、意志' },
  { id: 'cha', name: '魅力', short: '魅', desc: '説得、威圧、演技、交渉' },
];

/* ----------------------------------------------------------------- 技能 */

const SKILLS = [
  {
    id: 'athletics', name: '運動', ability: 'str',
    desc: '登る、泳ぐ、押し破る',
    example: '扉を体当たりで開ける。崖をよじ登る。組みついた相手を振りほどく',
  },
  {
    id: 'acrobatics', name: '軽業', ability: 'dex',
    desc: '倒れずに、狭いところを',
    example: '足場を渡る。転んだ姿勢から素早く立つ。囲みをすり抜ける',
  },
  {
    id: 'stealth', name: '隠密', ability: 'dex',
    desc: '見つからずに動く',
    example: '物陰を選ぶ。足音を殺す。見張りの視線が切れる間合いを読む',
  },
  {
    id: 'sleight', name: '手先の早業', ability: 'dex',
    desc: '指先で誤魔化す',
    example: '掏る。仕込む。鍵を開ける。相手の目の前で何かを隠す',
  },
  {
    id: 'arcana', name: '魔法学', ability: 'int',
    desc: '魔法のことを知っている',
    example: '呪文の痕跡を読む。魔法の品を見分ける。結界の綻びに気づく',
  },
  {
    id: 'history', name: '歴史', ability: 'int',
    desc: '昔あったことを覚えている',
    example: '紋章の持ち主。廃墟が誰のものだったか。その戦がいつ終わったか',
  },
  {
    id: 'investigation', name: '捜査', ability: 'int',
    desc: '物から筋道を立てる',
    example: '現場を読む。書類の矛盾に気づく。隠し扉のありかを推理する',
  },
  {
    id: 'nature', name: '自然', ability: 'int',
    desc: '森と天気と獣を読む',
    example: '空模様から雨の刻を読む。食える草を選ぶ。足跡の主を当てる',
  },
  {
    id: 'religion', name: '宗教', ability: 'int',
    desc: '信仰と、その裏側',
    example: '儀式の意味。聖印の出どころ。不死のものが嫌うもの',
  },
  {
    id: 'perception', name: '知覚', ability: 'wis',
    desc: '気づく',
    example: '物音。匂い。人の顔色。何かが「さっきと違う」こと',
  },
  {
    id: 'insight', name: '看破', ability: 'wis',
    desc: '人の腹を読む',
    example: '嘘を見抜く。言い淀みの理由を察する。本当に困っている人を見分ける',
  },
  {
    id: 'medicine', name: '医術', ability: 'wis',
    desc: '傷と病を診る',
    example: '止血する。死因を見立てる。毒か病かを見分ける',
  },
  {
    id: 'survival', name: '生存', ability: 'wis',
    desc: '野で生きる',
    example: '道を見つける。追跡する。火を熾す。夜を越す場所を選ぶ',
  },
  {
    id: 'animal', name: '動物使い', ability: 'wis',
    desc: '獣と渡り合う',
    example: '馬を落ち着かせる。番犬をなだめる。獣の機嫌を読む',
  },
  {
    id: 'persuasion', name: '説得', ability: 'cha',
    desc: '筋を通して頼む',
    example: '交渉する。仲裁する。相手にとっての得を示す',
  },
  {
    id: 'deception', name: '欺瞞', ability: 'cha',
    desc: '信じさせる',
    example: '身分を騙る。話を逸らす。動じていないふりをする',
  },
  {
    id: 'intimidation', name: '威圧', ability: 'cha',
    desc: '引かせる',
    example: '凄む。事実を突きつける。相手に「割に合わない」と思わせる',
  },
  {
    id: 'performance', name: '芸能', ability: 'cha',
    desc: '人を惹きつける',
    example: '歌う。語る。場の空気を持っていく。時間を稼ぐ',
  },
];

const ANCESTRIES = [
  {
    id: 'human', name: '人間', blurb: '順応性が高く、どんな道でも並以上に歩ける。',
    life: { adult: 16, typical: 65, oldest: 90,
      note: '短い。だから急ぐ。この地方で「一代で成した」と言えば、たいてい二十年ほどの話だ。' },
    bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 9,
    traits: [{ id: 'versatile', text: '多才：技能をもう1つ習得する' }],
  },
  {
    id: 'elf', name: 'エルフ', blurb: '森と星の民。感覚が鋭く、魅了を寄せつけない。',
    life: { adult: 30, typical: 350, oldest: 520,
      note: '人の村に長く住むエルフは少ない。知り合いが先に死ぬからで、嫌っているわけではない。' },
    bonus: { dex: 2, wis: 1 }, speed: 10.5,
    traits: [
      { id: 'keenSenses', text: '鋭敏な感覚：【知覚】を習得' },
      { id: 'feyBlood', text: '妖精の血：魅了に免疫、魅了へのセーヴに有利' },
      { id: 'darkvision', text: '夜目：暗がりでも見える' },
    ],
    grantSkills: ['perception'], keywords: ['darkvision', 'charm-resist'],
  },
  {
    id: 'dwarf', name: 'ドワーフ', blurb: '岩の下で鍛えられた頑健な工人。',
    life: { adult: 25, typical: 240, oldest: 350,
      note: '天寿なら240年。ただし坑道の事故で早く死ぬ者が多く、実際に葬られる歳の平均は180に届かない。' },
    bonus: { con: 2, str: 1 }, speed: 7.5,
    traits: [
      { id: 'stoutFolk', text: '頑健：毒セーヴに有利、最大HP +1/レベル' },
      { id: 'stoneCunning', text: '石工の目：【調査】に有利' },
      { id: 'darkvision', text: '夜目：暗がりでも見える' },
    ],
    hpPerLevel: 1, keywords: ['darkvision', 'poison-resist'],
  },
  {
    id: 'halfling', name: 'ハーフリング', blurb: '小柄で運が良い。誰よりも先に危険を嗅ぎつける。',
    life: { adult: 20, typical: 110, oldest: 150,
      note: '人間の倍を生きるので、同じ村に三代ぶんの記憶が残る。揉め事の証人にされやすい。' },
    bonus: { dex: 2, cha: 1 }, speed: 7.5,
    traits: [
      { id: 'lucky', text: '幸運：出目1を休憩ごとに1度だけ振り直せる' },
      { id: 'nimble', text: '身軽：【体術】に有利' },
    ],
    keywords: ['lucky'],
  },
  {
    id: 'dragonborn', name: '竜血', blurb: '古竜の血を継ぎ、喉の奥に炎を宿す。',
    life: { adult: 15, typical: 80, oldest: 100,
      note: '育つのが速く、十五で背が止まる。人間とほぼ同じ長さを、はじめから大人として過ごす。' },
    bonus: { str: 2, cha: 1 }, speed: 9,
    traits: [
      { id: 'dragonBreath', text: '竜の吐息：敵全体に2d6の火（休憩ごとに1回、反応セーヴで半減）' },
      { id: 'dragonScales', text: '竜鱗：火ダメージ半減' },
    ],
    keywords: ['breath-weapon'],
  },
  {
    id: 'tiefling', name: '魔筋', blurb: '遠い昔に交わった異界の血。影と炎に好かれる。',
    life: { adult: 18, typical: 100, oldest: 145,
      note: '人間よりやや長い。それだけのことなのだが、村では「歳を取らない」と言われる。' },
    bonus: { cha: 2, int: 1 }, speed: 9,
    traits: [
      { id: 'hellishResilience', text: '地獄の抵抗：火ダメージ半減' },
      { id: 'darkvision', text: '闇の知恵：暗がりで見える' },
    ],
    resistances: ['火'], keywords: ['darkvision'],
  },
];

/* ---------------------------------------------------------------- classes */

const CLASSES = [
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

/* ------------------------------------------------------------ backgrounds */

const BACKGROUNDS = [
  { id: 'soldier', name: '元兵士', skills: ['athletics', 'intimidation'], gear: ['軍の記章', '賽子一組'], blurb: '国境の砦で数年。命令には慣れているが、もう聞く気はない。' },
  { id: 'scholar', name: '学院崩れ', skills: ['arcana', 'history'], gear: ['書きかけの手記', 'インク壺'], blurb: '学位を取る前に追い出された。理由は本人だけが知っている。' },
  { id: 'thief', name: '路地育ち', skills: ['stealth', 'deception'], gear: ['盗品の指輪', '鍵開け道具'], blurb: '街の裏側の地図なら頭に入っている。' },
  { id: 'acolyte', name: '寺院育ち', skills: ['religion', 'insight'], gear: ['聖印', '祈祷書'], blurb: '信仰は残っているが、教団への忠誠は残っていない。' },
  { id: 'hunter', name: '罠猟師', skills: ['survival', 'animal'], gear: ['罠一式', '毛皮の外套'], blurb: '森の静けさの読み方を知っている。' },
  { id: 'merchant', name: '行商人', skills: ['persuasion', 'investigation'], gear: ['帳簿', '天秤'], blurb: '値段のつかないものにも値段をつける癖がある。' },
  { id: 'performer', name: '旅芸人', skills: ['performance', 'acrobatics'], gear: ['竪琴', '派手な衣装'], blurb: '拍手で食っていた。今は別の稼ぎ方を探している。' },
];

/* ------------------------------------------------------------------ gear */

const WEAPONS = {
  longsword: { id: 'longsword', cost: 15, name: 'ロングソード', damage: '1d8', type: '斬撃', ability: 'str', tags: ['近接'] },
  shortsword: { id: 'shortsword', cost: 10, name: 'ショートソード', damage: '1d6', type: '刺突', ability: 'dex', tags: ['近接', '軽量'] },
  greataxe: { id: 'greataxe', cost: 30, name: 'グレートアクス', damage: '1d12', type: '斬撃', ability: 'str', tags: ['近接', '両手'] },
  mace: { id: 'mace', cost: 5, name: 'メイス', damage: '1d6', type: '打撃', ability: 'str', tags: ['近接'] },
  dagger: { id: 'dagger', cost: 2, name: 'ダガー', damage: '1d4', type: '刺突', ability: 'dex', tags: ['近接', '軽量', '投擲'] },
  staff: { id: 'staff', cost: 1, name: 'クォータースタッフ', damage: '1d6', type: '打撃', ability: 'str', tags: ['近接'] },
  spear: { id: 'spear', cost: 1, name: 'スピア', damage: '1d6', type: '刺突', ability: 'str', tags: ['近接', 'リーチ'] },
  shortbow: { id: 'shortbow', cost: 25, name: 'ショートボウ', damage: '1d6', type: '刺突', ability: 'dex', tags: ['遠隔'], ranged: true },
  longbow: { id: 'longbow', cost: 50, name: 'ロングボウ', damage: '1d8', type: '刺突', ability: 'dex', tags: ['遠隔', '両手'], ranged: true },
  crossbow: { id: 'crossbow', cost: 25, name: 'クロスボウ', damage: '1d8', type: '刺突', ability: 'dex', tags: ['遠隔'], ranged: true },
  sling: { id: 'sling', cost: 1, name: 'スリング', damage: '1d4', type: '打撃', ability: 'dex', tags: ['遠隔'], ranged: true },
  unarmed: { id: 'unarmed', cost: 0, name: '素手', damage: '1d2', type: '打撃', ability: 'str', tags: ['近接'] },
};

const ARMORS = {
  leather: { id: 'leather', cost: 10, name: 'レザーアーマー', base: 11, maxDex: undefined, stealth: 0 },
  studded: { id: 'studded', cost: 45, name: 'スタッデッドレザー', base: 12, maxDex: undefined, stealth: 0 },
  hide: { id: 'hide', cost: 10, name: 'ハイドアーマー', base: 12, maxDex: 2, stealth: 0 },
  chain: { id: 'chain', cost: 50, name: 'チェインシャツ', base: 13, maxDex: 2, stealth: 0 },
  breastplate: { id: 'breastplate', cost: 250, name: 'ブレストプレート', base: 14, maxDex: 2, stealth: 0 },
  plate: { id: 'plate', cost: 600, name: 'プレートアーマー', base: 18, maxDex: 0, stealth: -2 },
};

const SHIELD = { id: 'shield', name: 'シールド', ac: 2, cost: 10 };

const ITEMS = {
  potion: { id: 'potion', cost: 12, name: '治癒の薬', use: 'heal', amount: '2d4+2', desc: '飲むと 2d4+2 回復する。', consumable: true },
  greaterPotion: { id: 'greaterPotion', cost: 40, name: '上級治癒薬', use: 'heal', amount: '4d4+4', desc: '飲むと 4d4+4 回復する。', consumable: true },
  antidote: { id: 'antidote', cost: 10, name: '解毒薬', use: 'cure', cures: ['poisoned'], desc: '毒状態を取り除く。', consumable: true },
  bomb: { id: 'bomb', cost: 8, name: '発火瓶', use: 'damage', amount: '2d6', type: '火', area: true, desc: '投げつけて 2d6 の火ダメージ（範囲）。', consumable: true },
  rope: { id: 'rope', cost: 3, name: '麻縄（15m）', desc: '登攀や拘束に使う。' },
  torch: { id: 'torch', cost: 1, name: '松明', desc: '暗所を照らす。手が1つ塞がる。', light: true },
  lockpicks: { id: 'lockpicks', cost: 8, name: '鍵開け道具', desc: '錠前を開ける判定に必要。' },
  rations: { id: 'rations', cost: 3, name: '携行食（3日分）', desc: '野営に使う。' },
  holySymbol: { id: 'holySymbol', cost: 5, name: '聖印', desc: '神聖呪文の焦点具。' },
  spellbook: { id: 'spellbook', cost: 25, name: '呪文書', desc: '秘術呪文の焦点具。' },
};

/* ---------------------------------------------------------------- spells */

/* effect.kind:
     damage  — roll `damage`; `save` lets the target halve or negate it
     heal    — restore `amount`
     condition — apply `condition` for `rounds` (save negates when set)
     buff    — apply a helpful condition to an ally or self
     utility — narrative only; the scenario decides what it unlocks       */

const SPELLS = {
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

/* Spells a class can learn, by class id. */
const CLASS_SPELLS = {
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

const MONSTERS = {
  goblin: {
    id: 'goblin', name: 'ゴブリン', kind: '人型', cr: 0.25, xp: 50,
    acOverride: 15, hp: '2d6+2', hpAvg: 9, speed: 9,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [{ name: '錆びた短刀', bonus: 4, damage: '1d6+2', type: '刺突' }],
    tactics: 'skirmish',
    traits: [{ id: 'cowardly', text: '臆病：半数が倒れ、自分も傷つくと逃げ出す' }],
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
    tactics: 'brute',
    traits: [{ id: 'rally', text: '号令：この者が立っているあいだ、味方の攻撃は有利' }],
    blurb: '略奪品の胸当てを着けた、群れで一番大きな個体。',
  },
  wolf: {
    id: 'wolf', name: '狼', kind: '獣', cr: 0.25, xp: 50,
    acOverride: 13, hp: '2d8+2', hpAvg: 11, speed: 12,
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: '噛みつき', bonus: 4, damage: '2d4+2', type: '刺突', onHit: { save: 'str', dc: 11, condition: 'prone' } }],
    tactics: 'brute',
    traits: [{ id: 'pack', text: '群れ戦術：仲間が生きているあいだ攻撃に有利' }],
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
    tactics: 'brute',
    traits: [{ id: 'undeadFortitude', text: '不死の頑健さ：0HPになったとき耐久セーヴDC10で1HP残る' }],
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
    tactics: 'caster',
    traits: [{ id: 'wardOnce', text: '闇の加護：1度だけ、受けたダメージを半分にする' }],
    blurb: '灯りを背にして立つと、影が人の形をしていない。',
  },
  giantSpider: {
    id: 'giantSpider', name: '大蜘蛛', kind: '獣', cr: 1, xp: 200,
    acOverride: 14, hp: '4d10+4', hpAvg: 26, speed: 9,
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    attacks: [{ name: '毒牙', bonus: 5, damage: '1d8+3', type: '毒', onHit: { save: 'con', dc: 12, condition: 'poisoned', rounds: 3 } }],
    tactics: 'skirmish',
    traits: [{ id: 'spiderClimb', text: '蜘蛛歩き：壁も天井も移動できる' }],
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
    tactics: 'skirmish',
    traits: [{ id: 'lightSensitive', text: '光への弱さ：相手が灯りを持っていると攻撃に不利' }],
    blurb: '壁の染みが動いた、と思ったときにはもう近い。',
  },
  ogre: {
    id: 'ogre', name: 'オーガ', kind: '巨人', cr: 2, xp: 450,
    acOverride: 11, hp: '7d10+21', hpAvg: 59, speed: 12,
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    attacks: [{ name: '大棍棒', bonus: 6, damage: '2d8+4', type: '打撃' }],
    tactics: 'brute', blurb: '一撃が重い。当たらなければ問題ない。',
  },
  /* 群れは「一体で体力の多い塊」ではなく、頭数で出す。どれから倒すかを
     選べることと、倒すたびに手数が減っていく手応えが、群れの面白さだから。
     一体にまとめてよいのは、個体を狙う意味が無いもの（蟲の群れなど）だけ。 */
  direRat: {
    id: 'direRat', name: '大鼠', kind: '獣', cr: 0.125, xp: 25,
    acOverride: 12, hp: '2d6', hpAvg: 7, speed: 9,
    abilities: { str: 10, dex: 13, con: 11, int: 2, wis: 10, cha: 3 },
    attacks: [{ name: '前歯', bonus: 3, damage: '1d4+1', type: '刺突' }],
    tactics: 'brute',
    traits: [{ id: 'cowardly', text: '臆病：半数が倒れ、自分も傷つくと逃げ出す' }],
    blurb: '犬ほどの大きさがある。噛まれれば、それだけで済む話ではない。',
  },
  guard: {
    id: 'guard', name: '衛兵', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 16, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: '長槍', bonus: 3, damage: '1d8+1', type: '刺突' }],
    tactics: 'brute', blurb: '仕事でやっている。死ぬ気はない。',
  },
};

/* ------------------------------------------------------------------ 世界 */


/* ------------------------------------------------------------- 読み物 */

/* 数値を持たない層。遊びの役に立つ順に並べてある——まず世界の輪郭、
   次に「行ける場所」、その次に「怒らせると面倒な相手」。
   表はソロでも卓でも振れる。答えを決めずに、次の一手だけを出す。 */

const LORE = {
  primer: [
    'この地方をひとことで言うなら、**灯りの届く範囲だけが人の側の土地**だ。',
    'ここで言う「人」に、人間だけでなくエルフもドワーフもハーフリングも入る。' +
    '種族の違いは村の中では話題になるが、日が落ちてからは意味を失う——' +
    '**外にいるものから見れば、灯りを持って歩く者はみな同じに見える**。',
    '街道は昼のうちだけ安全で、日が落ちれば狼と、狼でないものの領分になる。' +
    '村と村のあいだは半日から二日。その途中には何もない。だから旅人は灯りを持ち、宿を数えて歩く。',
    '王はいる。遠くにいる。税を取りに来る者と、徴兵に来る者の顔しか、ほとんどの人間は知らない。' +
    '実際に村を守っているのは、村の柵と、鐘と、そして金で雇われた誰かだ。',
    '**鐘は魔除けである**というのが、この地方でいちばん広く信じられていることだ。' +
    '澄んだ音は不死のものを嫌わせる。だから村には必ず鐘があり、鐘が鳴らない村は、それだけで異常なのだ。',
    '魔法は存在するが、稀で、高い。学院で学べば使えるが、学院は三つしかなく、どれも遠い。' +
    '村人にとって魔術師は「話に聞く職業」であって、実際に見たことがある者はほとんどいない。',
  ],

  places: [
    { name: 'ヴェルナ村', blurb: '麦と羊。鐘楼は村でいちばん高い建物で、司祭が鍵を持っている。三日前から鐘が鳴らない。' },
    { name: 'ケルン', blurb: '峠の向こうの鉱山町。冬は四ヶ月閉じる。閉じているあいだに流行り病が出ると、春まで誰も助けに来ない。' },
    { name: '灰の街道', blurb: '王都と南をつなぐ唯一の舗装路。二十年前の火事で並木が焼け、今も黒い切り株が等間隔に残っている。' },
    { name: '三本の麦', blurb: 'ヴェルナ村の宿。麦酒は薄いが、この地方の噂はすべてここを通る。主人は耳がいい。' },
    { name: '巡礼路', blurb: '山を越える古い石畳。道端に等間隔で石像が立っている。誰を象ったものかは、もう誰も知らない。' },
    { name: '沈んだ湾', blurb: '月に一度の大干潮の日だけ、海底に船の骨が現れる。三時間で沈む。漁師は近寄らない。' },
    { name: '学院（南）', blurb: '三つある魔術学院のひとつ。入るのに推薦が要り、出るのに借金が要る。' },
    { name: '名もなき森', blurb: '北の森。地図には「森」としか書かれていない。書き込むほど詳しく調べた者がいないからだ。' },
  ],

  factions: [
    {
      name: '街道守備隊',
      blurb: '王が置いた常備兵。人数が足りていない。街道の見回りはするが、街道から一歩外れたことには関与しない。' +
        '「管轄外です」が口癖で、本人たちもそれを恥じている。',
      stance: '商隊組合とは持ちつ持たれつ。灯火の兄弟団を「素人が出しゃばる」と嫌っている。',
    },
    {
      name: '灯火の兄弟団',
      blurb: '寺院に属さない巡回の司祭たち。村から村へ歩き、鐘を直し、死者を埋める。' +
        '報酬は宿と食事だけ。組織というより、同じことをしている人間の集まりに近い。',
      stance: '寺院とは距離がある。破門された者が流れ着く先でもあるからだ。静かなる環を唯一まともに追っている。',
    },
    {
      name: '商隊組合',
      blurb: 'この地方で唯一、金と情報が集まる場所。護衛を雇う側であり、依頼を出す側でもある。' +
        '組合証があれば、どの村でも一晩は泊まれる。取り上げられると、どこにも泊まれない。',
      stance: '守備隊に金を出して街道を維持させている。峠の隠者への通行料も、経費として黙認している。',
    },
    {
      name: '静かなる環',
      blurb: '名前を持たない教団。灰色の服。人が消える場所には、たいてい後から名前が出てくる。' +
        '信徒は自分が信徒だと思っていないことがある。それがこの教団のやり方だ。',
      stance: 'どの勢力とも敵対しない。敵対する前に、相手の内側にいる。',
    },
    {
      name: '峠の隠者たち',
      blurb: '山に一人ずつ住んでいる者たち。互いに面識はない。追い剥ぎではないが、通行料は取る。' +
        '払えば道を教え、天気を読み、時には薬をくれる。',
      stance: '誰にも属さない。ただし冬を越せなかった隠者の道は、翌年から誰も通れなくなる。',
    },
  ],

  figures: [
    { name: 'ハルヴァ司祭', title: 'ヴェルナ村の司祭', blurb: '二十二年この村にいる。最近よく笑うようになった、と村人が言う。以前は笑わない人だった。' },
    { name: '宿の女将ミナ', title: '「三本の麦」の主人', blurb: '誰の話も聞き、誰の話もしない。ただし相手が正しく訊けば、正しく答える。' },
    { name: '隊長ドロス', title: '街道守備隊', blurb: '街道の外に出たがらない。臆病だからではなく、一度出て、部下を四人失ったからだ。' },
    { name: '荷主ヤナ', title: '商隊組合', blurb: '去年、峠が閉じて弟を亡くした。以来、自分の荷には必ず自分が付いていく。' },
    { name: '灰の男', title: '——', blurb: '灰色の服。名前を名乗ったことがない。会った人間の証言はどれも一致しない。背丈すら。' },
  ],

  names: {
    given: [
      'アルド', 'ミラ', 'ケイン', 'セラ', 'ドラン', 'ユナ', 'ガレス', 'ニケ', 'イレーヌ', 'ボルド',
      'テオ', 'リサ', 'ハウル', 'エマ', 'ヴィク', 'ノラ', 'ルーカ', 'アイナ', 'グレン', 'シーナ',
      'ハルヴァ', 'ヤナ', 'ミナ', 'ドロス', 'オルグ', 'ティナ',
    ],
    /* 姓は身分なので、村人の名簿には入れない。名乗れる者は truths のとおり。 */
    family: [],
    /* 代わりに使われる呼び方。「どこの」「何屋の」で一人を指す。 */
    bynames: [
      'ヴェルナ', 'ケルン', '灰の街道', '粉屋', '鍛冶', '宿', '鐘楼', '名もなき森',
      '峠', '荷馬車', '羊飼い', '船大工', '皮なめし', '井戸端', '墓守', '灯火',
    ],
  },


  /* 年表。物語の背景として使う。日付より「何が変わったか」が大事なので、
     年は現在からの逆算で書いてある。 */
  timeline: [
    { when: '約200年前', what: '大森林戦争。北の森を焼き払おうとして失敗し、以後この地方は森に手を出さなくなった。' },
    { when: '約80年前', what: '王国が街道を敷く。宿場と鐘楼が同じ規格で建てられ、鐘が魔除けとして定着したのもこの頃。' },
    { when: '約40年前', what: '大寺院の分裂。教義をめぐって割れ、片方が「灯火の兄弟団」として組織を出た。' },
    { when: '20年前', what: '灰の街道の大火。並木が焼け、隊商が三つ焼けた。原因は今も公式には「落雷」。' },
    { when: '11年前', what: '南の学院で事故。学生が七人死に、以後この地方で魔術を学ぶ者が激減した。' },
    { when: '3年前', what: '人が消える事件が北から順に始まる。数は少なく、村ごとに一人か二人。まだ誰も繋げて考えていない。' },
    { when: '今年', what: 'ヴェルナ村の鐘が鳴らなくなって三日目。' },
  ],

  /* 世界の決まりごと。「何ができないか」を先に決めておくと、シナリオも
     プレイヤーの発想も締まる。ここは能力の一覧ではなく、物語の物理法則。 */
  truths: [
    { title: '灯りは境界である', text: '灯りの中は人の領分、外はそうでない。不死のものは灯りを嫌うが、灯りを消すことはできない。息を吹きかけるにも、肺が要るからだ。' },
    { title: '鐘は本当に効く', text: '澄んだ金属音は不死のものを怯ませる。これは迷信ではなく観察された事実で、だからこそ「鐘が鳴らない」ことが恐ろしい。' },
    { title: '魔法は稀で、高く、遅い', text: '学院は三つしかなく、卒業までに十年と借金がかかる。旅の一行に魔術師が一人いるのは、この地方では珍しいことだ。' },
    { title: '死者は戻らない。戻ってきたものは、その人ではない', text: '蘇生の魔法は伝説の領域にある。埋葬を丁寧にするのは弔いのためであり、同時に予防でもある。' },
    { title: '法は村ごとにある', text: '王の法は文書としては存在するが、執行するのは村長か、村長が雇った誰かだ。旅人が裁かれるとき、証人は現地の人間しかいない。' },
    /* シナリオを書く人から「この世界に文字（イニシャル）はあるのか」と
       訊かれて決めたもの。刺繍の頭文字を手がかりにする話が書きたい、が発端。
       あると答えるだけでは足りない——誰が読めるのかまで決めないと、
       「手紙を拾った」の重みが場面ごとに変わってしまう。 */
    {
      title: '文字は読めないほうがふつう',
      text: 'この地方で使うのは**王国文字**、街道と一緒に広まった二十四字だ。'
        + 'ただし村で読める大人は司祭と、宿の主人と、徴税吏くらい。数は別で、市に出る者ならたいてい数えられる。'
        + 'だから証文は文ではなく**印と証人**で成り立ち、手紙は「読んでもらうもの」だ——'
        + '書いた時点で、代筆屋と読み手にも中身が知られている。'
        + '布や道具に頭文字を縫うのは、読めない者どうしが持ち主を見分けるための印で、これは文字というより形として通じる。'
        + 'なお巡礼路の石像に彫られているのは王国文字ではない。読める者はいない。',
    },
    /* 「灯火世界に苗字って概念はありますか？」から。無いと答えるより、
       誰が持っていて誰が持っていないかを決めたほうが、場面がひとつ増える。
       文字が読めないこと・証文が印と証人で成り立つことと、同じ根から出ている。 */
    {
      title: '姓は身分である',
      text: '大半の人間は姓を持たない。名前と「どこの誰か」で足りるからだ——**粉屋のミラ、ヴェルナのガレス**。'
        + '姓を名乗れるのは、**貴族・商隊組合に登録した商人・寺院に叙任された聖職者・学院を出た者**の四種類で、'
        + 'どれも「どこかの帳面に書かれている」という一点で共通している。'
        + 'だから旅人が姓を名乗ると、村では二つのことが同時に伝わる——**後ろ盾があること**と、'
        + '**調べれば足がつくこと**。姓を捨てて名前だけで歩いている者は、たいていそのどちらかを嫌っている。',
    },
    { title: '距離は日数で測る', text: '村から村へ半日から二日。地図はあるが縮尺は当てにならない。「二日」と言われたら、二晩野宿する用意をする。' },
    { title: '冬は世界を切り分ける', text: '峠は四ヶ月閉じる——**霜の月から雪解けの月まで**。閉じているあいだ、向こう側で何が起きても手が届かない。それを知った上で、人は冬の前に急ぐ。' },
  ],

  /* 暦。「一年は何日か」「冬以外の季節はあるのか」は、遊んでいると必ず訊かれる。
     答えを決めていないと、書くたびに違う世界になってしまう。
     ここの数字は決まりごととして扱う——峠が四ヶ月閉じるのも、この暦の上での話。 */
  calendar: {
    name: '暦と季節',
    blurb: '**一年は365日**。三十日の月が十二、そこに**どの月にも属さない五日**が加わる。'
      + '季節は四つあり、月が三つずつ入る。年は雪解けの月の一日に始まる。'
      + '村では十日ごとに市が立ち、人は日付ではなく「次の市まであと何日」で数えている。',
    seasons: [
      {
        name: '春', months: ['雪解けの月', '種蒔きの月', '若葉の月'],
        note: '道がぬかるむ。峠は雪解けの月のあいだまだ閉じていて、種蒔きの月に入ってようやく人が通る。'
          + '冬を越せなかった隠者がいたかどうかは、この時期に分かる。',
      },
      {
        name: '夏', months: ['刈り草の月', '長日の月', '雷の月'],
        note: '陽が長く、日没が遅い。旅がいちばん楽な季節で、街道の往来もこの三ヶ月に集中する。'
          + '雷の月は雨が多く、川が増える。',
      },
      {
        name: '秋', months: ['実りの月', '収穫の月', '落葉の月'],
        note: '収穫と税と、徴兵の季節。金が動くので依頼も増える。'
          + '同時に、冬の前に片をつけたい厄介ごとが一斉に持ち込まれる時期でもある。',
      },
      {
        name: '冬', months: ['霜の月', '長夜の月', '閉ざしの月'],
        note: '夜が長い。**霜の月に峠が閉じ、翌年の雪解けの月まで開かない**——冬の三ヶ月と春の一ヶ月で、締めて四ヶ月。'
          + '村は自分たちだけで越冬する。長夜の月には日没が早く、灯りを持つ時間がその分長くなる。',
      },
    ],
    /* 年の終わりの五日。祭りであり、同時に「鐘が本当に効く」ことの確認でもある。 */
    extra: {
      name: '灯の五日',
      note: '閉ざしの月の後、年の変わり目に置かれる五日。どの月にも数えない。'
        + '毎晩ひとつずつ灯りを増やし、五日目に鐘を五度鳴らして、その年に死んだ者の名を読み上げる。'
        + 'この五日のあいだ、契約は結べないことになっている——「無い日」に交わした約束は無効だからだ。',
    },
    hint: '物語はたいてい実りの月から霜の月のあいだに始まる。冬が来る前に片をつけたいからだ。',
  },

  /* 物価。数字そのものより「一日いくらで生きているか」が伝わることが大事。 */
  economy: {
    unit: '銀貨',
    note: '銀貨1枚で一食。駆け出しの依頼が5枚、まともな護衛で30枚。'
      + 'プレートアーマーが600枚なのは、買えないことに意味があるからだ。',
    anchors: [
      { what: '宿の相部屋（一泊、食事つき）', cost: 1 },
      { what: '宿の個室（一泊）', cost: 3 },
      { what: '一食', cost: 1 },
      { what: '荷馬車を一日雇う', cost: 5 },
      { what: '職人の日当', cost: 2 },
      { what: '駆け出しの依頼', cost: 5 },
      { what: '護衛の相場（片道）', cost: 20 },
      { what: '治癒の薬', cost: 12 },
      { what: '一年の暮らし（つましく）', cost: 400 },
    ],
  },

  tables: [
    {
      id: 'rumor', name: '宿で聞く噂', hint: '真偽は半々。半分は本当だから厄介なのだ。',
      entries: [
        '北の森で、木こりが三人立て続けに戻らない。四人目は行こうとしない。',
        '灰色の服の男が、先週この村を通った。何も買わずに一晩泊まって出ていった。',
        '街道守備隊が二週間来ていない。前は十日に一度は来ていた。',
        '峠の隠者が死んだらしい。誰が言い出したのかは分からない。',
        '沈んだ湾の次の大干潮は、あと九日だ。',
        '学院を追われた男が、南の村で薬を売っている。効く、という話だ。',
        '夜中に鐘が鳴った村がある。鐘楼には誰もいなかった。',
        '商隊が一つ、丸ごと消えた。荷馬車は見つかった。荷も載ったままで。',
        '王都で税が上がる。次の徴収は今年のうちに来る。',
        '井戸の水が塩辛くなった村がある。海から三日の距離だ。',
        '狼が群れを作らなくなった。一匹で歩いている。それは狼のすることではない。',
        '寺院が誰かを破門した。理由は公表されていない。',
      ],
    },
    {
      id: 'road', name: '街道で出会うもの', hint: '移動の途中に一つ振る。戦闘とは限らない。',
      entries: [
        '荷車が横倒しになっている。人はいない。荷はそのまま。',
        '巡回の司祭が一人。水を分けてくれと言う。持っていれば、噂を一つくれる。',
        '道の真ん中に石が積まれている。三段。誰かの目印だ。',
        '雨が来る。半刻後に本降りになる。近くに雨宿りできる場所は一つしかない。',
        '前方で犬が吠えている。姿は見えない。吠え方が、犬にしては規則正しい。',
        '徴税吏の一行とすれ違う。護衛が四人。目を合わせない方がいい。',
        '女が一人で歩いている。次の村まで二日ある。荷物を持っていない。',
        '焼けた宿の跡。灰はまだ温かい。',
        '道端に新しい墓が三つ。名前が彫られているのは一つだけ。',
        '行商人が店を広げている。値は高いが、この先しばらく店はない。',
        '橋が落ちている。迂回すると半日、渡渉すると荷が濡れる。',
        '何もない。ただ、鳥が一羽も鳴いていない。',
      ],
    },
    {
      id: 'job', name: '掲示板の依頼', hint: '報酬は銀貨で。安すぎるものには理由がある。',
      entries: [
        '納屋に何かが住み着いた。追い出してほしい。銀貨5枚。',
        '峠が閉じる前に、薬を山向こうまで。銀貨30枚、荷主同行。',
        '娘が学院へ行く。護衛を一人。往路のみ。銀貨20枚。',
        '井戸に落ちたものを拾ってきてほしい。何かは言えない。銀貨15枚。',
        '狼を三頭。皮は持ち帰ってよい。銀貨12枚。',
        '弟が戻らない。探すだけでいい。見つからなくてもいい。銀貨8枚。',
        '祖父の墓を確かめてきてほしい。掘り返されていないかどうか。銀貨10枚。',
        '書簡を一通、隣の領まで。開けないこと。銀貨25枚。',
        '夜のあいだ、鐘楼に人がいてほしい。ただ座っているだけでいい。銀貨6枚。',
        '倉の鼠を減らしてほしい。数が普通ではない。銀貨5枚。',
      ],
    },
    {
      id: 'complication', name: '判定に失敗したときの余波', hint: '「失敗して何も起きない」を避けるための表。',
      entries: [
        '音が出た。誰かが振り向いた。まだ気づかれてはいない。',
        '道具が一つ壊れた。次に使うときまで気づかない。',
        '時間を食った。日が一段傾く。',
        '怪我をした。深くはないが、血が服に染みる。',
        '味方の一人が置いていかれた。追いつくまで一場面かかる。',
        '見られた。相手が誰かは分からない。',
        '正しい道を選んだつもりで、二度目の分かれ道に戻ってきてしまった。',
        '持ち物を一つ落とした。どこで落としたかは分からない。',
      ],
    },
    {
      id: 'omen', name: '不吉の兆し', hint: '不死や教団が絡む場面の前触れに。',
      entries: [
        '鐘が半拍だけ遅れて鳴った。',
        '犬が家の中を向いて吠えている。',
        '水面に映る自分の背後に、誰もいないのに影がある。',
        '燭台の火が、風のない部屋で一斉に同じ方向へ傾いた。',
        '子どもが知らない歌を歌っている。誰に習ったか答えられない。',
        '墓の土が、雨も降っていないのに柔らかい。',
        '朝、家畜が全部同じ方角を向いて立っている。',
        '灰色の服の男が、去年もこの日に来たという。',
      ],
    },
  ],
};

export const fantasy = {
  id: 'embers',
  name: '灯火のテーブル',
  tagline: '剣と魔法と、鳴らない鐘',
  blurb: '街道に狼が出る。村の司祭が笑っている。灯りを持って、暗がりへ。',
  icon: '🕯️',

  /* 画面の配色。CSS 変数として :root に流し込まれる。 */
  theme: {
    '--ink': '#ece6dc',
    '--ink-dim': '#a89f93',
    '--ink-faint': '#6f6659',
    '--bg': '#141019',
    '--bg-2': '#1c1723',
    '--panel': '#221c2b',
    '--panel-2': '#2a2334',
    '--line': '#38304a',
    '--gold': '#d8a657',
    '--gold-dim': '#8a6d38',
    '--blood': '#c05252',
    '--leaf': '#7fa863',
    '--sky': '#6f9dc4',
    '--violet': '#9b7fc4',
    '--display': '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
  },

  /* 画面に出す呼び名。世界観ごとに言い換える。 */
  labels: {
    ancestry: '種族',
    klass: 'クラス',
    background: '経歴',
    spell: '呪文',
    spellPlural: '呪文',
    spellSlot: '呪文スロット',
    cantrip: '初級呪文',
    caster: '呪文行使',
    party: '一行',
    adventure: '冒険',
    enemy: '敵',
    gold: '所持金',
    goldUnit: '枚',
    hitDice: 'ヒットダイス',
    strain: null,          // この世界に改造はない
  },

  startingGold: 25,

  abilities: ABILITIES,
  skills: SKILLS,
  ancestries: ANCESTRIES,
  classes: CLASSES,
  backgrounds: BACKGROUNDS,
  weapons: WEAPONS,
  armors: ARMORS,
  shield: SHIELD,
  items: ITEMS,
  spells: SPELLS,
  classSpells: CLASS_SPELLS,
  monsters: MONSTERS,
  enemyIcons: { 人型: '👺', 獣: '🐺', 不死: '💀', 巨人: '👹', 精霊: '🌀', 悪魔: '😈' },
  portraits: { fighter: '🛡️', rogue: '🗡️', mage: '🔮', cleric: '✨', ranger: '🏹' },
  lore: LORE,
};

export default fantasy;
