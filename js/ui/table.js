/* Session tool — the thing you put on the table during a face-to-face game.

   Three tabs: dice tray, character sheets, initiative tracker. It never
   touches the solo engine; it just holds state for a live session. */

import { el, frag, clear, toast, openSheet, closeSheet, field, button, signed } from './dom.js';
import { partyList, openCharacterSheet, characterSheet } from './sheet.js';
import { roll, isValid } from '../core/dice.js';
import { Rng } from '../core/rng.js';
import { abilityMod, armorClass, applyDamage, heal, SKILLS, ABILITIES, skillMod, check, savingThrow } from '../core/rules.js';
import { reviveCharacter, recalculate, restParty } from '../core/character.js';
import { spawnMonster, spawnGroup } from '../core/combat.js';
import { MONSTERS, monsterById } from '../core/content.js';
import { listCharacters, putCharacter, getPrefs, setPref } from '../core/store.js';
import { openBuilder, randomCharacter, openSaved } from './builder.js';
import { WORLDS, useWorld, activeWorld, DEFAULT_WORLD } from '../worlds/index.js';

const QUICK_DICE = ['1d20', '1d4', '1d6', '1d8', '1d10', '1d12', '1d100'];

export class TableScreen {
  constructor(root, { app }) {
    this.root = root;
    this.app = app;
    this.rng = new Rng();
    this.tab = getPrefs().tableTab || 'dice';
    this.history = [];
    this.expression = '1d20';
    this.mode = null;                       // 'adv' | 'dis' | null
    // The tool is a table, not a campaign: pick the setting explicitly rather
    // than inheriting whatever scenario was played last.
    this.world = getPrefs().tableWorld || DEFAULT_WORLD;
    useWorld(this.world);
    this.allCharacters = listCharacters().map(reviveCharacter);
    this.tracker = [];                      // {name, init, hp, maxHp, ac, isPc, ref}
    this.round = 1;
    this.turn = 0;
    this.render();
  }

  /** Only the characters that belong to the world currently on the table. */
  get characters() {
    return this.allCharacters.filter(c => (c.world || DEFAULT_WORLD) === this.world);
  }

  switchWorld(id) {
    if (id === this.world) return;
    this.world = id;
    setPref('tableWorld', id);
    useWorld(id);
    // Anyone from the other setting stays saved, just off this table.
    this.tracker = this.tracker.filter(row => !row.isPc);
    this.render();
    toast(`${activeWorld().name} に切り替えました`);
  }

  render() {
    clear(this.root).append(el('div', { class: 'stack' }, [
      el('div', { class: 'chips' }, WORLDS.map(world => el('button', {
        class: `chip ${this.world === world.id ? 'is-on' : ''}`,
        onclick: () => this.switchWorld(world.id),
      }, [`${world.icon} ${world.name}`]))),
      el('div', { class: 'chips' }, [
        ['dice', '🎲 ダイス'], ['chars', '📜 キャラクター'], ['init', '⚔️ 進行'],
      ].map(([id, label]) => el('button', {
        class: `chip ${this.tab === id ? 'is-on' : ''}`,
        onclick: () => { this.tab = id; setPref('tableTab', id); this.render(); },
      }, [label]))),
      this.tab === 'dice' ? this.diceTab() : this.tab === 'chars' ? this.charsTab() : this.initTab(),
    ]));
  }

  /* ----------------------------------------------------------- dice tray */

  diceTab() {
    const last = this.history[0];
    const input = el('input', {
      class: 'input', value: this.expression, placeholder: '2d6+3',
      oninput: e => { this.expression = e.target.value; },
      onkeydown: e => { if (e.key === 'Enter') this.rollNow(this.expression); },
    });

    return el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'tray__result', text: last ? String(last.total) : '—' }),
        el('div', { class: 'tray__detail', text: last ? last.text : '式を入れて振る' }),
      ]),

      el('div', { class: 'card stack' }, [
        el('div', { class: 'dice-buttons' }, QUICK_DICE.map(d =>
          el('button', { class: 'btn btn--sm', onclick: () => this.rollNow(d) }, [d.replace('1d', 'd')]))),
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [input]),
          button('振る', () => this.rollNow(this.expression), 'btn btn--primary'),
        ]),
        el('div', { class: 'chips' }, [
          el('button', {
            class: `chip ${this.mode === 'adv' ? 'is-on' : ''}`,
            onclick: () => { this.mode = this.mode === 'adv' ? null : 'adv'; this.render(); },
          }, ['有利']),
          el('button', {
            class: `chip ${this.mode === 'dis' ? 'is-on' : ''}`,
            onclick: () => { this.mode = this.mode === 'dis' ? null : 'dis'; this.render(); },
          }, ['不利']),
          el('button', { class: 'chip', onclick: () => this.openSkillRoll() }, ['技能判定…']),
          el('button', { class: 'chip', onclick: () => { this.history = []; this.render(); } }, ['履歴を消す']),
        ]),
      ]),

      this.history.length ? el('div', { class: 'card' }, [
        el('h3', { class: 'card__title', text: '履歴' }),
        el('div', { class: 'tray__history' }, this.history.map(entry =>
          el('div', { class: 'tray__row' }, [
            el('span', { class: 'tiny muted', text: entry.label }),
            el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: entry.text }),
            el('b', { text: String(entry.total) }),
          ]))),
      ]) : null,
    ]);
  }

  rollNow(expression, label = null) {
    if (!isValid(expression)) { toast(`式が読めません: ${expression}`); return; }
    const result = roll(expression, { rng: this.rng, mode: this.mode });
    this.history.unshift({
      label: label || expression + (this.mode === 'adv' ? '（有利）' : this.mode === 'dis' ? '（不利）' : ''),
      total: result.total, text: result.text, at: Date.now(),
    });
    this.history = this.history.slice(0, 40);
    this.expression = expression;
    this.render();
  }

  /** Roll a check for one of the loaded characters. */
  openSkillRoll() {
    if (!this.characters.length) { toast('先にキャラクターを追加してください'); return; }
    let who = this.characters[0];
    let dc = 15;

    const draw = () => openSheet('技能判定', frag(
      field('誰が', el('select', {
        class: 'select', onchange: e => { who = this.characters[e.target.selectedIndex]; draw(); },
      }, this.characters.map(c => el('option', { text: `${c.name}（Lv${c.level}）`, selected: c.id === who.id })))),
      field('DC', el('input', {
        class: 'input', type: 'number', value: dc, min: 1, max: 30,
        oninput: e => { dc = Number(e.target.value) || 10; },
      })),
      el('div', { class: 'chips', style: { marginTop: '10px' } }, SKILLS.map(s =>
        el('button', {
          class: 'chip',
          onclick: () => {
            const result = check(who, s.id, dc, { rng: this.rng, advantage: this.mode === 'adv', disadvantage: this.mode === 'dis' });
            this.history.unshift({ label: `${who.name}／${s.name} vs DC${dc}`, total: result.total, text: `${result.text}` });
            closeSheet();
            this.tab = 'dice';
            this.render();
          },
        }, [`${s.name} ${signed(skillMod(who, s.id))}`]))),
      el('h3', { class: 'card__title', style: { marginTop: '14px' }, text: 'セーヴィングスロー' }),
      el('div', { class: 'chips' }, ABILITIES.map(a =>
        el('button', {
          class: 'chip',
          onclick: () => {
            const result = savingThrow(who, a.id, dc, { rng: this.rng });
            this.history.unshift({ label: `${who.name}／${a.name}セーヴ vs DC${dc}`, total: result.total, text: result.text });
            closeSheet();
            this.tab = 'dice';
            this.render();
          },
        }, [a.name]))),
    ));
    draw();
  }

  /* ---------------------------------------------------------- characters */

  charsTab() {
    return el('div', { class: 'stack' }, [
      el('div', { class: 'card stack' }, [
        el('h3', { class: 'card__title', text: `この卓のキャラクター（${activeWorld().name}）` }),
        el('div', { class: 'row' }, [
          button('新しく作る', () => openBuilder(c => this.addCharacter(c)), 'btn grow'),
          button('ランダム', () => this.addCharacter(randomCharacter(this.rng)), 'btn grow'),
          button('読み込む', () => openSaved(c => this.addCharacter(c)), 'btn grow'),
        ]),
      ]),

      this.characters.length
        ? el('div', { class: 'card stack' }, this.characters.map(pc => el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('button', { class: 'pc', onclick: () => openCharacterSheet(pc, { onChange: () => this.render() }) }, [
            el('span', { class: 'pc__face', text: pc.portrait }),
            el('span', { class: 'pc__body' }, [
              el('span', { class: 'pc__name' }, [pc.name, el('span', { class: 'pc__lv', text: `Lv${pc.level} AC${armorClass(pc)}` })]),
              el('span', { class: 'pc__bar' }, [el('span', {
                class: `pc__fill ${pc.hp / pc.maxHp > .6 ? 'is-ok' : pc.hp / pc.maxHp > .3 ? 'is-mid' : ''}`,
                style: { width: `${Math.max(0, pc.hp / pc.maxHp) * 100}%`, display: 'block', height: '100%' },
              })]),
            ]),
            el('span', { class: 'pc__hp', text: `${pc.hp}/${pc.maxHp}` }),
          ]),
          el('div', { class: 'row', style: { gap: '5px' } }, [
            ...[-5, -1, +1, +5].map(delta => el('button', {
              class: 'btn btn--sm grow',
              onclick: () => { this.nudgeHp(pc, delta); },
            }, [delta > 0 ? `+${delta}` : String(delta)])),
            el('button', { class: 'btn btn--sm', onclick: () => { putCharacter(pc); toast('保存しました'); } }, ['保存']),
            el('button', {
              class: 'btn btn--sm', onclick: () => { this.tracker.push(trackerRow(pc)); this.tab = 'init'; this.render(); },
            }, ['進行に追加']),
          ]),
        ])))
        : el('p', { class: 'muted center tiny', text: `${activeWorld().name} のキャラクターはまだいない。` }),

      this.characters.length ? el('div', { class: 'card row' }, [
        button('全員 長休憩', () => { restParty(this.characters); toast('全員が回復した'); this.render(); }, 'btn grow'),
      ]) : null,
    ]);
  }

  addCharacter(character) {
    this.allCharacters.push(character);
    putCharacter(character);
    this.render();
  }

  nudgeHp(pc, delta) {
    if (delta < 0) applyDamage(pc, -delta);
    else heal(pc, delta);
    this.render();
  }

  /* ------------------------------------------------------------- tracker */

  initTab() {
    const order = [...this.tracker].sort((a, b) => b.init - a.init);
    const current = order[this.turn % Math.max(1, order.length)];

    return el('div', { class: 'stack' }, [
      el('div', { class: 'card stack' }, [
        el('div', { class: 'spread' }, [
          el('h3', { class: 'card__title', text: `ラウンド ${this.round}` }),
          el('span', { class: 'tiny muted', text: current ? `手番: ${current.name}` : '—' }),
        ]),
        el('div', { class: 'row' }, [
          button('次の手番', () => this.nextTurn(order.length), 'btn btn--primary grow'),
          button('イニシアチブを振り直す', () => this.rollInitiative(), 'btn grow'),
        ]),
        el('div', { class: 'row' }, [
          button('PCを追加', () => this.addPcsToTracker(), 'btn btn--sm grow'),
          button('敵を追加', () => this.openMonsterPicker(), 'btn btn--sm grow'),
          button('全消し', () => { this.tracker = []; this.round = 1; this.turn = 0; this.render(); }, 'btn btn--sm btn--danger'),
        ]),
      ]),

      order.length ? el('div', { class: 'card stack' }, order.map((row, index) => el('div', { class: 'stack', style: { gap: '5px' } }, [
        el('div', { class: `pc ${index === this.turn % order.length ? 'is-turn' : ''} ${row.hp <= 0 ? 'is-down' : ''}` }, [
          el('span', { class: 'pc__face', text: row.isPc ? (row.portrait || '🙂') : '👹' }),
          el('span', { class: 'pc__body' }, [
            el('span', { class: 'pc__name' }, [row.name, el('span', { class: 'pc__lv', text: `AC${row.ac}` })]),
            el('span', { class: 'pc__bar' }, [el('span', {
              class: `pc__fill ${row.hp / row.maxHp > .6 ? 'is-ok' : row.hp / row.maxHp > .3 ? 'is-mid' : ''}`,
              style: { width: `${Math.max(0, row.hp / row.maxHp) * 100}%`, display: 'block', height: '100%' },
            })]),
          ]),
          el('span', { class: 'pc__hp', text: `${row.hp}/${row.maxHp}` }),
          el('span', { class: 'chip', style: { minHeight: '26px' }, text: `⚡${row.init}` }),
        ]),
        el('div', { class: 'row', style: { gap: '5px' } }, [
          ...[-5, -1, +1, +5].map(delta => el('button', {
            class: 'btn btn--sm grow',
            onclick: () => { this.nudgeRow(row, delta); },
          }, [delta > 0 ? `+${delta}` : String(delta)])),
          el('button', {
            class: 'btn btn--sm btn--danger',
            onclick: () => { this.tracker = this.tracker.filter(r => r !== row); this.render(); },
          }, ['×']),
        ]),
      ]))) : el('p', { class: 'muted center tiny', text: '参加者を追加してイニシアチブを振る。' }),
    ]);
  }

  nudgeRow(row, delta) {
    row.hp = Math.max(0, Math.min(row.maxHp, row.hp + delta));
    if (row.ref) row.ref.hp = row.hp;
    this.render();
  }

  nextTurn(count) {
    if (!count) return;
    this.turn += 1;
    if (this.turn % count === 0) this.round += 1;
    this.render();
  }

  rollInitiative() {
    for (const row of this.tracker) {
      row.init = roll(`1d20${row.dex < 0 ? '-' : '+'}${Math.abs(row.dex)}`, { rng: this.rng }).total;
    }
    this.turn = 0;
    this.round = 1;
    this.render();
  }

  addPcsToTracker() {
    if (!this.characters.length) { toast('先にキャラクターを追加してください'); return; }
    for (const pc of this.characters) {
      if (!this.tracker.some(r => r.ref === pc)) this.tracker.push(trackerRow(pc));
    }
    this.rollInitiative();
  }

  openMonsterPicker() {
    const entries = Object.values(MONSTERS).sort((a, b) => (a.cr || 0) - (b.cr || 0));
    openSheet('敵を追加', el('div', { class: 'stack' }, entries.map(monster =>
      el('button', {
        class: 'tile',
        onclick: () => {
          const spawned = spawnMonster(monster.id, { rng: this.rng });
          const sameName = this.tracker.filter(r => r.baseName === monster.name).length;
          this.tracker.push({
            name: sameName ? `${monster.name}${sameName + 1}` : monster.name,
            baseName: monster.name,
            init: roll(`1d20+${abilityMod(monster.abilities.dex)}`, { rng: this.rng }).total,
            hp: spawned.hp, maxHp: spawned.maxHp, ac: monster.acOverride,
            dex: abilityMod(monster.abilities.dex), isPc: false, ref: null,
          });
          this.render();
          toast(`${monster.name} を追加した`);
        },
      }, [
        el('div', { class: 'tile__head' }, [
          el('span', { class: 'tile__name', text: monster.name }),
          el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: `CR${monster.cr}／AC${monster.acOverride}／${monster.hpAvg}HP` }),
        ]),
        el('div', { class: 'tile__desc', text: monster.blurb || '' }),
        el('div', { class: 'tiny faint', text: monster.attacks.map(a => `${a.name} ${signed(a.bonus)} / ${a.damage}`).join('　') }),
      ]))));
  }
}

function trackerRow(pc) {
  return {
    name: pc.name, portrait: pc.portrait,
    init: 0, hp: pc.hp, maxHp: pc.maxHp, ac: armorClass(pc),
    dex: abilityMod(pc.abilities.dex), isPc: true, ref: pc,
  };
}
