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
import { ABILITIES, ABILITY_IDS, abilityMod, SKILLS, skillName } from '../core/rules.js';
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
            el('button', { class: 'pc', onclick: () => openCharacterSheet(pc) }, [
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
  const scores = rng.shuffle(STANDARD_ARRAY);

  // Put the best score where the class wants it.
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

function stepAbilities(draft, refresh) {
  const spent = pointsSpent(draft.abilities);
  const ancestry = ANCESTRIES.find(a => a.id === draft.ancestryId);

  const modeRow = el('div', { class: 'chips' }, [
    ['point', 'ポイント割り振り'], ['array', '標準配列'], ['roll', 'ダイスで決める'],
  ].map(([id, label]) => el('button', {
    class: `chip ${draft.mode === id ? 'is-on' : ''}`,
    onclick: () => {
      draft.mode = id;
      if (id === 'array') ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = STANDARD_ARRAY[i]; });
      if (id === 'roll') { draft.rolled = rollAbilities(); ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = draft.rolled[i]; }); }
      if (id === 'point') ABILITY_IDS.forEach(a => { draft.abilities[a] = 8; });
      refresh();
    },
  }, [label])));

  const rows = ABILITIES.map(a => {
    const base = draft.abilities[a.id];
    const bonus = ancestry.bonus?.[a.id] || 0;
    const total = base + bonus;
    const dec = () => { draft.abilities[a.id] = Math.max(8, base - 1); refresh(); };
    const inc = () => {
      const next = base + 1;
      if (draft.mode === 'point') {
        if (next > 15) { toast('ポイント購入は15までです'); return; }
        const trial = { ...draft.abilities, [a.id]: next };
        if (pointsSpent(trial) > POINT_BUY_BUDGET) { toast('ポイントが足りません'); return; }
      }
      draft.abilities[a.id] = Math.min(18, next);
      refresh();
    };
    return el('div', { class: 'row', style: { gap: '8px' } }, [
      el('span', { class: 'grow', text: `${a.name}${bonus ? `（種族 +${bonus}）` : ''}` }),
      el('button', { class: 'btn btn--sm', onclick: dec }, ['−']),
      el('span', { style: { minWidth: '54px', textAlign: 'center' }, text: `${total} (${signed(abilityMod(total))})` }),
      el('button', { class: 'btn btn--sm', onclick: inc }, ['＋']),
    ]);
  });

  return el('div', { class: 'stack' }, [
    modeRow,
    draft.mode === 'point'
      ? el('p', { class: 'tiny muted', text: `残りポイント ${POINT_BUY_BUDGET - spent} / ${POINT_BUY_BUDGET}（8が0点、15が9点）` })
      : el('p', { class: 'tiny muted', text: draft.mode === 'roll' ? `出目: ${(draft.rolled || []).join(', ')}` : '標準配列 15,14,13,12,10,8' }),
    draft.mode === 'roll'
      ? button('振り直す', () => { draft.rolled = rollAbilities(); ABILITY_IDS.forEach((a, i) => { draft.abilities[a] = draft.rolled[i]; }); refresh(); }, 'btn btn--sm')
      : null,
    ...rows,
  ]);
}

function stepSkills(draft, refresh) {
  const klass = CLASSES.find(c => c.id === draft.classId);
  const background = BACKGROUNDS.find(b => b.id === draft.backgroundId);
  const ancestry = ANCESTRIES.find(a => a.id === draft.ancestryId);
  const remaining = skillBudget(klass, ancestry) - draft.skills.length;

  const skillChips = el('div', { class: 'chips' }, klass.skillList.map(id => {
    const on = draft.skills.includes(id);
    return el('button', {
      class: `chip ${on ? 'is-on' : ''}`,
      onclick: () => {
        if (on) draft.skills = draft.skills.filter(s => s !== id);
        else if (remaining > 0) draft.skills.push(id);
        else toast('これ以上は選べません');
        refresh();
      },
    }, [skillName(id)]);
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

  const spells = klass.caster ? el('div', { class: 'stack' }, [
    el('h3', { class: 'card__title', text: `習得する${label('spellPlural', '呪文')}（3つまで）` }),
    el('div', { class: 'chips' }, (CLASS_SPELLS[klass.id] || []).map(id => {
      const on = draft.spells.includes(id);
      const spell = spellById(id);
      return el('button', {
        class: `chip ${on ? 'is-on' : ''}`,
        onclick: () => {
          if (on) draft.spells = draft.spells.filter(s => s !== id);
          else if (draft.spells.length < 3) draft.spells.push(id);
          else toast('3つまでです');
          refresh();
        },
      }, [`${spell?.name || id}（${spell?.level}）`]);
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
