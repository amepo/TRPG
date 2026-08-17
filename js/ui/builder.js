/* Character creation and party assembly.

   Three ways in: use the pregenerated four, roll a quick random character,
   or walk the five-step builder. Anything created here can be saved and
   reused by both solo play and the session tool. */

import { el, frag, clear, toast, openSheet, closeSheet, field, button, signed } from './dom.js';
import { partyList, openCharacterSheet } from './sheet.js';
import {
  createCharacter, pregeneratedParty, POINT_BUY_BUDGET, pointsSpent, pointCost,
  STANDARD_ARRAY, rollAbilities, reviveCharacter, skillBudget,
} from '../core/character.js';
import { ANCESTRIES, CLASSES, BACKGROUNDS, CLASS_SPELLS, spellById, label } from '../core/content.js';
import { traitList } from '../core/traits.js';
import { randomName } from '../core/lore.js';
import { activeWorld, DEFAULT_WORLD } from '../worlds/index.js';
import { ABILITIES, ABILITY_IDS, abilityMod, abilityName, SKILLS, skillById, skillName } from '../core/rules.js';
import { Rng } from '../core/rng.js';
import { listCharacters, putCharacter, deleteCharacter } from '../core/store.js';

/* 名前は世界のもの。読み物に名簿があればそこから、無ければこの控えから。
   企業の街でガレスやイレーヌが出てくると、それだけで嘘になる。 */
const FALLBACK_NAMES = [
  'アルド', 'ミラ', 'ケイン', 'セラ', 'ドラン', 'ユナ', 'テオ', 'リサ', 'ノラ', 'グレン',
];
const pickName = rng => randomName(rng) || rng.pick(FALLBACK_NAMES);

/* ---------------------------------------------------------- party picker */

/**
 * Screen for choosing who goes on the adventure.
 * @param {HTMLElement} root
 * @param {object} opts {onReady(party), app, title}
 */
export function partyScreen(root, { onReady, app, title = '一行を決める' }) {
  let party = [];

  const render = () => {
    clear(root).append(el('div', { class: 'stack' }, [
      el('div', { class: 'card stack' }, [
        el('h2', { class: 'card__title', text: title }),
        el('p', { class: 'muted tiny', text: '1〜4人。すぐ遊ぶなら「おまかせ4人」が確実。' }),
        el('div', { class: 'row' }, [
          button('おまかせ4人', () => { party = pregeneratedParty(); render(); }, 'btn btn--primary grow'),
          button('ランダム1人', () => { if (guard()) { party.push(randomCharacter()); render(); } }, 'btn grow'),
        ]),
        el('div', { class: 'row' }, [
          button('じっくり作る', () => { if (guard()) openBuilder(c => { party.push(c); render(); }); }, 'btn grow'),
          button('保存済みから', () => { if (guard()) openSaved(c => { party.push(c); render(); }); }, 'btn grow'),
        ]),
      ]),

      party.length ? el('div', { class: 'card stack' }, [
        el('div', { class: 'spread' }, [
          el('h3', { class: 'card__title', text: `一行（${party.length}人）` }),
          button('全員はずす', () => { party = []; render(); }, 'btn btn--sm btn--ghost'),
        ]),
        el('div', { class: 'party' }, party.map((pc, index) => el('div', { class: 'row', style: { gap: '6px' } }, [
          el('div', { class: 'grow' }, [
            el('button', { class: 'pc', onclick: () => openCharacterSheet(pc, { canShop: true, onChange: render }) }, [
              el('span', { class: 'pc__face', text: pc.portrait }),
              el('span', { class: 'pc__body' }, [
                el('span', { class: 'pc__name', text: pc.name }),
                el('span', { class: 'tiny faint', text: `${classOf(pc)}／${ancestryOf(pc)}　HP${pc.maxHp} AC${pc.ac}` }),
              ]),
            ]),
          ]),
          el('button', { class: 'btn btn--sm', onclick: () => { putCharacter(pc); toast('保存しました'); } }, ['保存']),
          el('button', { class: 'btn btn--sm btn--danger', onclick: () => { party.splice(index, 1); render(); } }, ['×']),
        ]))),
      ]) : el('p', { class: 'muted center tiny', text: 'まだ誰もいない。' }),

      el('button', {
        class: 'btn btn--primary btn--block',
        disabled: !party.length,
        onclick: () => onReady(party),
      }, ['この一行で始める']),
    ]));
  };

  const guard = () => {
    if (party.length >= 4) { toast('一行は4人までです'); return false; }
    return true;
  };

  render();
}

const classOf = pc => CLASSES.find(c => c.id === pc.classId)?.name || pc.classId;
const ancestryOf = pc => ANCESTRIES.find(a => a.id === pc.ancestryId)?.name || pc.ancestryId;

/* --------------------------------------------------------------- random */

export function randomCharacter(rng = new Rng()) {
  const klass = rng.pick(CLASSES);
  const ancestry = rng.pick(ANCESTRIES);
  const background = rng.pick(BACKGROUNDS);
  /* いちばん高い数字はクラスが欲しがるところへ、残りだけを混ぜる。
     六つまとめて混ぜていた頃は、敏捷8の盗剣士が普通に出てきていた——
     コメントには「best score」と書いてあったのに、そうなっていなかった。 */
  const [best, ...rest] = [...STANDARD_ARRAY].sort((a, b) => b - a);
  const scores = [best, ...rng.shuffle(rest)];
  const order = [klass.primary, ...ABILITY_IDS.filter(id => id !== klass.primary)];
  const abilities = {};
  order.forEach((id, i) => { abilities[id] = scores[i]; });

  const skills = rng.shuffle(klass.skillList).slice(0, skillBudget(klass, ancestry));
  const spells = (CLASS_SPELLS[klass.id] || []).slice(0, klass.caster ? 3 : 0);

  return createCharacter({
    name: pickName(rng),
    classId: klass.id, ancestryId: ancestry.id, backgroundId: background.id,
    abilities, skills, spells,
    expertise: klass.expertiseChoices ? skills.slice(0, klass.expertiseChoices) : [],
  });
}

/* -------------------------------------------------------------- builder */

/** The step-by-step creator, in a sheet. @param {(c:object)=>void} onDone */
export function openBuilder(onDone) {
  const draft = {
    name: '',
    classId: CLASSES[0].id,
    ancestryId: ANCESTRIES[0].id,
    backgroundId: BACKGROUNDS[0].id,
    abilities: Object.fromEntries(ABILITY_IDS.map(id => [id, 8])),
    skills: [],
    expertise: [],
    spells: [],
    mode: 'point',                    // point | array | roll
    rolled: null,
  };
  let step = 0;

  const steps = [
    { title: label('ancestry', '種族'), render: () => stepAncestry(draft, refresh) },
    { title: label('klass', 'クラス'), render: () => stepClass(draft, refresh) },
    { title: '能力値', render: () => stepAbilities(draft, refresh) },
    { title: `技能と${label('background', '経歴')}`, render: () => stepSkills(draft, refresh) },
    { title: '仕上げ', render: () => stepFinish(draft, refresh) },
  ];

  function refresh() {
    const current = steps[step];
    openSheet(`キャラクター作成 — ${current.title}（${step + 1}/${steps.length}）`, frag(
      current.render(),
      el('div', { class: 'row', style: { marginTop: '18px' } }, [
        step > 0 ? button('戻る', () => { step--; refresh(); }, 'btn grow') : null,
        step < steps.length - 1
          ? button('次へ', () => { if (validate()) { step++; refresh(); } }, 'btn btn--primary grow')
          : button('この人物で決定', () => finish(), 'btn btn--primary grow'),
      ]),
    ));
  }

  function validate() {
    if (step === 2 && draft.mode === 'point' && pointsSpent(draft.abilities) > POINT_BUY_BUDGET) {
      toast('ポイントを使いすぎています'); return false;
    }
    return true;
  }

  function finish() {
    const klass = CLASSES.find(c => c.id === draft.classId);
    const budget = skillBudget(klass, ANCESTRIES.find(a => a.id === draft.ancestryId));
    if (draft.skills.length > budget) draft.skills = draft.skills.slice(0, budget);
    const character = createCharacter(draft);
    closeSheet();
    onDone(character);
  }

  refresh();
}

function stepAncestry(draft, refresh) {
  return el('div', { class: 'stack' }, ANCESTRIES.map(a => el('button', {
    class: 'tile', 'aria-pressed': draft.ancestryId === a.id,
    style: draft.ancestryId === a.id ? { borderColor: 'var(--gold)' } : {},
    onclick: () => { draft.ancestryId = a.id; refresh(); },
  }, [
    el('div', { class: 'tile__head' }, [
      el('span', { class: 'tile__name', text: a.name }),
      el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: bonusText(a.bonus) }),
    ]),
    el('div', { class: 'tile__desc', text: a.blurb }),
    el('div', { class: 'tiny faint', text: traitList(a).map(t => t.text).join('／') }),
  ])));
}

function stepClass(draft, refresh) {
  return el('div', { class: 'stack' }, CLASSES.map(c => el('button', {
    class: 'tile', 'aria-pressed': draft.classId === c.id,
    style: draft.classId === c.id ? { borderColor: 'var(--gold)' } : {},
    onclick: () => { draft.classId = c.id; draft.skills = []; draft.spells = (CLASS_SPELLS[c.id] || []).slice(0, 3); refresh(); },
  }, [
    el('div', { class: 'tile__head' }, [
      el('span', { class: 'tile__name', text: c.name }),
      el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: `HP${c.hpBase} ${c.hitDie}` }),
    ]),
    el('div', { class: 'tile__desc', text: c.blurb }),
    el('div', { class: 'tiny faint', text: `主能力 ${ABILITIES.find(a => a.id === c.primary)?.name}／${c.features[0].name}` }),
  ])));
}

/* 能力値の画面。ここは最初に遊ぶ人がいちばん詰まる場所だった——
   「数字の後ろの (-1) は何？」「8が0点で15が9点ってどういうこと？」。
   どちらも画面のどこにも書いていなかった。書いてある前提で作らない。

   出すのは三つ。(1) 判定で使うのは能力値ではなく修正値であること、
   (2) 修正値がどう決まるかの目盛り、(3) ポイントの値段表。 */
const MODES = [
  { id: 'point', label: 'ポイント割り振り', note: `${POINT_BUY_BUDGET}点を6つの能力値に配ります。迷ったら、これ。` },
  { id: 'array', label: '標準配列', note: `決まった6つの数字（${STANDARD_ARRAY.join('・')}）を並べ替えて使います。速い。` },
  { id: 'roll', label: 'ダイスで決める', note: '4d6から低い1個を捨てて6回。強い人も弱い人も出ます。運任せ。' },
];

/* 修正値の目盛り。「2上がるごとに+1」を言葉で書くより、並べたほうが早い。 */
const MOD_SCALE = [8, 10, 12, 14, 16, 18];

/** ポイントの値段表。8が0点、15が9点——その「0」と「9」を実際に並べて見せる。 */
const costTable = () => el('div', { class: 'costs' }, [
  el('div', { class: 'costs__row costs__row--head' }, [
    el('span', { class: 'costs__label', text: '能力値' }),
    ...[8, 9, 10, 11, 12, 13, 14, 15].map(score => el('span', { text: String(score) })),
  ]),
  el('div', { class: 'costs__row' }, [
    el('span', { class: 'costs__label', text: '必要な点' }),
    ...[8, 9, 10, 11, 12, 13, 14, 15].map(score => el('span', { text: String(pointCost(score)) })),
  ]),
]);

function stepAbilities(draft, refresh) {
  const spent = pointsSpent(draft.abilities);
  const left = POINT_BUY_BUDGET - spent;
  const ancestry = ANCESTRIES.find(a => a.id === draft.ancestryId);
  const klass = CLASSES.find(c => c.id === draft.classId);
  const point = draft.mode === 'point';

  const modeRow = el('div', { class: 'chips' }, MODES.map(m => el('button', {
    class: `chip ${draft.mode === m.id ? 'is-on' : ''}`,
    onclick: () => {
      draft.mode = m.id;
      if (m.id === 'array') ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = STANDARD_ARRAY[i]; });
      if (m.id === 'roll') { draft.rolled = rollAbilities(); ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = draft.rolled[i]; }); }
      if (m.id === 'point') ABILITY_IDS.forEach(a => { draft.abilities[a] = 8; });
      refresh();
    },
  }, [m.label])));

  /* 判定の仕組み。能力値そのものは振らない、という一点だけを繰り返す。 */
  const primer = el('div', { class: 'card card--flat stack', style: { gap: '7px' } }, [
    el('p', { class: 'tiny', text: '判定で振るのは d20（20面ダイス）1個。そこに足すのが、下の数字の隣に出ている修正値です。' }),
    el('p', { class: 'tiny muted', text: '能力値そのものは足しません。敏捷14（修正値+2）なら、隠れるときは 出目+2。合計が目標値以上で成功。' }),
    el('div', { class: 'modscale' }, MOD_SCALE.map(score => el('div', { class: 'modscale__cell' }, [
      el('div', { class: 'modscale__score', text: String(score) }),
      el('div', { class: 'modscale__mod', text: signed(abilityMod(score)) }),
    ]))),
    el('p', { class: 'tiny faint', text: '10と11が ±0 の基準。そこから2上がるごとに修正値が+1、2下がるごとに−1になります。' }),
  ]);

  const mode = MODES.find(m => m.id === draft.mode);
  const modeNote = el('p', { class: 'tiny faint', text: mode?.note || '' });

  /* 種族の加算。「+2は上限が2高いということ？」と訊かれて足した説明。
     上限も上がるが、それは結果であって、加算は買った値すべてに乗る。
     8を買っても10になる、を先に言っておく。 */
  const bonuses = ABILITIES.filter(a => ancestry.bonus?.[a.id]);
  const first = bonuses[0];
  const ancestryNote = first ? el('p', { class: 'tiny faint', text:
    `${ancestry.name}は ${bonuses.map(a => `${a.name}+${ancestry.bonus[a.id]}`).join('・')}。`
    + `これは決めた値に足されます——${first.name}を8にしても${8 + ancestry.bonus[first.id]}になり、`
    + `上限も同じだけ上がります。` }) : null;

  /* 残りポイントと値段表。ここが「8が0点、15が9点」の答えそのもの。 */
  const budget = point ? el('div', { class: 'card card--flat stack', style: { gap: '7px' } }, [
    el('div', { class: 'spread' }, [
      el('span', { class: 'tiny muted', text: '残りポイント' }),
      el('span', {
        class: 'budget__left',
        style: { color: left < 0 ? 'var(--blood)' : 'var(--gold)' },
        text: `${left} / ${POINT_BUY_BUDGET}`,
      }),
    ]),
    costTable(),
    el('p', { class: 'tiny faint', text: `買えるのは8から15まで。全員8から始めて、上げたぶんだけ払います。8は${pointCost(8)}点なので、8のままなら何も払いません。` }),
    el('p', {
      class: 'tiny faint',
      text: `13から先は値上がりします（14は${pointCost(14)}点、15は${pointCost(15)}点）。`
        + `15を2つ取ると${pointCost(15) * 2}点で、残り${POINT_BUY_BUDGET - pointCost(15) * 2}点で他の4つを埋めることになります。`,
    }),
  ]) : null;

  const rolls = draft.mode === 'roll' ? el('div', { class: 'row' }, [
    el('span', { class: 'tiny muted grow', text: `出目: ${(draft.rolled || []).join(', ')}` }),
    button('振り直す', () => {
      draft.rolled = rollAbilities();
      ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = draft.rolled[i]; });
      refresh();
    }, 'btn btn--sm'),
  ]) : null;

  const floor = point ? 8 : 3;
  const ceiling = point ? 15 : 18;

  const rows = ABILITIES.map(a => {
    const base = draft.abilities[a.id];
    const bonus = ancestry.bonus?.[a.id] || 0;
    const total = base + bonus;
    const isPrimary = klass?.primary === a.id;

    const nextCost = pointCost(base + 1) - pointCost(base);
    const tooHigh = base >= ceiling;
    const tooPoor = point && nextCost > left;
    const atFloor = base <= floor;

    const dec = () => { draft.abilities[a.id] = Math.max(floor, base - 1); refresh(); };
    const inc = () => {
      if (tooHigh) { toast(`${point ? 'ポイント購入は' : ''}${ceiling}までです`); return; }
      if (tooPoor) { toast(`あと${nextCost - left}点足りません`); return; }
      draft.abilities[a.id] = base + 1;
      refresh();
    };

    /* この能力値を1つ上げるのに何点かかるか。上げられないなら、その理由。 */
    const hint = !point ? null
      : tooHigh ? 'ここまで（ポイントで買えるのは15まで）'
      : tooPoor ? `次の+1に${nextCost}点／残り${left}点では上げられない`
      : `使用${pointCost(base)}点／次の+1に${nextCost}点`;

    /* この能力値の上限。種族の加算があるぶんだけ、上限も上がる。
       「+2は上限が2高いという意味？」と訊かれた——半分そうで、
       加算は買った値すべてに乗る。式のまま出せば取り違えようがない。 */
    const cap = bonus
      ? `上限 ${ceiling}＋${bonus}＝${ceiling + bonus}`
      : `上限 ${ceiling}`;

    return el('div', { class: `abil ${isPrimary ? 'is-primary' : ''}` }, [
      el('div', { class: 'abil__main' }, [
        el('div', { class: 'abil__name' }, [
          el('span', { text: a.name }),
          isPrimary ? el('span', { class: 'tag', text: `${klass.name}の主能力` }) : null,
          bonus ? el('span', { class: 'tag', text: `${ancestry.name} +${bonus}` }) : null,
        ]),
        el('div', { class: 'tiny faint', text: a.desc || '' }),
        hint ? el('div', { class: 'tiny faint', text: hint }) : null,
        el('div', { class: 'tiny faint', text: cap }),
      ]),
      el('div', { class: 'abil__ctl' }, [
        el('button', { class: 'btn btn--sm', disabled: atFloor, onclick: dec, 'aria-label': `${a.name}を下げる` }, ['−']),
        el('div', { class: 'abil__num' }, [
          el('div', { class: 'abil__score', text: String(total) }),
          el('div', { class: 'abil__mod', text: `修正値 ${signed(abilityMod(total))}` }),
          bonus ? el('div', { class: 'abil__calc', text: `${base}＋${bonus}` }) : null,
        ]),
        el('button', { class: 'btn btn--sm', disabled: tooHigh || tooPoor, onclick: inc, 'aria-label': `${a.name}を上げる` }, ['＋']),
      ]),
    ]);
  });

  return el('div', { class: 'stack' }, [
    primer,
    modeRow,
    modeNote,
    ancestryNote,
    budget,
    rolls,
    ...rows,
  ]);
}

function stepSkills(draft, refresh) {
  const klass = CLASSES.find(c => c.id === draft.classId);
  const background = BACKGROUNDS.find(b => b.id === draft.backgroundId);
  const ancestry = ANCESTRIES.find(a => a.id === draft.ancestryId);
  const remaining = skillBudget(klass, ancestry) - draft.skills.length;

  /* 名前だけ並んだ札から選ばせていたので、はじめての人は何を取ったのか
     分からないまま進んでいた。何をする技能なのかを、選ぶその場で読ませる。
     押して開くのではなく開いたまま置くのは、ここが選ぶ画面だからだ。 */
  const skillChips = el('div', { class: 'stack', style: { gap: '7px' } }, klass.skillList.map(id => {
    const on = draft.skills.includes(id);
    const skill = skillById(id);
    return el('button', {
      class: 'tile', 'aria-pressed': on,
      // 選べる数を使い切ったら、選べないものは沈める。上の「あと0つ」は
      // 一覧をたどっているうちに画面の外へ出てしまうので。
      style: on ? { borderColor: 'var(--gold)' } : (remaining > 0 ? {} : { opacity: '.5' }),
      onclick: () => {
        if (on) draft.skills = draft.skills.filter(s => s !== id);
        else if (remaining > 0) draft.skills.push(id);
        else toast('これ以上は選べません');
        refresh();
      },
    }, [
      el('div', { class: 'tile__head' }, [
        el('span', { class: 'tile__name', text: `${on ? '● ' : ''}${skill?.name || id}` }),
        el('span', {
          class: 'tiny faint grow', style: { textAlign: 'right' },
          text: skill ? abilityName(skill.ability) : '',
        }),
      ]),
      skill?.desc ? el('div', { class: 'tile__desc', text: skill.desc }) : null,
      skill?.example ? el('div', { class: 'tiny faint', style: { marginTop: '4px' }, text: skill.example }) : null,
    ]);
  }));

  const backgrounds = el('div', { class: 'stack' }, BACKGROUNDS.map(b => el('button', {
    class: 'tile', style: draft.backgroundId === b.id ? { borderColor: 'var(--gold)' } : {},
    onclick: () => { draft.backgroundId = b.id; refresh(); },
  }, [
    el('div', { class: 'tile__head' }, [el('span', { class: 'tile__name', text: b.name })]),
    el('div', { class: 'tile__desc', text: b.blurb }),
    el('div', { class: 'tiny faint', text: `習得: ${b.skills.map(skillName).join('・')}` }),
  ])));

  const expertise = klass.expertiseChoices ? el('div', { class: 'stack' }, [
    el('h3', { class: 'card__title', text: `熟達（${klass.expertiseChoices}つ選ぶ／習熟ボーナス2倍）` }),
    el('div', { class: 'chips' }, draft.skills.map(id => {
      const on = draft.expertise.includes(id);
      return el('button', {
        class: `chip ${on ? 'is-on' : ''}`,
        onclick: () => {
          if (on) draft.expertise = draft.expertise.filter(s => s !== id);
          else if (draft.expertise.length < klass.expertiseChoices) draft.expertise.push(id);
          else toast('これ以上は選べません');
          refresh();
        },
      }, [skillName(id)]);
    })),
  ]) : null;

  /* 呪文も同じ理由で中身ごと出す。同じ画面で技能だけ説明があって
     呪文が名前だけ、では選ぶ側の困りかたは変わらない。 */
  const spells = klass.caster ? el('div', { class: 'stack' }, [
    el('h3', { class: 'card__title', text: `習得する${label('spellPlural', '呪文')}（3つまで）` }),
    el('div', { class: 'stack', style: { gap: '7px' } }, (CLASS_SPELLS[klass.id] || []).map(id => {
      const on = draft.spells.includes(id);
      const spell = spellById(id);
      return el('button', {
        class: 'tile', 'aria-pressed': on,
        style: on ? { borderColor: 'var(--gold)' } : (draft.spells.length < 3 ? {} : { opacity: '.5' }),
        onclick: () => {
          if (on) draft.spells = draft.spells.filter(s => s !== id);
          else if (draft.spells.length < 3) draft.spells.push(id);
          else toast('3つまでです');
          refresh();
        },
      }, [
        el('div', { class: 'tile__head' }, [
          el('span', { class: 'tile__name', text: `${on ? '● ' : ''}${spell?.name || id}` }),
          el('span', {
            class: 'tiny faint grow', style: { textAlign: 'right' },
            text: spell ? (spell.level ? `${spell.level}レベル` : label('cantrip', '初級呪文')) : '',
          }),
        ]),
        spell?.desc ? el('div', { class: 'tile__desc', text: spell.desc }) : null,
      ]);
    })),
  ]) : null;

  return el('div', { class: 'stack' }, [
    el('h3', { class: 'card__title', text: `${label('klass', 'クラス')}技能（あと ${Math.max(0, remaining)} つ）` }),
    skillChips,
    expertise,
    spells,
    el('h3', { class: 'card__title', style: { marginTop: '10px' }, text: label('background', '経歴') }),
    el('p', { class: 'tiny muted', text: `${label('background', '経歴')}からは ${background.skills.map(skillName).join('・')} が自動で身につく。` }),
    backgrounds,
  ]);
}

function stepFinish(draft, refresh) {
  const preview = createCharacter(draft);
  return el('div', { class: 'stack' }, [
    field('名前', el('input', {
      class: 'input', value: draft.name, placeholder: '名もなき冒険者',
      oninput: e => { draft.name = e.target.value; },
    })),
    field('肖像（絵文字1つ）', el('input', {
      class: 'input', value: draft.portrait || preview.portrait, maxlength: 4,
      oninput: e => { draft.portrait = e.target.value; },
    })),
    field('この人物について（任意）', el('textarea', {
      class: 'textarea', value: draft.notes || '', placeholder: '過去、目的、嫌いなもの……',
      oninput: e => { draft.notes = e.target.value; },
    })),
    el('div', { class: 'card card--flat' }, [
      el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: 'ヒットポイント' }), el('span', { text: preview.maxHp })]),
      el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: 'アーマークラス' }), el('span', { text: preview.ac })]),
      el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: '技能' }), el('span', { class: 'tiny', text: preview.skills.map(skillName).join('・') || '—' })]),
    ]),
    button('中身を確認する', () => openCharacterSheet(preview), 'btn btn--sm'),
  ]);
}

const bonusText = bonus => Object.entries(bonus || {}).map(([k, v]) =>
  `${ABILITIES.find(a => a.id === k)?.short || k}+${v}`).join(' ');

/* ---------------------------------------------------------- saved sheet */

export function openSaved(onPick) {
  /* 別の世界観の人物は混ぜない。エルフの追跡者をサイバーパンクの卓に置くと、
     種族もクラスも引けずに表示が崩れる。隠した数だけは知らせる。 */
  const here = activeWorld().id;
  const all = listCharacters();
  const saved = all.filter(c => (c.world || DEFAULT_WORLD) === here);
  const hidden = all.length - saved.length;

  const body = saved.length
    ? el('div', { class: 'party' }, saved.map(data => {
      const pc = reviveCharacter(data);
      return el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', {
          class: 'pc grow',
          onclick: () => { closeSheet(); onPick(reviveCharacter(structuredClone(data))); },
        }, [
          el('span', { class: 'pc__face', text: pc.portrait }),
          el('span', { class: 'pc__body' }, [
            el('span', { class: 'pc__name', text: pc.name }),
            el('span', { class: 'tiny faint', text: `${classOf(pc)}／Lv${pc.level}` }),
          ]),
        ]),
        el('button', {
          class: 'btn btn--sm btn--danger',
          onclick: e => { e.stopPropagation(); deleteCharacter(pc.id); openSaved(onPick); },
        }, ['削除']),
      ]);
    }))
    : el('p', { class: 'muted center', text: `${activeWorld().name} のキャラクターはまだありません。` });

  const note = hidden
    ? el('p', { class: 'tiny faint center', text: `他の世界観のキャラクター ${hidden} 人は、ここには出していません。` })
    : null;

  openSheet(`保存済みキャラクター（${activeWorld().name}）`, frag(body, note));
}
