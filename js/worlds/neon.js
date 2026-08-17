/* 世界観「ネオンの雨」— 企業に飼われた街と、そこから抜け出そうとする連中。

   純粋なデータ。ファンタジー側と同じ形をしているので、エンジン・戦闘・
   シナリオ工房はそのまま動く。違うのは「何が存在するか」だけ。

   能力値の id は共通（str/dex/con/int/wis/cha）だが、呼び名は変わる。
   技能の id はこの世界の固有名で、シナリオはその id を参照する。 */

/* --------------------------------------------------------------- 能力値 */

const ABILITIES = [
  { id: 'str', name: '体力', short: '体', desc: '肉体労働、格闘、踏ん張り' },
  { id: 'dex', name: '反射', short: '反', desc: '射撃、回避、潜入、指先' },
  { id: 'con', name: '耐性', short: '耐', desc: 'タフさ、薬物と毒への抵抗' },
  { id: 'int', name: '演算', short: '演', desc: '技術、電脳、知識' },
  { id: 'wis', name: '感覚', short: '感', desc: '観察、直感、冷静さ' },
  { id: 'cha', name: '押し', short: '押', desc: '交渉、威圧、演技' },
];

/* ----------------------------------------------------------------- 技能 */

const SKILLS = [
  {
    id: 'athletics', name: '運動', ability: 'str',
    desc: '走る、登る、押し破る',
    example: '非常階段を駆け上がる。塀を越える。掴まれた腕を引き剥がす',
  },
  {
    id: 'acrobatics', name: '体術', ability: 'dex',
    desc: '狭いところを、素早く',
    example: 'ダクトを抜ける。転倒から立て直す。人混みをすり抜ける',
  },
  {
    id: 'stealth', name: '潜入', ability: 'dex',
    desc: 'カメラと視線を避ける',
    example: '死角を選ぶ。巡回の周期を待つ。荷物の陰を伝う',
  },
  {
    id: 'sleight', name: '手業', ability: 'dex',
    desc: '指先で誤魔化す',
    example: '掏る。仕込む。物理錠を開ける。相手の目の前でカードをすり替える',
  },
  {
    id: 'drive', name: '運転', ability: 'dex',
    desc: '走らせる',
    example: '追跡を振り切る。狭い路地を抜ける。荷を壊さずに運ぶ',
  },
  {
    id: 'netops', name: '電脳', ability: 'int',
    desc: '電脳をこじ開ける',
    example: '防壁を抜く。記録を消す。監視系に潜り込む',
  },
  {
    id: 'tech', name: '技術', ability: 'int',
    desc: '機械を分かっている',
    example: '端末を開ける。ドローンを黙らせる。配線から用途を読む',
  },
  {
    id: 'investigation', name: '捜査', ability: 'int',
    desc: '物から筋道を立てる',
    example: '現場を読む。書類の矛盾に気づく。図面と実物の違いを見抜く',
  },
  {
    id: 'datalore', name: '資料', ability: 'int',
    desc: '資料を辿る',
    example: '公開情報から人を特定する。社史の空白に気づく。名簿を突き合わせる',
  },
  {
    id: 'corpo', name: '企業儀礼', ability: 'int',
    desc: '企業の作法',
    example: '肩書きと部署名を正しい順序で言う。稟議の通し方を知っている',
  },
  {
    id: 'perception', name: '知覚', ability: 'wis',
    desc: '気づく',
    example: '物音。匂い。人の顔色。何かが「さっきと違う」こと',
  },
  {
    id: 'insight', name: '看破', ability: 'wis',
    desc: '人の腹を読む',
    example: '嘘を見抜く。言い淀みの理由を察する。雇い主が隠していることを察する',
  },
  {
    id: 'trauma', name: '応急処置', ability: 'wis',
    desc: 'その場で手当てする',
    example: '止血する。薬物の作用を読む。死因を見立てる',
  },
  {
    id: 'streetwise', name: '街の勘', ability: 'wis',
    desc: 'この街での歩き方を知っている',
    example: '誰に訊けばいいか知っている。相場を外さない。長居してはいけない場所が分かる',
  },
  {
    id: 'drones', name: 'ドローン', ability: 'wis',
    desc: '無人機を操る',
    example: '偵察に出す。追わせる。相手のドローンの動きを予測する',
  },
  {
    id: 'persuasion', name: '交渉', ability: 'cha',
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
];

/* ----------------------------------------------------------------- 出自 */

const ORIGINS = [
  {
    id: 'corp', name: '企業育ち', blurb: '社宅で育った。停電も断水も知らない。外の作法だけを知らない。',
    life: { adult: 18, typical: 92, oldest: 115,
      note: '企業医療がつく。上層の平均は92歳——下層より三十四年ぶん長い。'
        + 'この差を出した統計は社内資料で、外には出ない。' },
    bonus: { int: 2, cha: 1 }, speed: 9,
    traits: [
      { id: 'corpSpeak', text: '社内語：【企業儀礼】を習得' },
      { id: 'credit', text: '与信：初期資金 +60' },
    ],
    grantSkills: ['corpo'],
  },
  {
    id: 'street', name: 'ストリート', blurb: '路地の地図が頭に入っている。名前は三つある。',
    life: { adult: 15, typical: 58, oldest: 80,
      note: '下層の平均は58歳。ただし統計に載るのは与信のある死者だけなので、実際はもっと低い。' },
    bonus: { dex: 2, con: 1 }, speed: 9,
    traits: [
      { id: 'streetSense', text: '土地勘：【街の勘】を習得' },
      { id: 'fleetFoot', text: '逃げ足：【運動】に有利' },
    ],
    grantSkills: ['streetwise'],
  },
  {
    id: 'nomad', name: 'ノマド', blurb: '外環の家族で育った。血のつながりは関係ない。車列が家だ。',
    life: { adult: 16, typical: 65, oldest: 90,
      note: '医療が届かないぶん短い。ただし歯と関節は、同じ歳の都市の人間よりよほど丈夫だ。' },
    bonus: { con: 2, wis: 1 }, speed: 9,
    traits: [
      { id: 'roadLife', text: '車上生活：【運転】を習得' },
      { id: 'toxinTolerance', text: '汚染耐性：毒セーヴに有利' },
    ],
    grantSkills: ['drive'], keywords: ['poison-resist'],
  },
  {
    id: 'exmil', name: '元軍属', blurb: '契約は切れた。訓練は切れない。企業の軍事部門か、形だけ残った国の部隊か——どちらでも、雇われていたことに変わりはない。',
    life: { adult: 18, typical: 62, oldest: 85,
      note: '軍の改造を抜かないまま除隊した者は、五十代で不調が出る。抜く金は自腹だ。'
        + 'ここで言う「軍」は皇極重工の兵器部門か、書類の上にだけある国軍を指す。' },
    bonus: { str: 2, con: 1 }, speed: 9,
    traits: [
      { id: 'combatDrilled', text: '戦闘訓練：HP +1/レベル' },
      { id: 'situationalAwareness', text: '状況把握：イニシアチブに +2' },
    ],
  },
  {
    id: 'academy', name: 'アカデミー', blurb: '奨学金と引き換えに十年。論文は書けるが、路地の歩き方は知らない。',
    life: { adult: 22, typical: 80, oldest: 100,
      note: '上層に準じる。ただし奨学金を返し終える前に降りてきた者は、下層の数字に戻る。' },
    bonus: { int: 2, wis: 1 }, speed: 9,
    traits: [
      { id: 'research', text: '基礎研究：【資料】を習得' },
      { id: 'analytic', text: '解析癖：【技術】に有利' },
    ],
    grantSkills: ['datalore'],
  },
  {
    id: 'synth', name: '合成体', blurb: '体の大半が作りもの。医者ではなく整備士にかかる。中身は人のままだ——手放したのは体のほうだけ。',
    life: { adult: 0, typical: 0, oldest: 0,
      note: '寿命という言い方をしない。部品の供給が切れたときが終わりで、それは体ではなく契約が決める。'
        + '体を作りものに替えるのは、金さえあれば誰でもできる。噂になっているのは「中身だけになる」ほうだ。' },
    bonus: { con: 2, str: 1 }, speed: 9,
    traits: [
      { id: 'syntheticBody', text: '非生物代謝：毒ダメージに免疫、毒状態にならない' },
      { id: 'nonStandard', text: '規格外：修理は効くが医療は効きにくい' },
    ],
    immunities: ['毒'], keywords: ['synthetic'],
  },
];

/* ----------------------------------------------------------------- 役割 */

/* feature の id は core/combat.js が解釈する共通キー。表示名だけ世界に合わせる。 */

const ROLES = [
  {
    id: 'solo', name: 'ソロ', blurb: '暴力の専門家。契約書より先に体が動く。',
    hitDie: '1d10', hpBase: 10, saves: ['str', 'con'],
    skillChoices: 2,
    skillList: ['athletics', 'acrobatics', 'perception', 'streetwise', 'intimidation', 'insight', 'drive', 'tech'],
    armor: 'vest', weapon: 'katana', ranged: 'pistol',
    primary: 'dex',
    features: [
      { level: 1, id: 'secondWind', name: '戦闘スティム', desc: '休憩ごとに1回、1d10＋レベル 回復する。' },
      { level: 2, id: 'surge', name: '加速代謝', desc: '戦闘ごとに1回、追加で1回攻撃できる。' },
      { level: 3, id: 'defender', name: '射線管理', desc: '味方が隣にいる間、AC +1。' },
      { level: 5, id: 'extraAttack', name: '連射制御', desc: '攻撃行動で2回攻撃する。' },
    ],
  },
  {
    id: 'runner', name: 'ランナー', blurb: '正面から入らない。入った形跡も残さない。',
    hitDie: '1d8', hpBase: 8, saves: ['dex', 'int'],
    skillChoices: 4,
    skillList: ['stealth', 'sleight', 'acrobatics', 'perception', 'investigation', 'deception', 'persuasion', 'tech', 'streetwise'],
    expertiseChoices: 2,
    armor: 'weave', weapon: 'monoblade', ranged: 'smg',
    primary: 'dex',
    features: [
      { level: 1, id: 'sneakAttack', name: '死角取り', desc: '有利な状況の攻撃が命中したとき、追加ダメージ。' },
      { level: 1, id: 'expertise', name: '専門技能', desc: '選んだ2技能の習熟ボーナスが2倍。' },
      { level: 2, id: 'cunning', name: '影の足', desc: 'ボーナス行動で隠れる／離脱できる。' },
      { level: 5, id: 'uncanny', name: '危機予測', desc: '反射セーヴの失敗ダメージを半分にする。' },
    ],
  },
  {
    id: 'netrunner', name: 'ネットランナー', blurb: '体は椅子に置いて、意識だけが敵地に入る。',
    hitDie: '1d6', hpBase: 6, saves: ['int', 'wis'],
    skillChoices: 2,
    skillList: ['netops', 'tech', 'datalore', 'investigation', 'corpo', 'insight', 'perception'],
    armor: 'weave', weapon: 'taser', primary: 'int',
    caster: { ability: 'int', cantrips: ['zap', 'lamp'], known: 6 },
    features: [
      { level: 1, id: 'spellcasting', name: 'プログラム実行', desc: '演算を基準に戦闘プログラムを走らせる。' },
      { level: 2, id: 'arcaneRecovery', name: 'キャッシュ再構築', desc: '小休憩でメモリを1つ取り戻す（1日1回）。' },
      { level: 3, id: 'shieldSelf', name: '緊急ファイアウォール', desc: '被弾時に反応で AC +5（メモリを消費）。' },
      { level: 5, id: 'empower', name: 'オーバークロック', desc: 'ダメージプログラムのダイス1個を振り直せる。' },
    ],
  },
  {
    id: 'medtech', name: 'メドテック', blurb: '路地裏の外科医。免許はない。腕はある。',
    hitDie: '1d8', hpBase: 8, saves: ['wis', 'cha'],
    skillChoices: 2,
    skillList: ['trauma', 'tech', 'insight', 'persuasion', 'datalore', 'perception'],
    armor: 'jacket', offhand: 'shield', weapon: 'stunbaton', primary: 'wis',
    caster: { ability: 'wis', cantrips: ['assist', 'glitch'], known: 6 },
    features: [
      { level: 1, id: 'spellcasting', name: 'ナノ投与', desc: '感覚を基準に医療ナノを制御する。' },
      { level: 1, id: 'channelHeal', name: '緊急処置', desc: '休憩ごとに1回、味方1体を 2d8＋レベル 回復。' },
      { level: 2, id: 'turnUndead', name: '強制再起動', desc: '機械系の敵を後退させる。' },
      { level: 5, id: 'divineStrike', name: '神経毒注入', desc: '近接攻撃に +1d8 の毒ダメージ。' },
    ],
  },
  {
    id: 'techie', name: 'テッキー', blurb: 'ドローンと工具。壊れたものは大体なんとかなる。',
    hitDie: '1d10', hpBase: 10, saves: ['dex', 'int'],
    skillChoices: 3,
    skillList: ['tech', 'drones', 'perception', 'investigation', 'drive', 'athletics', 'sleight'],
    armor: 'jacket', weapon: 'knuckles', ranged: 'rifle', primary: 'dex',
    caster: { ability: 'int', cantrips: [], known: 3, halfCaster: true },
    features: [
      { level: 1, id: 'favoredFoe', name: '設計図読み', desc: '選んだ種別の相手を解析する判定に有利、初撃に +1d4。' },
      { level: 2, id: 'trailwise', name: '整備済み', desc: '移動中の遭遇判定に有利。' },
      { level: 3, id: 'hunterMark', name: '標的タグ', desc: 'タグを打った相手への攻撃に +1d6。' },
      { level: 5, id: 'extraAttack', name: '二丁運用', desc: '攻撃行動で2回攻撃する。' },
    ],
  },
];

/* ----------------------------------------------------------------- 経歴 */

const BACKGROUNDS = [
  { id: 'courier', name: '運び屋', skills: ['drive', 'streetwise'], gear: ['傷だらけのバイク鍵', '偽造通行証'], blurb: '中身は聞かない。それが長生きの条件だった。' },
  { id: 'journo', name: 'フリー記者', skills: ['investigation', 'persuasion'], gear: ['壊れかけの録音機', '匿名回線の番号'], blurb: '一本の記事のために、二度殺されかけた。' },
  { id: 'exec', name: '元中間管理職', skills: ['corpo', 'deception'], gear: ['期限切れの社員証', '高級な万年筆'], blurb: '切られる側になって、はじめて構造が見えた。' },
  { id: 'ripperdoc', name: '闇医者の助手', skills: ['trauma', 'tech'], gear: ['血のついた工具袋', '使いかけの麻酔'], blurb: '人体は開けてみると、思ったより機械に近い。' },
  { id: 'ganger', name: '元ギャング', skills: ['intimidation', 'streetwise'], gear: ['消しきれないタトゥー', '仲間の遺品'], blurb: '抜けたつもりでいる。向こうはそう思っていない。' },
  { id: 'idol', name: '場末の歌い手', skills: ['persuasion', 'insight'], gear: ['安物のシンセ', '常連客の名簿'], blurb: '拍手で食えた時期もあった。短かったが。' },
  { id: 'hacker', name: '自称セキュリティ研究者', skills: ['netops', 'datalore'], gear: ['自作のデッキ筐体', '他人の身分情報'], blurb: '「善意の第三者」を名乗って十七回、逮捕は二回。' },
];

/* ----------------------------------------------------------------- 装備 */

const WEAPONS = {
  pistol: { id: 'pistol', cost: 250, name: 'ハンドガン', damage: '1d8', type: '実弾', ability: 'dex', tags: ['遠隔'], ranged: true },
  smg: { id: 'smg', cost: 600, name: 'サブマシンガン', damage: '1d6', type: '実弾', ability: 'dex', tags: ['遠隔', '連射'], ranged: true },
  /* 遠隔は反撃を受けないぶん有利なので、ダメージの上限は 1d10 に抑える
     （SRD が重クロスボウ 1d10、近接に 1d12 を割り当てているのと同じ理由）。
     重火器は反動を支える体格を要求し、体力が足りないと命中に不利がつく。 */
  rifle: { id: 'rifle', cost: 900, name: 'アサルトライフル', damage: '1d10', type: '実弾', ability: 'dex', tags: ['遠隔', '両手', '重火器'], ranged: true, heavy: true },
  shotgun: { id: 'shotgun', cost: 550, name: 'ショットガン', damage: '1d10', type: '実弾', ability: 'dex', tags: ['遠隔', '両手', '重火器'], ranged: true, heavy: true },
  taser: { id: 'taser', cost: 150, name: 'テイザー', damage: '1d4', type: '電撃', ability: 'dex', tags: ['遠隔'], ranged: true },
  monoblade: { id: 'monoblade', cost: 800, name: 'モノフィラ・ブレード', damage: '1d8', type: '斬撃', ability: 'dex', tags: ['近接'] },
  katana: { id: 'katana', cost: 400, name: 'カタナ', damage: '1d8', type: '斬撃', ability: 'dex', tags: ['近接'] },
  knuckles: { id: 'knuckles', cost: 120, name: '強化ナックル', damage: '1d8', type: '打撃', ability: 'str', tags: ['近接'] },
  stunbaton: { id: 'stunbaton', cost: 100, name: 'スタンバトン', damage: '1d6', type: '電撃', ability: 'str', tags: ['近接'] },
  cleaver: { id: 'cleaver', cost: 60, name: '工業用クリーバー', damage: '1d12', type: '斬撃', ability: 'str', tags: ['近接', '両手'] },
  unarmed: { id: 'unarmed', cost: 0, name: '素手', damage: '1d2', type: '打撃', ability: 'str', tags: ['近接'] },
};

const ARMORS = {
  weave: { id: 'weave', cost: 600, name: '皮下ウィーヴ', base: 11, maxDex: undefined },
  jacket: { id: 'jacket', cost: 250, name: 'アーマージャケット', base: 12, maxDex: undefined },
  vest: { id: 'vest', cost: 500, name: '防弾ベスト', base: 13, maxDex: 2 },
  carapace: { id: 'carapace', cost: 1200, name: 'カラパス装甲', base: 14, maxDex: 2 },
  exo: { id: 'exo', cost: 2500, name: '外骨格スーツ', base: 16, maxDex: 0, stealth: -2 },
};

const SHIELD = { id: 'shield', name: 'ディフレクタ・フィールド', ac: 2, cost: 300 };

const ITEMS = {
  potion: { id: 'potion', cost: 100, name: 'スティムパック', use: 'heal', amount: '2d4+2', desc: '打つと 2d4+2 回復する。', consumable: true },
  greaterPotion: { id: 'greaterPotion', cost: 350, name: '軍用スティム', use: 'heal', amount: '4d4+4', desc: '打つと 4d4+4 回復する。', consumable: true },
  antidote: { id: 'antidote', cost: 90, name: '解毒ナノ', use: 'cure', cures: ['poisoned'], desc: '毒状態を取り除く。', consumable: true },
  bomb: { id: 'bomb', cost: 250, name: '焼夷グレネード', use: 'damage', amount: '2d6', type: '火', area: true, desc: '投げつけて 2d6 の火ダメージ（範囲）。', consumable: true },
  emp: { id: 'emp', cost: 300, name: 'EMPグレネード', use: 'damage', amount: '3d6', type: '電撃', area: true, desc: '機械系に 3d6 の電撃ダメージ（範囲）。', consumable: true },
  ropegun: { id: 'ropegun', cost: 200, name: 'ワイヤーガン', desc: '上階へ登る、あるいは降りる。' },
  torch: { id: 'torch', cost: 10, name: 'ライトスティック', desc: '暗所を照らす。手が1つ塞がる。', light: true },
  lockpicks: { id: 'lockpicks', cost: 120, name: '電子ピック', desc: '電子錠を開ける判定に必要。' },
  rations: { id: 'rations', cost: 15, name: '合成食（3日分）', desc: '路上生活に使う。' },
  deck: { id: 'deck', cost: 1500, name: 'サイバーデッキ', desc: 'ネットランに必要な端末。' },
  medkit: { id: 'medkit', cost: 250, name: '医療キット', desc: '【応急処置】判定に必要。' },
};

/* --------------------------------------------------------- サイバーウェア */

/* 改造は強いが、体が耐えられる量に上限がある。合計 strain が適合値を超えた
   ぶんだけ、すべての判定とセーヴに固定のペナルティがつく（core/rules.js）。 */

const AUGMENTS = {
  opticSuite: {
    id: 'opticSuite', name: '光学強化眼', slot: '眼', strain: 2, grade: 'corp', cost: 900,
    desc: '暗視と拡大。【知覚】+2、暗所のペナルティを受けない。',
    effect: { skillBonus: { perception: 2 }, keywords: ['darkvision'] },
  },
  reflexBooster: {
    id: 'reflexBooster', name: '反射ブースター', slot: '神経', strain: 3, grade: 'corp', cost: 1800,
    desc: '神経伝達を短絡させる。イニシアチブ +4、【体術】+1。',
    effect: { initiativeBonus: 4, skillBonus: { acrobatics: 1 } },
  },
  subdermalPlate: {
    id: 'subdermalPlate', name: '皮下装甲板', slot: '皮膚', strain: 3, grade: 'corp', cost: 1500,
    desc: '肋骨に沿って敷いた合金。AC +1、実弾ダメージに抵抗。',
    effect: { acBonus: 1, resistances: ['実弾'] },
  },
  ripperClaws: {
    id: 'ripperClaws', name: '格納式クロー', slot: '腕', strain: 2, grade: 'street', cost: 1200,
    desc: '指の骨から伸びる刃。武器として使える 1d8 斬撃。',
    effect: { attack: { id: 'claws', name: '格納クロー', damage: '1d8', type: '斬撃', ability: 'dex' } },
  },
  neuralPort: {
    id: 'neuralPort', name: '後頭部ポート', slot: '神経', strain: 1, grade: 'street', cost: 600,
    desc: 'デッキに直結する。【電脳】+2、ネットランでの追跡を1段遅らせる。',
    effect: { skillBonus: { netops: 2 }, keywords: ['jack-in'] },
  },
  adrenalPump: {
    id: 'adrenalPump', name: '副腎ポンプ', slot: '内臓', strain: 3, grade: 'corp', cost: 1600,
    desc: '危機に体が勝手に反応する。最大HP +2/レベル。',
    effect: { hpPerLevel: 2 },
  },
  toxinFilter: {
    id: 'toxinFilter', name: '毒素フィルタ', slot: '内臓', strain: 2, grade: 'street', cost: 800,
    desc: '肝臓の脇に増設した濾過器。毒に免疫、耐性セーヴに有利。',
    effect: { immunities: ['毒'] },
  },
  smartLink: {
    id: 'smartLink', name: 'スマートリンク', slot: '腕', strain: 2, grade: 'corp', cost: 1400,
    desc: '銃と手が会話する。遠隔攻撃の命中 +1。',
    effect: { attackBonus: 1 },
  },

  /* ---- 街の品。安い。負荷が高く、たいてい何かを引き換えにする ---- */

  gutterOptics: {
    id: 'gutterOptics', name: '横丁の義眼', slot: '眼', strain: 3, grade: 'street', cost: 300,
    desc: '闇医者の中古。【知覚】+1。色がときどき飛ぶので【看破】−1。',
    effect: { skillBonus: { perception: 1, insight: -1 }, keywords: ['darkvision'] },
  },
  scrapLegs: {
    id: 'scrapLegs', name: '寄せ集めの脚', slot: '脚', strain: 3, grade: 'street', cost: 450,
    desc: '出どころの違う部品でできている。移動が伸び、【運動】+1。ただし静かではない——【潜入】−2。',
    effect: { skillBonus: { athletics: 1, stealth: -2 }, speed: 3 },
  },
  cheapVoice: {
    id: 'cheapVoice', name: '合成声帯（並）', slot: '声', strain: 2, grade: 'street', cost: 350,
    desc: '声を変えられる。【欺瞞】+2。長く喋ると音が割れるので【交渉】−1。',
    effect: { skillBonus: { deception: 2, persuasion: -1 } },
  },
  bloodScrub: {
    id: 'bloodScrub', name: '血液濾過器（中古）', slot: '血液', strain: 3, grade: 'street', cost: 500,
    desc: '薬物と毒を洗い流す。耐性セーヴに有利。動悸がするので【知覚】−1。',
    effect: { skillBonus: { perception: -1 }, saveAdvantageVs: ['poisoned'] },
  },

  /* ---- 企業品と軍用。高い。負荷が低いか、性能で釣り合う ---- */

  silentTendon: {
    id: 'silentTendon', name: '静音腱', slot: '脚', strain: 2, grade: 'corp', cost: 1600,
    desc: '足音が消える。【潜入】+2、移動 +1。',
    effect: { skillBonus: { stealth: 2 }, speed: 1 },
  },
  vocalSuite: {
    id: 'vocalSuite', name: '声帯調律器', slot: '声', strain: 1, grade: 'corp', cost: 1300,
    desc: '声色と抑揚を設計できる。【交渉】+1、【欺瞞】+1。',
    effect: { skillBonus: { persuasion: 1, deception: 1 } },
  },
  synthBlood: {
    id: 'synthBlood', name: '合成血液', slot: '血液', strain: 2, grade: 'corp', cost: 1900,
    desc: '酸素を余分に運ぶ。HP +1/レベル、毒に免疫。',
    effect: { hpPerLevel: 1, immunities: ['毒'] },
  },
  militaryFrame: {
    id: 'militaryFrame', name: '軍用外骨格（埋込）', slot: '全身', strain: 5, grade: 'military', cost: 4200,
    desc: '骨格ごと入れ替える。AC +2、実弾と斬撃に抵抗。体が完全に規格品になる。',
    effect: { acBonus: 2, resistances: ['実弾', '斬撃'] },
  },
  combatDeck: {
    id: 'combatDeck', name: '戦闘用デッキ（内蔵）', slot: '神経', strain: 4, grade: 'military', cost: 3800,
    desc: '頭の中にデッキが入る。【電脳】+3、【技術】+1。夢を見なくなる。',
    effect: { skillBonus: { netops: 3, tech: 1 } },
  },

};

/* --------------------------------------------------------- プログラム */

/* 効果の形はファンタジー側の呪文と同じ。呼び名と演出だけが違う。 */

const PROGRAMS = {
  zap: {
    id: 'zap', name: '放電', level: 0, school: '攻性', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '1d10', type: '電撃', attack: true },
    scale: level => `${Math.ceil(level / 4) || 1}d10`,
    desc: '指先から電流を飛ばす。命中判定あり。',
  },
  glitch: {
    id: 'glitch', name: 'グリッチ', level: 0, school: '攻性', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '1d8', type: 'データ', save: 'dex' },
    scale: level => `${Math.ceil(level / 4) || 1}d8`,
    desc: '相手の視界にノイズを叩き込む。反射セーヴ成功で無効。',
  },
  lamp: {
    id: 'lamp', name: '照明ドローン', level: 0, school: '支援', target: 'self', range: '自身',
    effect: { kind: 'utility', flag: 'light' }, desc: '小型ドローンが周囲を照らす。暗所の不利を打ち消す。',
  },
  assist: {
    id: 'assist', name: '補助演算', level: 0, school: '支援', target: 'ally', range: '近距離',
    effect: { kind: 'buff', condition: 'guided', rounds: 10 }, desc: '次の技能判定に +1d4。',
  },
  spike: {
    id: 'spike', name: 'スパイク弾', level: 1, school: '攻性', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '3d4+3', type: 'データ', autoHit: true },
    desc: '必中のデータ弾。回避もセーヴもできない。',
  },
  burnout: {
    id: 'burnout', name: 'バーンアウト', level: 1, school: '攻性', target: 'area', range: '扇形',
    effect: { kind: 'damage', damage: '3d6', type: '火', save: 'dex', halfOnSave: true },
    desc: '前方の回路をまとめて焼く。反射セーヴで半減。',
  },
  patch: {
    id: 'patch', name: 'ナノ修復', level: 1, school: '医療', target: 'ally', range: '接触',
    effect: { kind: 'heal', amount: '1d8+3' }, desc: '医療ナノが傷を塞ぐ。',
  },
  overclock: {
    id: 'overclock', name: 'オーバークロック', level: 1, school: '支援', target: 'ally', range: '近距離',
    effect: { kind: 'buff', condition: 'blessed', rounds: 10 }, desc: '攻撃とセーヴに +1d4。',
  },
  barrier: {
    id: 'barrier', name: '防壁展開', level: 1, school: '防性', target: 'ally', range: '近距離',
    effect: { kind: 'buff', acBonus: 2, rounds: 10 }, desc: '対象の AC を 2 上げる。',
  },
  lockout: {
    id: 'lockout', name: '強制シャットダウン', level: 1, school: '侵入', target: 'enemy', range: '遠隔',
    effect: { kind: 'condition', condition: 'unconscious', rounds: 3, save: 'wis' },
    desc: '感覚セーヴに失敗した相手の意識を落とす。',
  },
  scramble: {
    id: 'scramble', name: '感覚攪乱', level: 1, school: '侵入', target: 'enemy', range: '近距離',
    effect: { kind: 'condition', condition: 'frightened', rounds: 4, save: 'wis' },
    desc: '恐怖の記憶を再生させる。交渉中に使うと場面が変わることがある。',
  },
  tag: {
    id: 'tag', name: '標的タグ', level: 1, school: '支援', target: 'enemy', range: '遠隔',
    effect: { kind: 'mark', bonusDamage: '1d6', rounds: 10 }, desc: 'タグを打った相手への攻撃に +1d6。',
  },
  railshot: {
    id: 'railshot', name: 'レールショット', level: 2, school: '攻性', target: 'enemy', range: '遠隔',
    effect: { kind: 'damage', damage: '6d6', type: '実弾', attack: true }, desc: '磁気加速した徹甲弾を撃ち込む。',
  },
  paralytic: {
    id: 'paralytic', name: '神経麻痺弾', level: 2, school: '侵入', target: 'enemy', range: '遠隔',
    effect: { kind: 'condition', condition: 'stunned', rounds: 3, save: 'con' }, desc: '生体の相手を硬直させる。',
  },
  droneSwarm: {
    id: 'droneSwarm', name: 'ドローン群', level: 2, school: '攻性', target: 'area', range: '自身周囲',
    effect: { kind: 'damage', damage: '3d8', type: '斬撃', save: 'dex', halfOnSave: true }, desc: '小型機が周囲を切り刻む。',
  },
  uplink: {
    id: 'uplink', name: '共有アップリンク', level: 2, school: '支援', target: 'party', range: '近距離',
    effect: { kind: 'heal', amount: '5', temp: true }, desc: '仲間全員に一時HPを与える。',
  },
};

const ROLE_PROGRAMS = {
  netrunner: ['spike', 'burnout', 'lockout', 'scramble', 'railshot', 'paralytic'],
  medtech: ['patch', 'overclock', 'barrier', 'scramble', 'droneSwarm', 'uplink'],
  techie: ['tag', 'patch', 'scramble'],
};

/* ------------------------------------------------------------------ 敵 */

const ENEMIES = {
  punk: {
    id: 'punk', name: 'チンピラ', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 12, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    attacks: [{ name: '安物の拳銃', bonus: 3, damage: '1d6+1', type: '実弾', ranged: true }],
    tactics: 'skirmish', blurb: '通行料を払えば見逃す、と言っている。たぶん嘘だ。',
  },
  gangLeader: {
    id: 'gangLeader', name: 'ギャングの頭', kind: '人型', cr: 2, xp: 450,
    acOverride: 15, hp: '10d8', hpAvg: 45, speed: 9,
    abilities: { str: 15, dex: 16, con: 14, int: 12, wis: 11, cha: 14 },
    attacks: [
      { name: 'ショットガン', bonus: 5, damage: '2d6+3', type: '実弾', ranged: true },
      { name: 'ナイフ', bonus: 5, damage: '1d4+3', type: '斬撃' },
    ],
    tactics: 'brute', blurb: '交渉に応じる程度には賢い。裏切る程度にも賢い。',
  },
  secGuard: {
    id: 'secGuard', name: '警備員', kind: '人型', cr: 0.125, xp: 25,
    acOverride: 14, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: 'スタンバトン', bonus: 3, damage: '1d6+1', type: '電撃' }],
    tactics: 'brute', blurb: '仕事でやっている。死ぬ気はない。',
  },
  corpTrooper: {
    id: 'corpTrooper', name: '企業警備兵', kind: '人型', cr: 1, xp: 200,
    acOverride: 16, hp: '5d8+10', hpAvg: 32, speed: 9,
    abilities: { str: 14, dex: 14, con: 15, int: 10, wis: 12, cha: 10 },
    attacks: [{ name: 'アサルトライフル', bonus: 5, damage: '2d8+2', type: '実弾', ranged: true }],
    resistances: ['実弾'],
    tactics: 'skirmish',
    traits: [{ id: 'pack', text: '連携射撃：仲間が生きているあいだ攻撃に有利' }],
    blurb: '規格品の装甲。規格品の動き。だから強い。',
  },
  cleaner: {
    id: 'cleaner', name: '掃除屋', kind: '人型', cr: 3, xp: 700,
    acOverride: 15, hp: '8d8+8', hpAvg: 44, speed: 12,
    abilities: { str: 12, dex: 18, con: 13, int: 14, wis: 14, cha: 11 },
    attacks: [
      { name: '消音ピストル', bonus: 6, damage: '2d6+4', type: '実弾', ranged: true },
      { name: 'モノブレード', bonus: 6, damage: '1d8+4', type: '斬撃' },
    ],
    tactics: 'skirmish',
    traits: [{ id: 'cloakOnce', text: '光学迷彩：1度だけ、受けた攻撃を無効にする' }],
    blurb: '契約書に名前は載らない。載るのは結果だけだ。',
  },
  ripper: {
    id: 'ripper', name: '改造中毒者', kind: '人型', cr: 0.5, xp: 100,
    acOverride: 13, hp: '4d8+4', hpAvg: 22, speed: 12,
    abilities: { str: 16, dex: 13, con: 13, int: 6, wis: 8, cha: 6 },
    attacks: [{ name: '暴走したクロー', bonus: 5, damage: '1d8+3', type: '斬撃' }],
    tactics: 'brute',
    traits: [{ id: 'fearImmune', text: '痛覚遮断：恐怖状態にならない' }],
    blurb: '入れすぎた。もう自分がどこまでか分かっていない。',
  },
  cyberdog: {
    id: 'cyberdog', name: 'サイバードッグ', kind: '獣', cr: 0.25, xp: 50,
    acOverride: 13, hp: '2d8+2', hpAvg: 11, speed: 15,
    abilities: { str: 13, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: '金属牙', bonus: 4, damage: '2d4+2', type: '刺突', onHit: { save: 'str', dc: 11, condition: 'prone' } }],
    tactics: 'brute',
    traits: [{ id: 'pack', text: '群れ戦術：仲間が生きているあいだ攻撃に有利' }],
    blurb: '首輪の代わりに、うなじにポートがある。',
  },
  surveillanceDrone: {
    id: 'surveillanceDrone', name: '監視ドローン', kind: '機械', cr: 0.25, xp: 50,
    acOverride: 15, hp: '2d6', hpAvg: 7, speed: 12,
    abilities: { str: 6, dex: 16, con: 10, int: 4, wis: 12, cha: 1 },
    attacks: [{ name: '警棒アーム', bonus: 4, damage: '1d6+3', type: '電撃' }],
    immunities: ['毒'], vulnerabilities: ['電撃'],
    tactics: 'skirmish', backupId: 'secGuard',
    traits: [{ id: 'callBackup', text: '通報：3ラウンド生き残ると警備を1人呼ぶ' }],
    blurb: 'レンズがこちらを向いたまま動かない。もう送信は終わっている。',
  },
  combatDrone: {
    id: 'combatDrone', name: '戦闘ドローン', kind: '機械', cr: 1, xp: 200,
    acOverride: 16, hp: '4d8+8', hpAvg: 26, speed: 12,
    abilities: { str: 14, dex: 16, con: 14, int: 4, wis: 10, cha: 1 },
    attacks: [{ name: '機関砲', bonus: 5, damage: '2d6+3', type: '実弾', ranged: true }],
    immunities: ['毒'], resistances: ['刺突'], vulnerabilities: ['電撃'],
    tactics: 'caster', blurb: '感情がない相手は、脅しが効かない。',
  },
  turret: {
    id: 'turret', name: '自動砲塔', kind: '機械', cr: 1, xp: 200,
    acOverride: 17, hp: '4d10+8', hpAvg: 30, speed: 0,
    abilities: { str: 14, dex: 10, con: 15, int: 1, wis: 10, cha: 1 },
    attacks: [{ name: '制圧射撃', bonus: 6, damage: '2d8+2', type: '実弾', ranged: true }],
    immunities: ['毒'], vulnerabilities: ['電撃'],
    tactics: 'caster',
    traits: [{ id: 'emplaced', text: '固定：移動できない' }],
    blurb: '天井の隅で、こちらを追って回っている。',
  },
  juggernaut: {
    id: 'juggernaut', name: 'ジャガーノート', kind: '重装', cr: 2, xp: 450,
    acOverride: 15, hp: '7d10+21', hpAvg: 59, speed: 9,
    abilities: { str: 19, dex: 8, con: 17, int: 6, wis: 8, cha: 7 },
    attacks: [{ name: '装甲拳', bonus: 6, damage: '2d8+4', type: '打撃' }],
    resistances: ['実弾', '斬撃'],
    tactics: 'brute', blurb: '一撃が重い。当たらなければ問題ない。',
  },
  ice: {
    id: 'ice', name: 'ICE', kind: '電子', cr: 0.5, xp: 100,
    acOverride: 14, hp: '3d8+3', hpAvg: 16, speed: 0,
    abilities: { str: 1, dex: 14, con: 12, int: 14, wis: 12, cha: 1 },
    attacks: [{ name: '侵入者排除', bonus: 5, damage: '2d6', type: 'データ', ranged: true }],
    immunities: ['実弾', '斬撃', '刺突', '毒'],
    tactics: 'caster',
    traits: [{ id: 'netOnly', text: '電脳内のみ：現実では触れられない' }],
    blurb: '壁ではない。こちらを見ている。',
  },
  blackIce: {
    id: 'blackIce', name: 'ブラックICE', kind: '電子', cr: 3, xp: 700,
    acOverride: 16, hp: '7d8+14', hpAvg: 45, speed: 0,
    abilities: { str: 1, dex: 16, con: 15, int: 18, wis: 14, cha: 6 },
    attacks: [
      { name: '神経焼き', bonus: 7, damage: '3d6', type: 'データ', ranged: true },
      { name: '追跡パケット', bonus: 7, damage: '2d6', type: 'データ', ranged: true, onHit: { save: 'int', dc: 14, condition: 'blinded', rounds: 2 } },
    ],
    immunities: ['実弾', '斬撃', '刺突', '毒'],
    tactics: 'caster',
    traits: [{ id: 'lethalIce', text: '致死設定：抵抗も免疫も貫いて脳を直接焼く' }],
    blurb: '違法だ。誰も摘発しないというだけで。',
  },
  scav: {
    id: 'scav', name: 'スカベンジャー', kind: '人型', cr: 0.25, xp: 50,
    acOverride: 12, hp: '2d8+2', hpAvg: 11, speed: 9,
    abilities: { str: 12, dex: 13, con: 12, int: 8, wis: 10, cha: 7 },
    attacks: [{ name: '解体ノコギリ', bonus: 3, damage: '1d6+1', type: '斬撃' }],
    tactics: 'skirmish', blurb: '生きた人間から部品を採る。死んでいれば、もっと楽に採る。',
  },
  nanoSwarm: {
    id: 'nanoSwarm', name: 'ナノ蟲の群れ', kind: '機械', cr: 0.25, xp: 50,
    acOverride: 12, hp: '5d8', hpAvg: 24, speed: 9,
    abilities: { str: 6, dex: 14, con: 11, int: 1, wis: 10, cha: 1 },
    attacks: [{ name: '分解の霧', bonus: 3, damage: '2d6', type: '酸' }],
    resistances: ['斬撃', '刺突', '実弾'], vulnerabilities: ['電撃'],
    tactics: 'brute', blurb: '床の汚れが、風もないのに移動している。',
  },
};

/* ------------------------------------------------------------------ 世界 */


/* ------------------------------------------------------------- 読み物 */

/* ファンタジー側と同じ形。数値は持たない。
   この街は「上」と「下」で出来ていて、読み物もその軸で書いてある。 */

const LORE = {
  primer: [
    'ここは **ネオ東京**。国がまだあった頃の地図には、別の名前で載っている。',
    'この街をひとことで言うなら、**縦に積まれた国**だ。' +
    '地上から三十階までが人の住む層で、それより上は企業のもの。' +
    '上と下では雨の当たり方も、空気の値段も違う。上の階には雨が降らない。降らせないからだ。',
    '国はある。書類の上には。だが徴税も、警備も、水道も、送電も、' +
    'いつの間にか会社の仕事になった。**企業は政府になったのではなく、政府の仕事を全部引き受けただけだ**——' +
    'というのが、この街の企業側の言い分になっている。',
    '警察は企業の下請けだ。事件が起きたとき最初に来るのは、' +
    'その区画の警備契約を持っている会社の私兵で、公的な捜査はその後から、来れば、来る。',
    '**この街で身分を証明するのは肉体ではなく信用スコアだ**。' +
    '名前は三つ持っていてもいいが、スコアが切れたら一つも使えない。' +
    '宿にも、医者にも、電車にも、まず信用が要る。金はその次だ。',
    '電脳は「もう一つの街」ではない。設備と記録が置いてある倉庫で、' +
    '入るのは盗むためか、消すためだ。長く居ると逆探知され、ブラックICE に当たれば脳が焼ける。' +
    '肉体を捨てて仮想空間に住んでいる金持ちがいるという話は、下層では都市伝説の扱いだ。',
    '改造は誰でも入れられる。問題は体が受け入れる量で、超えると手が震え、判定が全部鈍る。' +
    '街には「入れすぎた者」が普通に歩いていて、誰も驚かない。',
  ],

  places: [
    { name: 'メリディアン・タワー', blurb: '中央区の企業塔。22階から上は社員証が要る。ロビーの空気は、この街のものではない匂いがする。' },
    { name: '第4区画', blurb: '毎週火曜の午前二時、電力が三分だけ落ちる。理由は公表されていない。その三分を目当てに人が集まる。' },
    { name: '第9温室', blurb: 'メリディアン農政の垂直農場。硝子の中では季節がない。下層の作業員だけが咳をしている。' },
    { name: 'ゲンテック生体研究', blurb: '第37階層が「保管区画」になっている。設計図では「保守区画」だった。書き換えたのは四年前。' },
    { name: '下水通り', blurb: '地上の商店街。屋根がないので雨が直接来る。ここで買えないものは、この街では買えない。' },
    { name: '闇医者横丁', blurb: '許可のない改造と、名前を訊かない治療。腕はいい。麻酔が高い。' },
    { name: '外環', blurb: '街の外。砂と風とノマドの車列。企業の与信が届かないかわり、水も届かない。' },
    { name: '皇極タワー', blurb: '中央区でいちばん高い。上の四十階は誰も見たことがない。社員でさえ、行った者は戻って役職が変わる。' },
    { name: 'ネオアビス', blurb: '旧地下鉄の駅を繋いだ地下街。電力はDIYで、食糧は上から降りてくる。スコアを失った者の行き着く先。' },
    { name: 'ダークバザール', blurb: 'ネオアビスの密輸市場。暗号資産だけが通貨で、顔認証の効かない照明が使われている。' },
    { name: '皇極学園', blurb: '企業直轄のエリート校。入るのに推薦ではなく親の役職が要る。出た者は全員、同じ会社に入る。' },
    { name: 'ナイトマーケット', blurb: '毎晩場所が変わる市。前の晩の場所を知っている者だけが辿り着ける。' },
    { name: 'アズマ信託', blurb: '第4区画の金融。企業でない金を預かる数少ない場所で、金庫室の錠だけは機械式のまま。被害届を出さない会社としても知られている。' },
    { name: '中央アカデミー', blurb: '企業連合が出資する高等教育機関。学費は奨学金で立て替えられ、卒業後の配属先も同時に決まる。断ると返済が一括になる。' },
  ],

  factions: [
    {
      name: 'メリディアン複合企業',
      blurb: 'この街の実質的な統治者。塔、農場、水道、そして警備会社を持っている。'
        + '**大陸側の資本が、水道の利権を足がかりにこの街へ入ってきた**のが始まりで、'
        + '地元の企業からは今でも「よそ者」と呼ばれている。呼んでいる側も、そう呼べる立場ではない。'
        + '敵に回すのではなく「別の部署と話す」のが正しい戦い方だとされている。',
      stance: 'ゲンテックを下請けとして飼っている。労組は「相手」ですらなく、法務部の案件でしかない。'
        + '皇極とは水と電気で首を絞め合っていて、どちらも手を離せない。',
    },
    {
      name: 'ゲンテック生体研究',
      blurb: '**半島側の医療資本が、戦後の混乱期に人手と検体を集めて大きくなった。**'
        + 'メリディアンの下請けから始まって、いまは臓器と生体部品で独立している。'
        + '素材の出どころを訊かないのが業界の礼儀になっている——'
        + 'その礼儀がいつ生まれたかを、この会社の年史は書いていない。',
      stance: 'メリディアンから独立したがっている。だから外環のノマドと、誰も知らない取引をしている。',
    },
    {
      name: '第4区画労働組合',
      blurb: 'この街に残る数少ない、企業でない組織。積立ては薄く、弁護士は一人しかいない。' +
        'それでも、死んだ人間の名前を数えているのはここだけだ。',
      stance: '企業すべてが相手。ノヴァ・ギャングとは「下層の味方」として微妙に近い。近すぎると企業に使われる。',
    },
    {
      name: 'ノヴァ・ギャング',
      blurb: '下層の縄張りを持つ集団。企業と違って交渉が通じるが、覚えているのは恩より恨みのほうだ。',
      stance: '企業の私兵とは撃ち合う。掃除屋には手を出さない——出した縄張りが、去年ひとつ消えている。',
    },
    {
      name: '掃除屋',
      blurb: '組織ではなく職業。企業が「なかったこと」にしたいときに呼ぶ。' +
        '制服は着ていない。制服でない方が、たちが悪い。',
      stance: '雇い主を選ばない。同じ相手に二度雇われないのが唯一の規則らしい。',
    },
    {
      name: '皇極重工',
      blurb: '**戦後の復興を請け負った財閥が、そのまま企業になった。** 重工と兵器と、そして送電。'
        + '焼けた送電網を引き直したのがこの会社で、以来ずっと返していない。'
        + 'この街の電気は最終的にここから来ていて、火曜の停電の理由を知っているのもここだけだ。',
      stance: 'メリディアンとは「棲み分け」ということになっている。'
        + '四十年代に三度撃ち合い、三度とも訴訟として和解した相手だ。'
        + '出自の違う会社どうしの不仲は、この街ができるより前から続いている。',
    },
    {
      name: 'ゼロコード',
      blurb: 'フリーランスのネットランナー集団。組織というより連絡先の束で、'
        + '名乗った者がその日のゼロコードになる。仕事は選ぶが、依頼主は選ばない。',
      stance: '企業から金を取り、企業の記録を抜く。ブラックノードを「政治をやりすぎ」と嫌っている。',
    },
    {
      name: 'ブラックノード',
      blurb: '過激派。信用スコアの制度そのものを壊すと言っている。'
        + '実際にやったのは区画一つぶんのスコア消去で、そのとき二百世帯が「存在しない人間」になった。',
      stance: '企業すべてが敵。労組からも距離を置かれている——助けたつもりの相手を消してしまったからだ。',
    },
    {
      name: 'ノマド氏族',
      blurb: '外環を走る車列。家族という単位で動き、街の与信を使わない。' +
        '街から出たい人間にとって、唯一の合法でない出口。',
      stance: '街の勢力とは取引だけ。与信を持たない人間を運べるのは、この街でここだけだ。',
    },
  ],

  figures: [
    { name: 'ハン', title: 'メリディアン22階', blurb: '受取人。何を受け取っているのかは、たぶん本人も知らない。' },
    { name: 'ミハイル・ヴァレン', title: 'ゲンテック元社員', blurb: '退職届の日付が、消えた三日後になっている。名簿の最後の行。退職日は空欄。' },
    { name: 'ケスラー', title: '掃除屋', blurb: '光学迷彩を入れている。一度だけ、輪郭がぶれる。二度目はない。' },
    { name: '組合のリン', title: '第4区画労働組合', blurb: '写真を四枚持ち歩いている。全員、第9温室の下層作業員だった。' },
    { name: 'ドク・アマリ', title: '闇医者横丁', blurb: '腕はいい。名前を訊かない。ただし三度目からは前金を要求する。' },
    { name: '「ゼロ」', title: 'ゼロコード', blurb: '固有名ではなく役どころ。今その名を使っているのが何人いるのか、本人たちも数えていない。' },
    { name: '灰原', title: '皇極重工・送電管理', blurb: '火曜の停電を毎週承認している。理由は知らされていない。書類に判を押すだけの役だ。' },
  ],

  names: {
    given: [
      'ハン', 'ケスラー', 'リン', 'アマリ', 'ミハイル', 'ノラ', 'ジン', 'サシャ', 'カイ', 'マレン',
      'ユウ', 'ドラゴ', 'エラ', 'タチ', 'ニカ', 'ロウ', 'ヴェラ', 'クロウ', 'シオ', 'ベン',
      'レナ', 'アズマ',
    ],
    family: [
      'ヴァレン', 'クロフト', 'ナカムラ', 'オルティス', 'ザイツェフ', 'ムーア', 'ハイダル',
      'リンドグレン', 'アバシ', 'ペレス', 'ヴォス', 'ハヤシ',
    ],
  },


  /* 年表。国が薄れて企業が濃くなっていく過程を、十年ごとに一段ずつ。
     最後の三つはこの街の話で、収録シナリオの背景になっている。 */
  timeline: [
    /* 企業が政府の仕事を引き受けた経緯は、戦後の復興まで遡る。
       ここは遊びには直接効かないが、「なぜ会社が国の代わりをしているのか」に
       答えられないと、この街の言い分が宙に浮く。 */
    { when: '1945年', what: '敗戦。国家の機構は形として残ったが、実務の大半は動かなくなった。復興を実際に担ったのは、瓦礫の側にいた企業だった。' },
    { when: '1950〜80年代', what: '東アジアの三つの国が、それぞれ別々に製造業で這い上がる。同盟ではない。互いを出し抜きながら、同じ坂を登った。' },
    { when: '1990年代', what: '復興を担った財閥が、返すはずだった権限を返さないまま制度に組み込まれる。「暫定」と書かれた条項が、二十年ぶんそのまま残った。' },
    { when: '2020年代', what: '世界経済が崩れ、国境より決算期のほうが重くなる。多国籍企業の格付けが、国債の格付けを上回りはじめた。' },
    { when: '2030年代', what: 'エネルギー危機とAIの実用化が同時に来た。新型電池の特許を数社が握り、電気が「買うもの」から「契約するもの」になる。' },
    { when: '2040年代', what: '企業が独立市を名乗りはじめる。企業間の武力衝突が三度あり、三度とも「訴訟」として処理された。' },
    { when: '2050年代', what: 'ネオ東京、ネオソウル、ネオカワサキが成立。信用スコアによる管理が、住民登録の代わりに定着する。' },
    { when: '2062年', what: 'ネオ東京の警察機構が解体され、区画ごとの警備契約に置き換わる。事件の初動は、以後ずっと私兵が担っている。' },
    { when: '2064年', what: '上層の気象制御が完成。三十階から上に雨が降らなくなった。下では降り方が変わった。' },
    { when: '2070年', what: 'メリディアン農政が第9温室で「収量改善試験」を開始。書類上はまだ続いている。' },
    { when: '2075年', what: '第4区画の火曜停電が始まる。企業は原因を公表していない。' },
    { when: '2080年', what: 'ゲンテックが37階の用途を「保守」から「保管」へ書き換える。設計図は差し替えられなかった。' },
    { when: '今年（2084年）', what: '第9温室で四人目。組合が外に頼ることを決めた。' },
  ],


  /* 区画。「どこにいるか」で空気も物価も、誰に見られているかも変わる。
     entry は入るのに要るもの——信用スコアの下限は standing の段位で書く。 */
  districts: [
    {
      id: 'spire', name: '上層（三十階より上）',
      air: '濾過済み。雨は降らない。匂いがしない',
      prices: '何もかも三倍。水一本が下層の一食ぶん', turf: 'メリディアン複合企業・皇極重工',
      entry: '社員証か、招待。信用スコア「企業級」がなければ、招かれても入口で止まる',
      blurb: '空が近い。窓は開かない。ここで働く人間は、下に降りるとき酸素マスクを持つ者もいる。',
    },
    {
      id: 'mid', name: '中層（十〜三十階）',
      air: '許容範囲。雨は斜めに降る',
      prices: '下層の一.五倍。そのぶん物は届く', turf: '各社の警備契約',
      entry: '信用スコア「良」以上。滞納が二期続くと居住権が消える',
      blurb: '中流の層。ここに部屋を持てるかどうかが、この街での「まとも」の境界線になっている。',
    },
    {
      id: 'ground', name: '下層（地上〜十階）',
      air: '酸性雨。屋根のない通りが多い',
      prices: 'この街の基準。物価表の数字はここのもの', turf: 'ノヴァ・ギャングと、企業の下請け警備',
      entry: '誰でも。ただし出るときにスコアを見られる',
      blurb: 'この街の大半。下水通り、闇医者横丁、ナイトマーケット。買えないものはここには無い。',
    },
    {
      id: 'abyss', name: '地下（ネオアビス）',
      air: '悪い。電力が不安定で、換気が止まる日がある',
      prices: '安い。ただし売っているものが違う', turf: '誰のものでもない',
      entry: '要らない。ただし出るときに身分がない',
      blurb: '旧地下鉄の駅と坑道に住み着いた人々。スコアを失った者の行き着く先で、同時に唯一、記録に残らない場所。',
    },
    {
      id: 'outer', name: '外環',
      air: '砂。乾いている。雨が降らない理由が上とは違う',
      prices: '金では買えないものが多い。物々交換が主', turf: 'ノマド氏族',
      entry: '車列に受け入れられること。金では買えない',
      blurb: '街の外。企業の記録から消えるかわり、水も薬も届かない。街を出たい人間にとって唯一の出口。',
    },
  ],


  /* 信用スコア。**設定であって、ルールではない。**
     段位も、そこで何が起きるかも決めてあるが、数値としては実装していない。
     持ち物や判定に変換しはじめると、遊ぶ側が管理する項目が一つ増えて
     卓が重くなる——この街の手触りを出すのに、そこまでは要らない。 */
  standing: {
    name: '信用スコア',
    blurb: 'この街で身分を証明するもの。名前は三つ持っていていいが、スコアが切れたら一つも使えない。'
      + '宿にも、医者にも、電車にも、まず信用が要る。金はその次だ。',
    tiers: [
      { name: '企業級', note: '上層に入れる。名前より肩書きが先に通る。同じものが安く買える' },
      { name: '良', note: '中層に部屋を持てる。企業地区に入る手続きが通る' },
      { name: '並', note: '下層で普通に暮らせる。中層は通れるが住めない' },
      { name: '底', note: '前金を求められる。中層より上には入れない' },
      { name: '存在しない', note: '宿も医者も断る。地下か外環にしか道がない' },
    ],
  },

  truths: [
    {
      title: '身分は肉体ではなく信用スコア',
      text: '名前は三つ持っていていい。スコアが切れたら一つも使えない。'
        + '段位は五つ——**企業級・良・並・底・存在しない**。並より下がると医者に前金を求められ、'
        + '底を割ると宿が断り、ゼロになると「その人はいない」ことになる。',
    },
    /* VR社会とAI司法は、設定として置くだけで仕組みにはしない。
       電脳を「住める場所」として書くと、今の——盗むか消すために入る倉庫という——
       ネットランの土台から作り直しになる。ここでは輪郭だけ決めて、
       確かめられないことのまま残す。 */
    {
      title: '裁くのはAIで、控訴先もAIだ',
      text: '量刑も、契約の解釈も、企業間の紛争も、機械が判断する。速く、安く、誰にも説明できない。'
        + '「なぜその判断になったのか」を問える窓口は、制度として用意されていない。'
        + '下層の人間がAI裁定に触れることはほとんどない——触れる前に、警備契約のほうが片をつけるからだ。',
    },
    {
      title: '肉体を捨てた人間がいるという話',
      text: '上層の一部は、生活のほとんどを仮想空間で送っているらしい。'
        + '**体を作りものに替えるのは、この街では珍しくない**——合成体は普通に歩いている。'
        + 'ここで噂になっているのはその先で、中身だけになって体を持たない者がいる、という話だ。'
        + 'そこまで来ると、下層では都市伝説の扱いになる。'
        + '確かめた人間がいないのではなく、**確かめられる立場の人間が下に降りてこない**。'
        + 'この街の噂の大半は、そういう理由で噂のままだ。',
    },
    {
      title: 'スコアがゼロの人間には、二つしか道がない',
      text: '地下（ネオアビス）に降りるか、外環のノマドに拾われるか。'
        + 'どちらも記録に残らないという一点で共通していて、それがこの街での唯一の自由でもある。',
    },
    {
      title: '会社は、返さなかっただけだ',
      text: '企業が国を倒したわけではない。**倒れたあとの仕事を引き受けて、返さなかった**というのが実際に起きたことで、'
        + '当の企業も否定しない。「では返しますか」と訊かれる場所が、制度としてどこにも用意されていないだけだ。',
    },
    {
      title: '大企業どうしの不仲には、百年ぶんの下地がある',
      text: '皇極は焼け跡から、メリディアンは大陸から、ゲンテックは半島から来た。'
        + '同じ坂を別々に登った三つの流れが、いまは同じ街で棚を分け合っている。'
        + 'この街で「棲み分け」と呼ばれているものは、和解ではなく休戦だ。',
    },
    {
      title: '読み書きは誰でもできる。紙のほうが珍しい',
      text: '端末が読み上げるので、識字はこの街では問題にならない。'
        + '逆に**紙に書かれたものには履歴が残らない**。だから紙は、記録を残したくない側と、'
        + '記録を消されたくない側の両方が使う。手書きの一枚が出てきたら、それは持ち主が本気だったという意味だ。',
    },
    { title: '警察は来る。企業のあとで', text: '事件の初動はその区画の警備契約を持つ会社が担う。公的な捜査は、来るとすれば、片付いた後だ。' },
    { title: '電脳は場所ではなく倉庫', text: '入るのは盗むか消すためで、住む場所ではない。長く居れば逆探知され、ブラックICEは本当に脳を焼く。' },
    { title: '体には上限がある', text: '改造は誰でも入れられるが、受け入れられる量を超えると手が震える。入れすぎた者は街に普通に歩いている。' },
    { title: '雨は上では降らない', text: '気象制御は上層の設備だ。下で降り方が変わったのは副作用で、直す予算はどの部署にもついていない。' },
    { title: '死体は処理される', text: '路上の死者は救急ではなく清掃が来る。身元の照会は与信から行われ、与信がなければ照会もされない。' },
    { title: '外環には与信が届かない', text: '街を出れば企業の記録から消えるが、水も薬も届かない。ノマドが家族という単位で動くのはそのためだ。' },
  ],

  /* 暦。こちらは旧世界のものをそのまま使っている——ただし何を数えるかは変わった。
     「今は何年か」を決めておかないと、年表の逆算がずれる。現在は2084年。 */
  calendar: {
    name: '暦と季節',
    blurb: '**現在は2084年**。暦は旧世界のまま——一年365日、十二ヶ月、七日で一週。'
      + 'ただし下層で意味を持つのは月ではなく、**与信の締め日**だ。'
      + '月末に更新が走り、そこで段位が下がった人間が翌週から街に出てこなくなる。',
    seasons: [
      {
        name: '春（3〜5月）', months: [],
        note: '気象制御の切り替えで、上層は最初に晴れる。下層はこの時期いちばん雨が長い。'
          + '企業の年度が四月に変わるので、契約の切れる人間が一斉に出る。',
      },
      {
        name: '夏（6〜8月）', months: [],
        note: '下層の熱がこもる。冷却の効かない区画では夜に人が出て、昼に寝る。'
          + '停電が増えるのもこの三ヶ月——第4区画の火曜の三分は年じゅう変わらないので、'
          + 'ここで増えるのは予告のないほうだ。それを見越した仕事が回る。',
      },
      {
        name: '秋（9〜11月）', months: [],
        note: '雨が弱まる、唯一まともに外を歩ける時期。企業の中間決算があり、監査と口封じが増える。',
      },
      {
        name: '冬（12〜2月）', months: [],
        note: '上層は降らせない。下層は降る。凍死は毎年出るが、統計には「与信のある死者」しか載らない。',
      },
    ],
    extra: {
      name: '締め日',
      note: '毎月の最終日。与信の再計算が走り、段位が動く。'
        + '医者も宿もこの日を基準に見るので、月末の三日間だけ値段の付き方が変わる。'
        + '下層で「来月」と言えば、たいてい締め日の向こう側という意味だ。',
    },
    hint: '締め日の直前は誰もが金を要る。依頼の受け手を探すなら、その三日間がいちばん安い。',
  },

  economy: {
    unit: '€$',
    note: '€$20 でカプセルに一泊、€$400 で下層のひと月。運び屋の一件が €$200、金庫室が €$3,000。'
      + '外骨格スーツが €$2,500 なのは、それが「一生ぶんの仕事」の値段だからだ。',
    anchors: [
      { what: 'カプセルホテル（一泊）', cost: 20 },
      { what: 'まともな部屋（一泊）', cost: 60 },
      { what: '合成食（3日分）', cost: 15 },
      { what: '下層のひと月の家賃', cost: 400 },
      { what: '闇医者の縫合（一回）', cost: 120 },
      { what: '運び屋の一件', cost: 200 },
      { what: '護衛・逃走の一件', cost: 1500 },
      { what: '金庫室（山分け前）', cost: 3000 },
      { what: '与信の再発行（正規）', cost: 5000 },
    ],
  },

  tables: [
    {
      id: 'rumor', name: '街で流れている話', hint: '出どころは大抵ナイトマーケットか、闇医者の待合室。',
      entries: [
        '第9温室でまた一人。これで五人目だが、公式には二人目だ。',
        'メリディアンが警備会社を替えた。前の会社の社員が、まるごと消えている。',
        '第4区画の停電が、来週から四分になるらしい。',
        'ゲンテックの37階が閉鎖された。中の人間ごと。',
        '外環でノマドの車列が一つ、燃えているのが見つかった。生存者なし。',
        '闇医者横丁で、新しい改造が出回っている。安い。安すぎる。',
        '与信が一斉に切られた区画がある。二百世帯。理由は「事務手続き」。',
        '掃除屋が二人組で動いている。前は一人だった。',
        'ブラックICEを踏んで、生きて戻った奴がいるらしい。喋れないが。',
        '雨が三日止まった区画がある。上で何かを作っている。',
        '組合の事務所に鍵がかかっていた。移転の張り紙もなかった。',
        '警察が本当に来た事件があった。企業が絡んでいなかったからだ。',
        '上層の誰かが「もう体を使っていない」という話。三人から聞いたが、三人とも別の名前を言った。',
        'AI裁定の記録が一件だけ流出した。読んだ人間が言うには、理由の欄が空白だったらしい。',
      ],
    },
    {
      id: 'street', name: '路地で起きること', hint: '移動や待ち時間に一つ。半分は無害だ。',
      entries: [
        '雨が急に強くなる。次の軒先まで、走るか濡れるか。',
        '監視ドローンが低空でついてくる。三分ほど。',
        '露天商が声をかけてくる。売り物はどう見ても盗品だ。',
        '子どもが袖を引く。財布はもう無い。',
        '道の先で人だかり。誰かが倒れている。誰も救急を呼んでいない。',
        '自販機が壊れていて、押すと出てくる。防犯カメラが真上にある。',
        '知らない番号から着信。切ると、すぐまた鳴る。',
        '路上ライブ。歌はうまい。人だかりが視界を塞いでいる。',
        '企業の私兵が二人、区画の入口に立っている。今日はいなかったはずだ。',
        'ネオンの一区画が消えている。停電ではなく、看板だけが。',
        '同じ顔とすれ違う。二度目だ。',
        '何も起きない。ただ、雨の匂いが薬品に変わっている。',
      ],
    },
    {
      id: 'job', name: '仲介人が持ってくる仕事', hint: '報酬は €$。前金は半分もらえたら上等。',
      entries: [
        '荷物を一つ、22階まで。中身は聞くな。€$200。',
        '証人を一人、朝までに街の外へ。€$1,500。',
        '第4区画の金庫室。停電は三分。€$3,000、山分け。',
        '弟を探してほしい。会社は「退職した」と言っている。€$800。',
        '第9温室で人が死んでいる理由を持ち帰ってほしい。€$400。',
        'ある社員の与信を、一時間だけ止めてほしい。€$1,200。',
        '記録を一件消す。バックアップも。€$2,000。',
        '外環まで車を一台。積荷は開けるな。€$600。',
        '闇医者に薬を届ける。追われている。€$350。',
        'この写真の男が、今夜どこにいるか知りたい。それだけでいい。€$500。',
      ],
    },
    {
      id: 'complication', name: '失敗したときの余波', hint: '失敗が何も生まないと、緊張が消える。',
      entries: [
        '顔が記録された。次にこの区画に入るとき効いてくる。',
        '改造が一つ、調子を崩す。次の休憩まで判定が鈍い。',
        '与信に傷。買い物と宿泊で追加の説明が要る。',
        '時間を食った。予定より一時間遅い。',
        '追跡がついた。まだ距離はある。',
        '弾を撃った。音を聞いた人間がいる。',
        'デッキが熱を持つ。次のネットランは痕跡が1多い状態で始まる。',
        '仲介人に伝わった。次の仕事の報酬が下がる。',
      ],
    },
    {
      id: 'netrun', name: '電脳の中で見つかるもの', hint: '層を抜けたときの追加の収穫に。',
      entries: [
        '削除済みの人事記録。退職日が全員同じ日付になっている。',
        '発注書の束。同じ薬品が、月ごとに増えている。',
        '見取り図。非常階段が一本、図面にない。',
        '監視カメラの生映像。いま自分が映っている。',
        '他人のセッションが開きっぱなし。誰かが慌てて出ていった跡だ。',
        '社内の告発メール。三回転送されて、そこで止まっている。',
        '警備の巡回表。今日だけ人数が倍になっている。',
        '自分の名前が入った照会履歴。日付は昨日。',
      ],
    },
  ],
};

export const neon = {
  id: 'neon',
  name: 'ネオンの雨',
  tagline: '企業の街で、名前を売る',
  blurb: '雨はいつも降っている。上の階まで届く前に、看板の光で色がつく。',
  icon: '🌃',

  theme: {
    '--ink': '#dbe7f2',
    '--ink-dim': '#8ba3bd',
    '--ink-faint': '#5b7089',
    '--bg': '#05070e',
    '--bg-2': '#0a0f1c',
    '--panel': '#0f1626',
    '--panel-2': '#152034',
    '--line': '#1e3350',
    '--gold': '#3ce0e0',          // 主アクセント：シアン
    '--gold-dim': '#1d7d84',
    '--blood': '#ff4d6d',
    '--leaf': '#4ade80',
    '--sky': '#60a5fa',
    '--violet': '#ff5fd2',        // 副アクセント：マゼンタ
    '--display': '"Hiragino Sans", "Noto Sans JP", "Segoe UI", system-ui, sans-serif',
  },

  labels: {
    ancestry: '出自',
    klass: '役割',
    background: '経歴',
    spell: 'プログラム',
    spellPlural: 'プログラム',
    spellSlot: 'メモリ',
    cantrip: '常駐',
    caster: 'プログラム実行',
    party: 'チーム',
    adventure: '仕事',
    enemy: '敵',
    gold: '残高',
    goldUnit: '€$',
    hitDice: '回復リソース',
    strain: '適合度',
  },

  startingGold: 600,

  abilities: ABILITIES,
  skills: SKILLS,
  ancestries: ORIGINS,
  classes: ROLES,
  backgrounds: BACKGROUNDS,
  weapons: WEAPONS,
  armors: ARMORS,
  shield: SHIELD,
  items: ITEMS,
  spells: PROGRAMS,
  classSpells: ROLE_PROGRAMS,
  monsters: ENEMIES,
  augments: AUGMENTS,
  enemyIcons: { 人型: '🕴️', 機械: '🤖', 電子: '👾', 獣: '🐕', 重装: '🦾' },
  portraits: { solo: '🕶️', runner: '🥷', netrunner: '💻', medtech: '💉', techie: '🔧' },
  lore: LORE,
};

export default neon;
