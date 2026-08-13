/* 特性 — 「書いてあることは効く」を保証するための層。

   世界データ（js/worlds/*.js）は特性を id と表示文で宣言する:

     traits: [{ id: 'pack', text: '連携射撃：味方が隣接する相手への攻撃に有利' }]

   表示文は世界ごとに変えてよい。ファンタジーの狼は「群れ戦術」、企業の警備兵は
   「連携射撃」と名乗るが、効くものは同じ `pack` である。以前は日本語の文字列を
   コード側が照合していたため、名前を変えた瞬間に黙って効かなくなっていた。

   ここは純粋なデータと関数だけで、rules.js も combat.js も読まない。判定や
   セーヴが要る特性は、呼び出し側から ctx で渡してもらう（循環 import を避ける
   ためであり、同時に「特性はルールを知らない」という切り分けでもある）。

   kind の意味:
     passive … 作成時に平の数値へ畳み込まれる（HP、抵抗、技能の有利など）
     combat  … 戦闘中のフックで効く
     active  … 戦闘の行動として選べる
     flavor  … 描写のみ。今のエンジンに土台が無いもの（位置取り・光源など）
               ルールのように読めてしまう文は、flavor にせず文面を直すこと。 */

/* ------------------------------------------------------------ 正規化 */

/** 特性の宣言を {id, text, def} に揃える。素の文字列は描写扱い。 */
export function normalizeTrait(trait) {
  if (!trait) return null;
  if (typeof trait === 'string') return { id: null, text: trait, def: null };
  const def = trait.id ? TRAITS[trait.id] || null : null;
  return { id: trait.id || null, text: trait.text || def?.name || '', def };
}

/** 生き物が持つ特性の一覧。id の付いていないものも表示のために残す。 */
export function traitList(entity) {
  return (entity?.traits || []).map(normalizeTrait).filter(Boolean);
}

export const hasTrait = (entity, id) => traitList(entity).some(t => t.id === id);

/** 定義つきの特性だけを、フック名で絞って返す。 */
const withHook = (entity, hook) =>
  traitList(entity).filter(t => typeof t.def?.[hook] === 'function');

export const isFlavor = trait => normalizeTrait(trait)?.def?.kind === 'flavor';

/* ------------------------------------------------------------ 受動効果 */

const EMPTY_PASSIVES = () => ({
  hpPerLevel: 0, initiativeBonus: 0, extraSkills: 0, gold: 0,
  grantSkills: [], resistances: [], immunities: [], conditionImmunities: [],
  saveAdvantageVs: [], skillAdvantage: [],
});

/** 受動特性を、ルール層が読む平の数値と配列にまとめる。 */
export function traitPassives(entity) {
  const out = EMPTY_PASSIVES();
  for (const { def } of traitList(entity)) {
    const p = def?.passive;
    if (!p) continue;
    out.hpPerLevel += p.hpPerLevel || 0;
    out.initiativeBonus += p.initiativeBonus || 0;
    out.extraSkills += p.extraSkills || 0;
    out.gold += p.gold || 0;
    for (const key of ['grantSkills', 'resistances', 'immunities', 'conditionImmunities',
      'saveAdvantageVs', 'skillAdvantage']) {
      if (p[key]) out[key] = [...new Set([...out[key], ...p[key]])];
    }
  }
  return out;
}

/* ------------------------------------------------------------ 戦闘フック */

/**
 * 攻撃側の特性。有利・不利と、ログに出す但し書きを返す。
 * @param {object} ctx {self, target, combat}
 */
export function traitAttackMods(ctx) {
  const out = { advantage: false, disadvantage: false, pierce: false, notes: [] };
  for (const t of withHook(ctx.self, 'attack')) {
    const r = t.def.attack({ ...ctx, trait: t });
    if (!r) continue;
    if (r.advantage) out.advantage = true;
    if (r.disadvantage) out.disadvantage = true;
    if (r.pierce) out.pierce = true;
    if (r.note) out.notes.push(r.note);
  }
  return out;
}

/**
 * 被弾時の特性。ダメージを書き換えて返す。一度きりのものはここで使い切る。
 * @param {object} ctx {self, attacker, amount, type, combat}
 */
export function traitAbsorb(ctx) {
  let amount = ctx.amount;
  const notes = [];
  for (const t of withHook(ctx.self, 'absorb')) {
    const r = t.def.absorb({ ...ctx, amount, trait: t });
    if (!r) continue;
    if (typeof r.amount === 'number') amount = Math.max(0, r.amount);
    if (r.note) notes.push(r.note);
  }
  return { amount, notes };
}

/**
 * 倒れた瞬間の特性。true を返せば踏みとどまる。
 * @param {object} ctx {self, combat, save(ability, dc)}
 */
export function traitSurvive(ctx) {
  for (const t of withHook(ctx.self, 'survive')) {
    const r = t.def.survive({ ...ctx, trait: t });
    if (r?.survived) return r;
  }
  return null;
}

/**
 * 自分の手番の頭で動く特性。増援や士気はここ。
 * @param {object} ctx {self, combat}
 */
export function traitTurnStart(ctx) {
  const events = [];
  for (const t of withHook(ctx.self, 'turnStart')) {
    const r = t.def.turnStart({ ...ctx, trait: t });
    if (r) events.push(r);
  }
  return events;
}

/** 戦闘の行動として選べる特性。 */
export function traitActions(entity) {
  return traitList(entity).filter(t => t.def?.action).map(t => ({ ...t, action: t.def.action }));
}

/* 味方が生きているあいだ効く特性（号令など）を、味方側から探す。 */
export function auraFrom(allies, id) {
  return (allies || []).some(a => a.hp > 0 && !a.dead && hasTrait(a, id));
}

/* ------------------------------------------------------------- 定義 */

export const TRAITS = {

  /* ---------------------------------------------------------- 敵の戦術 */

  pack: {
    name: '群れ戦術', kind: 'combat',
    /* alliesOf は自分を除いた「まだ立っている仲間」。一人でも残っていれば
       挟み込める、という読み方をする。最後の一匹になったら有利は消える。 */
    attack: ({ self, combat }) => {
      const allies = combat?.alliesOf?.(self) || [];
      return allies.length >= 1 ? { advantage: true, note: '群れ' } : null;
    },
  },

  rally: {
    name: '号令', kind: 'combat',
    /* 効果は「味方に」乗るので、攻撃側の判定は combat 側で auraFrom を見る。
       頭目が立っているうちは配下の攻撃が有利になり、頭目を先に潰す価値が出る。 */
  },

  cowardly: {
    name: '臆病', kind: 'combat',
    turnStart: ({ self, combat }) => {
      const allies = combat?.alliesOf?.(self) || [];
      const standing = allies.filter(a => a.hp > 0 && !a.dead).length + 1;
      const total = (combat?.sideOf?.(self) || []).length;
      if (total < 2 || standing > total / 2) return null;
      if (self.hp > self.maxHp / 2) return null;
      return { flee: true, text: `${self.name}は戦意を失って逃げ出した。` };
    },
  },

  callBackup: {
    name: '通報', kind: 'combat',
    turnStart: ({ self, combat }) => {
      if (self.calledBackup || (combat?.round || 0) < 3) return null;
      self.calledBackup = true;
      return { reinforce: self.backupId || null, text: `${self.name}が応援を呼んだ。` };
    },
  },

  undeadFortitude: {
    name: '不死の頑健さ', kind: 'combat',
    survive: ({ self, save }) => {
      if (self.fortitudeUsed) return null;
      const st = save?.('con', 10);
      if (!st?.success) return null;
      self.fortitudeUsed = true;
      return { survived: true, text: `${self.name}は倒れなかった。まだ動いている。` };
    },
  },

  wardOnce: {
    name: '加護', kind: 'combat',
    absorb: ({ self, amount }) => {
      if (self.wardUsed || amount <= 0) return null;
      self.wardUsed = true;
      return { amount: Math.floor(amount / 2), note: `${self.name}を黒い光が包み、傷が半分になった` };
    },
  },

  cloakOnce: {
    name: '光学迷彩', kind: 'combat',
    absorb: ({ self, amount }) => {
      if (self.cloakUsed || amount <= 0) return null;
      self.cloakUsed = true;
      return { amount: 0, note: `${self.name}の輪郭がぶれ、攻撃は像を切っただけだった` };
    },
  },

  lightSensitive: {
    name: '光への弱さ', kind: 'combat',
    /* 明るさの系は無いが、灯りを持ち歩いているかは分かる。松明を掲げていれば
       この手の相手は狙いを外す——プレイヤーが持ち物で戦況を変えられる。 */
    attack: ({ self, combat }) => {
      const foes = combat?.foesOf?.(self) || [];
      const lit = foes.some(f => f.hp > 0 && (f.inventory || []).some(i => i.light && i.count > 0));
      return lit ? { disadvantage: true, note: '灯りが目を灼く' } : null;
    },
  },

  fearImmune: {
    name: '痛覚遮断', kind: 'passive',
    passive: { conditionImmunities: ['frightened'] },
  },

  lethalIce: {
    name: '致死設定', kind: 'combat',
    /* 電脳の防壁が接続者の脳を直接焼く。肉体側の抵抗も装甲も間に入らない。 */
    attack: () => ({ pierce: true, note: '防壁が思考を直に灼く' }),
  },

  /* ------------------------------------------------------ 種族・出自（受動） */

  versatile: { name: '多才', kind: 'passive', passive: { extraSkills: 1 } },

  keenSenses: { name: '鋭敏な感覚', kind: 'passive', passive: { grantSkills: ['perception'] } },
  corpSpeak: { name: '社内語', kind: 'passive', passive: { grantSkills: ['corpo'] } },
  streetSense: { name: '土地勘', kind: 'passive', passive: { grantSkills: ['streetwise'] } },
  roadLife: { name: '車上生活', kind: 'passive', passive: { grantSkills: ['drive'] } },
  research: { name: '基礎研究', kind: 'passive', passive: { grantSkills: ['datalore'] } },

  feyBlood: {
    name: '妖精の血', kind: 'passive',
    passive: { conditionImmunities: ['charmed'], saveAdvantageVs: ['charmed'] },
  },
  stoutFolk: {
    name: '頑健', kind: 'passive',
    passive: { hpPerLevel: 1, saveAdvantageVs: ['poisoned'] },
  },
  toxinTolerance: {
    name: '汚染耐性', kind: 'passive',
    passive: { saveAdvantageVs: ['poisoned'] },
  },
  syntheticBody: {
    name: '非生物代謝', kind: 'passive',
    passive: { immunities: ['毒'], conditionImmunities: ['poisoned'], saveAdvantageVs: ['poisoned'] },
  },
  dragonScales: {
    name: '竜鱗', kind: 'passive',
    passive: { resistances: ['火'] },
  },
  hellishResilience: {
    name: '地獄の抵抗', kind: 'passive',
    passive: { resistances: ['火'] },
  },
  combatDrilled: { name: '戦闘訓練', kind: 'passive', passive: { hpPerLevel: 1 } },
  situationalAwareness: { name: '状況把握', kind: 'passive', passive: { initiativeBonus: 2 } },
  credit: { name: '与信', kind: 'passive', passive: { gold: 250 } },

  analytic: { name: '解析癖', kind: 'passive', passive: { skillAdvantage: ['tech'] } },
  fleetFoot: { name: '逃げ足', kind: 'passive', passive: { skillAdvantage: ['athletics'] } },
  nimble: { name: '身軽', kind: 'passive', passive: { skillAdvantage: ['acrobatics'] } },
  stoneCunning: { name: '石工の目', kind: 'passive', passive: { skillAdvantage: ['investigation'] } },

  lucky: {
    name: '幸運', kind: 'passive',
    /* 出目1の振り直し。判定・セーヴ・攻撃のどれでも、休憩ごとに一度。
       rules.js が rerollNatural1 経由で見る。 */
    passive: {},
    rerollNatural1: true,
  },

  /* ------------------------------------------------------------ 能動 */

  dragonBreath: {
    name: '竜の吐息', kind: 'active',
    action: {
      name: '竜の吐息（範囲）', uses: 1, rest: 'short',
      damage: '2d6', type: '火', save: 'dex', area: true,
      text: '{name}は息を吸い込み、細く長く吐き出した。',
    },
  },

  /* ------------------------------------------------------------ 描写のみ */

  darkvision: { name: '夜目', kind: 'flavor' },
  spiderClimb: { name: '蜘蛛歩き', kind: 'flavor' },
  emplaced: { name: '固定', kind: 'flavor' },
  netOnly: { name: '電脳内のみ', kind: 'flavor' },
  nonStandard: { name: '規格外', kind: 'flavor' },
};

/** 出目1を振り直せるか。使い切りは呼び出し側が luckUsed で管理する。 */
export const canRerollOnes = entity =>
  traitList(entity).some(t => t.def?.rerollNatural1);
