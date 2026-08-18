/* The solo play screen: transcript, choices, party, and the combat panel. */

import { el, frag, clear, toast, openSheet, closeSheet, confirmSheet, button, richText } from './dom.js';
import { partyList, openCharacterSheet } from './sheet.js';
import { Session } from '../core/engine.js';
import { skillName, xpToNext } from '../core/rules.js';
import { label, ENEMY_ICONS } from '../core/content.js';
import { putSave, putCharacter } from '../core/store.js';
import { useWorld } from '../worlds/index.js';

export class SoloScreen {
  /**
   * @param {HTMLElement} root
   * @param {object} opts {session, app, saveId}
   */
  constructor(root, { session, app, saveId = null }) {
    this.root = root;
    this.app = app;
    this.session = session;
    this.saveId = saveId;
    this.selectedTarget = null;
    this.pendingAction = null;       // an action waiting for its target

    this.logBox = el('div', { class: 'log', id: 'logBox' });
    this.choiceBox = el('div', { class: 'choices' });
    this.sideBox = el('div', { class: 'play__side stack' });

    this.render();
    this.session.addEventListener('change', () => this.update());
  }

  /* ------------------------------------------------------------- layout */

  render() {
    /* この画面を描くたびに、シナリオの世界へ戻す。「世界」画面やセッション支援で
       世界を切り替えたまま冒険に帰ってくると、技能名も通貨も変わり、そのシナリオの
       敵が見つからなくなる（戦闘に入った瞬間に落ちる）。切替は自由でよく、
       冒険の側が自分の足場を主張するのが正しい。 */
    useWorld(this.session.world);

    clear(this.root).append(el('div', { class: 'play' }, [
      el('div', { class: 'stack' }, [this.logBox, this.choiceBox]),
      this.sideBox,
    ]));
    this.update();
  }

  update() {
    const view = this.session.view();
    this.drawLog(view);
    this.drawSide(view);
    if (view.combat) this.drawCombat(view);
    else if (view.netrun) this.drawNetrun(view);
    else this.drawChoices(view);
  }

  /* ---------------------------------------------------------------- log */

  drawLog(view) {
    const box = this.logBox;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const shown = box.childElementCount;

    // Only append what is new, so long transcripts stay cheap to update.
    for (const entry of view.log.slice(shown)) box.append(this.logLine(entry));
    if (view.log.length < shown) {                 // the log was replaced wholesale
      clear(box);
      for (const entry of view.log) box.append(this.logLine(entry));
    }
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  logLine(entry) {
    const line = el('p', { class: `log__line line-${entry.kind}` });
    if (entry.kind === 'scene' && entry.art) line.append(el('span', { text: entry.art }));
    line.append(richText(entry.text));
    if (entry.roll?.natural) {
      line.append(el('span', { class: 'log__roll', text: `d20:${entry.roll.natural}` }));
    }
    return line;
  }

  /* ------------------------------------------------------------ choices */

  /* 冒険が終わったあとの一行。ここまで、経験点も所持金もレベルも、
     終わった瞬間に消えていた——持ち越せなければ、上がった意味がどこにも
     残らない。次の依頼へ連れて行けるようにする。 */
  growthCard(view) {
    const growth = view.growth || [];
    if (!growth.length) return el('span');

    const row = g => {
      const gained = [];
      if (g.xpGained) gained.push(`経験点 +${g.xpGained}`);
      if (g.goldGained) gained.push(`${label('gold', '所持金')} ${g.goldGained > 0 ? '+' : ''}${g.goldGained}`);
      return el('div', { class: 'kv' }, [
        el('span', { class: 'kv__k' }, [
          `${g.portrait || '🎲'} ${g.name}`,
          g.level > g.levelFrom
            ? el('span', { class: 'tag', style: { marginLeft: '6px' }, text: `Lv${g.levelFrom} → ${g.level}` })
            : el('span', { class: 'tiny faint', text: ` Lv${g.level}` }),
          g.dead ? el('span', { class: 'tag tag--bad', style: { marginLeft: '6px' }, text: '死亡' }) : null,
        ]),
        el('span', { class: 'tiny muted', text: gained.join('／') || '—' }),
      ]);
    };

    const alive = growth.filter(g => !g.dead);
    const toNext = alive.length ? xpToNext(Math.min(...alive.map(g => g.xp))) : null;

    return el('div', { class: 'card stack' }, [
      el('h3', { class: 'card__title', text: 'この一行が持ち帰ったもの' }),
      el('div', {}, growth.map(row)),
      toNext ? el('p', { class: 'tiny faint', text: `次のレベルまであと ${toNext} 点。` }) : null,
      el('p', { class: 'tiny faint', text: '保存すると、次の依頼に同じ一行を連れて行けます（一行を決める画面の「保存済みから」）。' }),
      button(`この一行を保存する（${alive.length}人）`, () => {
        let saved = 0;
        for (const pc of this.session.party) {
          if (pc.dead) continue;
          putCharacter(pc);
          saved += 1;
        }
        toast(saved ? `${saved}人を保存しました` : '保存できる人がいません');
      }, 'btn btn--primary btn--block'),
    ]);
  }

  drawChoices(view) {
    const box = clear(this.choiceBox);

    if (view.finished) {
      box.append(el('div', { class: 'card center stack' }, [
        el('h2', { class: 'card__title', text: view.ending?.title || '物語の終わり' }),
        el('p', { class: 'muted', text: '記録は残った。次の卓へ。' }),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, [
          button(`${label('adventure', '冒険')}の記録を見る`, () => this.showSummary(view)),
          button('タイトルへ戻る', () => this.app.go('home'), 'btn btn--primary'),
        ]),
      ]));
      box.append(this.growthCard(view));
      return;
    }

    for (const choice of view.choices) {
      const meta = [];
      if (choice.check) meta.push(`【${choice.check.label}】判定 DC${choice.check.dc}`);
      if (choice.locked) meta.push(`🔒 ${choice.lockedText}`);

      box.append(el('button', {
        class: 'choice',
        disabled: choice.locked,
        onclick: () => this.pick(choice),
      }, [
        el('span', { class: 'choice__bullet', text: '◆' }),
        el('span', { class: 'choice__text' }, [
          choice.text,
          meta.length ? el('span', {
            class: `choice__meta ${choice.locked ? 'choice__lock' : 'choice__check'}`,
            text: meta.join('　'),
          }) : null,
        ]),
      ]));
    }

    if (!view.choices.length) {
      box.append(el('p', { class: 'muted tiny center', text: '（進める先がありません。セーブして報告してください）' }));
    }
  }

  /** Taking a choice; a check first asks who should roll. */
  pick(choice) {
    if (choice.locked) { toast(choice.lockedText || '今は選べない'); return; }
    if (!choice.check || choice.check.candidates.length < 2) {
      this.commit(choice, null);
      return;
    }
    openSheet(`誰が【${choice.check.label}】判定をする？`, frag(
      el('p', { class: 'muted tiny', text: `DC ${choice.check.dc} — 修正値が高いほど成功しやすい。` }),
      el('div', { class: 'party', style: { marginTop: '10px' } }, choice.check.candidates.map(c =>
        el('button', { class: 'pc', onclick: () => { closeSheet(); this.commit(choice, c.id); } }, [
          el('span', { class: 'pc__face', text: '🎲' }),
          el('span', { class: 'pc__body' }, [el('span', { class: 'pc__name', text: c.name })]),
          el('span', { class: 'pc__hp', text: c.mod >= 0 ? `+${c.mod}` : `−${Math.abs(c.mod)}` }),
        ]))),
    ));
  }

  commit(choice, actorId) {
    const result = this.session.choose(choice.index, { actorId });
    if (result?.error) toast(result.error);
    this.update();
  }

  /* ------------------------------------------------------------- combat */

  drawCombat(view) {
    const combat = view.combat;
    const box = clear(this.choiceBox);
    const panel = el('div', { class: 'combat' });

    panel.append(el('div', { class: 'combat__head' }, [
      el('span', { class: 'combat__round', text: `ラウンド ${combat.round}` }),
      el('span', { class: 'tiny muted', text: combat.playerTurn ? 'あなたの手番' : '敵の手番' }),
    ]));

    // Enemies double as target buttons.
    panel.append(el('div', { class: 'enemies' }, combat.targets.map(enemy =>
      el('button', {
        class: `enemy ${combat.current === enemy.uid ? 'is-turn' : ''}`,
        'aria-pressed': this.selectedTarget === enemy.uid,
        onclick: () => { this.selectedTarget = enemy.uid; this.update(); },
      }, [
        el('span', { text: enemyIcon(enemy.kind) }),
        el('span', { class: 'enemy__name', text: enemy.name }),
        el('span', { class: 'pc__hp', text: `${enemy.hp}/${enemy.maxHp}` }),
      ]))));

    if (combat.playerTurn) {
      const actor = combat.order.find(o => o.uid === combat.current);
      panel.append(el('p', { class: 'hint', text: `${actor?.name ?? ''} の手番 — 行動を選ぶ` }));
      panel.append(el('div', { class: 'actions' }, combat.options.map(option =>
        el('button', {
          class: `action action--${option.kind}`,
          disabled: option.disabled,
          onclick: () => this.doAction(option, combat),
        }, [option.name + (option.disabled ? '（残りなし）' : '')]))));
    } else {
      panel.append(el('p', { class: 'hint', text: '敵が動いている…' }));
    }

    box.append(panel);
  }

  /** Run a combat action, asking for a target when the action needs one. */
  doAction(option, combat) {
    const needsEnemy = option.kind === 'attack' || (option.kind === 'spell' && ['enemy'].includes(option.target));
    const needsAlly = option.target === 'ally';

    if (needsAlly) {
      openSheet('誰に？', el('div', { class: 'party' }, combat.allies.map(ally =>
        el('button', { class: 'pc', onclick: () => { closeSheet(); this.sendAction(option, ally.uid); } }, [
          el('span', { class: 'pc__face', text: '🙂' }),
          el('span', { class: 'pc__body' }, [el('span', { class: 'pc__name', text: ally.name })]),
          el('span', { class: 'pc__hp', text: `${ally.hp}/${ally.maxHp}` }),
        ]))));
      return;
    }

    if (needsEnemy) {
      const target = this.selectedTarget && combat.targets.some(t => t.uid === this.selectedTarget)
        ? this.selectedTarget
        : combat.targets[0]?.uid;
      if (!target) { toast('相手がいません'); return; }
      this.sendAction(option, target);
      return;
    }
    this.sendAction(option, null);
  }

  sendAction(option, targetUid) {
    const result = this.session.act({ ...option, targetUid });
    if (result?.error) toast(result.error);
    this.selectedTarget = null;
    this.update();
  }

  /* ------------------------------------------------------------- netrun */

  drawNetrun(view) {
    const run = view.netrun;
    const box = clear(this.choiceBox);
    const panel = el('div', { class: 'combat netrun' });

    panel.append(el('div', { class: 'combat__head' }, [
      el('span', { class: 'combat__round', text: `${run.title}　第${run.layerIndex + 1}／${run.layerCount}層` }),
      el('span', { class: 'tiny muted', text: run.runner ? `接続: ${run.runner}` : '' }),
    ]));

    // The trace clock is the whole tension of a run — show it big.
    const filled = Math.round((run.trace / run.traceMax) * 100);
    panel.append(el('div', { class: 'trace' }, [
      el('div', { class: 'trace__head' }, [
        el('span', { class: 'tiny', text: '追跡' }),
        el('span', { class: 'tiny', text: `${run.trace} / ${run.traceMax}` }),
      ]),
      el('div', { class: 'trace__bar' }, [
        el('div', {
          class: `trace__fill ${run.trace >= run.traceMax - 1 ? 'is-critical' : run.trace > run.traceMax / 2 ? 'is-warn' : ''}`,
          style: { width: `${filled}%` },
        }),
      ]),
    ]));

    if (run.layer) {
      panel.append(el('p', { class: 'hint', text: `${run.layer.name} — 【${skillName(run.layer.skill)}】 DC${run.layer.dc}` }));
    }

    panel.append(el('div', { class: 'actions' }, run.options.map(option =>
      el('button', {
        class: 'action action--netrun',
        onclick: () => this.hack(option),
      }, [
        el('span', { text: option.name + (option.dc ? `（DC${option.dc}）` : '（自動成功）') }),
        el('span', { class: 'choice__meta', text: option.desc }),
      ]))));

    if (run.candidates.length > 1) {
      panel.append(el('button', {
        class: 'btn btn--sm btn--ghost', style: { marginTop: '10px' },
        onclick: () => this.pickRunner(run),
      }, ['接続する担当を変える']));
    }

    box.append(panel);
  }

  pickRunner(run) {
    openSheet('誰が潜る？', el('div', { class: 'party' }, run.candidates.map(c =>
      el('button', {
        class: 'pc',
        onclick: () => { closeSheet(); this.session.netrun.runnerId = c.id; this.update(); },
      }, [
        el('span', { class: 'pc__face', text: '🕶️' }),
        el('span', { class: 'pc__body' }, [el('span', { class: 'pc__name', text: c.name })]),
        el('span', { class: 'pc__hp', text: c.mod >= 0 ? `+${c.mod}` : `−${Math.abs(c.mod)}` }),
      ]))));
  }

  hack(option) {
    const result = this.session.hack({ id: option.id });
    if (result?.error) toast(result.error);
    this.update();
  }

  /* ---------------------------------------------------------------- side */

  drawSide(view) {
    const box = clear(this.sideBox);

    box.append(el('div', { class: 'card card--flat stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: label('party', '一行') }),
        el('span', { class: 'tiny faint', text: view.scenario.title }),
      ]),
      partyList(view.party, { onClick: pc => this.openPc(pc.id) }),
    ]));

    const buttons = el('div', { class: 'row' }, [
      view.canRest ? button('小休憩', () => { this.session.rest('short'); this.update(); }, 'btn btn--sm grow') : null,
      view.canRest ? button('長休憩', () => { this.session.rest('long'); this.update(); }, 'btn btn--sm grow') : null,
    ]);

    box.append(el('div', { class: 'card card--flat stack' }, [
      buttons,
      el('div', { class: 'row' }, [
        button('セーブ', () => this.save(), 'btn btn--sm grow'),
        button('やめる', () => this.quit(), 'btn btn--sm grow'),
      ]),
      this.varsBlock(view),
    ]));
  }

  varsBlock(view) {
    const entries = Object.entries(view.vars || {});
    if (!entries.length && !view.flags.length) return null;
    return el('details', { class: 'tiny muted' }, [
      el('summary', { text: '状況メモ' }),
      el('div', { style: { marginTop: '6px' } }, [
        ...entries.map(([k, v]) => el('div', { text: `${k}: ${v}` })),
        view.flags.length ? el('div', { class: 'faint', text: `記録: ${view.flags.join('、')}` }) : null,
      ]),
    ]);
  }

  openPc(id) {
    const pc = this.session.party.find(p => p.id === id);
    if (pc) openCharacterSheet(pc);
  }

  /* --------------------------------------------------------------- misc */

  save() {
    const snapshot = this.session.save();
    this.saveId = putSave(snapshot, { id: this.saveId });
    toast(snapshot.inCombat ? 'セーブしました（戦闘は場面の最初から再開）' : 'セーブしました');
  }

  async quit() {
    const ok = await confirmSheet('冒険を中断する', 'セーブしてタイトルに戻ります。', { okText: 'セーブして戻る' });
    if (!ok) return;
    this.save();
    this.app.go('home');
  }

  showSummary(view) {
    const rolls = this.session.log.filter(e => e.roll).length;
    openSheet(`${label('adventure', '冒険')}の記録`, frag(
      el('div', {}, [
        row('シナリオ', view.scenario.title),
        row('結末', view.ending?.title || '—'),
        row('振ったダイス', `${rolls} 回`),
        row('訪れた場面', `${this.session.visited.size} か所`),
        row('経過', `${Math.round((Date.now() - this.session.startedAt) / 60000)} 分`),
      ]),
      el('h3', { class: 'card__title', style: { marginTop: '14px' }, text: `${label('party', '一行')}のその後` }),
      partyList(view.party),
    ));
  }
}

/* A small visual cue for what you are fighting; each world supplies its own. */
const enemyIcon = kind => ENEMY_ICONS[kind] || '👹';

const row = (k, v) => el('div', { class: 'kv' }, [
  el('span', { class: 'kv__k', text: k }),
  el('span', { class: 'kv__v', text: String(v) }),
]);

/** Start a fresh session and hand back the screen. */
export function startSolo(root, { scenario, party, app, seed }) {
  const session = new Session({ scenario, party, seed });
  session.start();
  return new SoloScreen(root, { session, app });
}

/** Resume a stored save. */
export function resumeSolo(root, { save, app }) {
  const session = Session.load(save.data);
  const screen = new SoloScreen(root, { session, app, saveId: save.id });
  if (!session.log.length) session.start();
  screen.update();
  return screen;
}

export { skillName };
