/* Scenario workshop — write, check and play your own adventures.

   The editor works on the same plain-data format the shipped scenarios use,
   so anything built here can be exported as JSON, shared, and played by the
   solo engine without conversion. */

import { el, frag, clear, toast, openSheet, closeSheet, confirmSheet, field, button } from './dom.js';
import {
  blankScenario, validate, describe, normalize,
} from '../core/scenario.js';
import { SKILLS, skillName, DIFFICULTY } from '../core/rules.js';
import { MONSTERS, encounterDifficulty } from '../core/content.js';
import { listScenarios, putScenario, deleteScenario, downloadJSON, pickJSON } from '../core/store.js';
import { WORLDS, useWorld, worldById, DEFAULT_WORLD } from '../worlds/index.js';

export class EditorScreen {
  constructor(root, { app, scenario = null }) {
    this.root = root;
    this.app = app;
    this.scenario = scenario ? normalize(scenario) : null;
    this.nodeId = null;
    /* 書いたものは、押し間違いで消えてはいけない。20場面まで書いた人が
       操作ミスで半分失った、という報告を受けて入れた仕組み。
       - 触るたびに保存する（「保存」を押し忘れても残る）
       - 変える直前の姿を積んでおく（元に戻せる） */
    this.history = [];
    this.saveTimer = null;
    this.syncWorld();
    this.render();
  }

  /** 変える直前に呼ぶ。ここまでの姿を積み、あとで戻せるようにする。 */
  mark() {
    if (!this.scenario) return;
    this.history.push(JSON.stringify(this.scenario));
    if (this.history.length > 40) this.history.shift();
  }

  /** 一手戻す。 */
  undo() {
    const previous = this.history.pop();
    if (!previous) { toast('これ以上は戻せません'); return; }
    this.scenario = JSON.parse(previous);
    if (!this.scenario.nodes[this.nodeId]) this.nodeId = this.scenario.start;
    this.syncWorld();
    this.save();
    this.render();
    toast('元に戻しました');
  }

  /** 保存。書いている最中は少し待ってからまとめて書き出す。 */
  save({ now = false } = {}) {
    if (!this.scenario) return;
    clearTimeout(this.saveTimer);
    if (now) { putScenario(this.scenario); return; }
    this.saveTimer = setTimeout(() => putScenario(this.scenario), 400);
  }

  /* 本文を打っているあいだは、打ち始めの姿だけを積む。一文字ごとに積むと
     「元に戻す」が一文字ずつ戻ることになって使い物にならない。 */
  typed() {
    if (!this.typing) { this.mark(); this.typing = true; }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => { this.typing = false; }, 1200);
    this.save();
  }

  /** Whatever is being edited decides which world the pickers show. */
  syncWorld() {
    useWorld(this.scenario?.world || DEFAULT_WORLD);
  }

  render() {
    if (!this.scenario) return this.renderPicker();
    this.save({ now: true });          // 画面が変わる節目で確実に書き出す
    return this.renderEditor();
  }

  /* --------------------------------------------------------------- list */

  renderPicker() {
    const mine = listScenarios();
    clear(this.root).append(el('div', { class: 'stack' }, [
      el('div', { class: 'card stack' }, [
        el('h2', { class: 'card__title', text: 'シナリオ工房' }),
        el('p', { class: 'muted tiny', text: '場面をつなげて物語を作る。判定・戦闘・分岐・複数エンディングまで書ける。書いたものはそのままソロプレイで遊べる。' }),
        el('div', { class: 'row' }, [
          button('新しく作る', () => this.createNew(), 'btn btn--primary grow'),
          button('JSONを読み込む', () => this.importFile(), 'btn grow'),
        ]),
      ]),

      mine.length ? el('div', { class: 'card stack' }, [
        el('h3', { class: 'card__title', text: '保存済み' }),
        ...mine.map(scenario => {
          const info = describe(scenario);
          return el('div', { class: 'row', style: { gap: '6px' } }, [
            el('button', {
              class: 'tile grow',
              onclick: () => { this.scenario = normalize(scenario); this.nodeId = scenario.start; this.syncWorld(); this.render(); },
            }, [
              el('div', { class: 'tile__head' }, [
                el('span', { class: 'tile__name', text: scenario.title }),
                el('span', { class: 'world-tag', text: worldById(scenario.world || DEFAULT_WORLD)?.name || '' }),
              ]),
              el('div', { class: 'tiny faint', text: `場面 ${info.nodeCount}／戦闘 ${info.combatCount}／判定 ${info.checkCount}／結末 ${info.endingCount}` }),
            ]),
            el('div', { class: 'stack', style: { gap: '5px' } }, [
              el('button', { class: 'btn btn--sm', onclick: () => this.app.playScenario(scenario) }, ['遊ぶ']),
              el('button', {
                class: 'btn btn--sm btn--danger',
                onclick: async () => {
                  if (await confirmSheet('削除', `「${scenario.title}」を削除します。`, { danger: true, okText: '削除' })) {
                    deleteScenario(scenario.id); this.render();
                  }
                },
              }, ['削除']),
            ]),
          ]);
        }),
      ]) : el('p', { class: 'muted center tiny', text: 'まだ自作シナリオはありません。' }),
    ]));
  }

  /** A new scenario starts by choosing its setting — it changes everything. */
  createNew() {
    openSheet('どの世界観で作る？', el('div', { class: 'stack' }, WORLDS.map(world =>
      el('button', {
        class: 'tile',
        onclick: () => {
          closeSheet();
          this.save({ now: true });        // 書きかけを置き去りにしない
          this.scenario = blankScenario('新しいシナリオ', world.id);
          this.history = [];
          this.nodeId = 'start';
          this.syncWorld();
          this.render();
        },
      }, [
        el('div', { class: 'tile__head' }, [
          el('span', { class: 'tile__icon', text: world.icon }),
          el('span', { class: 'tile__name', text: world.name }),
        ]),
        el('div', { class: 'tile__desc', text: world.blurb }),
        el('div', { class: 'tiny faint', text: `${world.classes.length} クラス／${Object.keys(world.monsters).length} 種の敵` }),
      ]))));
  }

  async importFile() {
    try {
      const data = await pickJSON();
      const result = validate(data, { monsters: MONSTERS });
      if (!result.ok) { toast(`読み込めません: ${result.errors[0]}`); return; }
      this.save({ now: true });           // 書きかけを置き去りにしない
      this.scenario = normalize(data);
      this.history = [];
      this.nodeId = data.start;
      this.syncWorld();
      putScenario(this.scenario);
      this.render();
      toast('読み込みました');
    } catch (err) {
      toast(err.message);
    }
  }

  /* ------------------------------------------------------------- editor */

  renderEditor() {
    const scenario = this.scenario;
    const result = validate(scenario, { monsters: MONSTERS });
    const nodeIds = Object.keys(scenario.nodes);
    if (!this.nodeId || !scenario.nodes[this.nodeId]) this.nodeId = nodeIds[0];

    clear(this.root).append(el('div', { class: 'play' }, [
      el('div', { class: 'stack' }, [
        this.metaCard(),
        this.nodeCard(scenario.nodes[this.nodeId]),
      ]),
      el('div', { class: 'play__side stack' }, [
        this.issuesCard(result),
        this.nodesCard(nodeIds),
      ]),
    ]));
  }

  metaCard() {
    const s = this.scenario;
    return el('div', { class: 'card stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: 'シナリオ設定' }),
        el('div', { class: 'row', style: { gap: '5px' } }, [
          button(`↶ 元に戻す${this.history.length ? `（${this.history.length}）` : ''}`,
            () => this.undo(), `btn btn--sm ${this.history.length ? '' : 'btn--ghost'}`),
          button('一覧へ', () => {
            this.save({ now: true });      // 押し間違いでも、書いたものは残る
            this.scenario = null;
            this.history = [];
            this.render();
          }, 'btn btn--sm btn--ghost'),
        ]),
      ]),
      field('タイトル', el('input', {
        class: 'input', value: s.title,
        oninput: e => { s.title = e.target.value; this.typed(); },
      })),
      field('あらすじ', el('textarea', {
        class: 'textarea', value: s.blurb || '',
        oninput: e => { s.blurb = e.target.value; this.typed(); },
      })),
      field('世界観（クラス・装備・敵・技能が入れ替わります）', el('select', {
        class: 'select',
        onchange: e => {
          s.world = e.target.value;
          this.syncWorld();
          toast('世界観を変えました。既存の敵や技能の指定は要見直しです。');
          this.render();
        },
      }, WORLDS.map(w => el('option', { value: w.id, text: `${w.icon} ${w.name}`, selected: w.id === (s.world || DEFAULT_WORLD) })))),
      el('div', { class: 'row' }, [
        el('div', { class: 'grow' }, [field('開始する場面', el('select', {
          class: 'select',
          onchange: e => { s.start = e.target.value; this.render(); },
        }, Object.keys(s.nodes).map(id =>
          el('option', { value: id, text: `${id}｜${s.nodes[id].title || '無題'}`, selected: id === s.start }))))]),
        el('div', { style: { width: '110px' } }, [field('想定レベル', el('input', {
          class: 'input', type: 'number', min: 1, max: 10, value: s.level || 1,
          oninput: e => { s.level = Number(e.target.value) || 1; this.typed(); },
        }))]),
      ]),
      el('div', { class: 'row' }, [
        button('保存', () => { putScenario(this.scenario); toast('保存しました'); }, 'btn grow'),
        button('遊ぶ', () => this.playTest(), 'btn btn--primary grow'),
        button('書き出す', () => downloadJSON(this.scenario, `${this.scenario.id}.json`), 'btn grow'),
      ]),
    ]);
  }

  playTest() {
    const result = validate(this.scenario, { monsters: MONSTERS });
    if (!result.ok) { toast(`まだ遊べません: ${result.errors[0]}`); return; }
    putScenario(this.scenario);
    this.app.playScenario(this.scenario);
  }

  issuesCard(result) {
    const items = [
      ...result.errors.map(text => ({ text, cls: 'issue' })),
      ...result.warnings.map(text => ({ text, cls: 'issue issue--warn' })),
    ];
    return el('div', { class: 'card card--flat stack' }, [
      el('h3', { class: 'card__title', text: '点検' }),
      items.length
        ? el('div', { class: 'issues' }, items.slice(0, 12).map(i => el('div', { class: i.cls, text: i.text })))
        : el('div', { class: 'issue issue--ok', text: '問題は見つかりません。遊べます。' }),
    ]);
  }

  nodesCard(nodeIds) {
    return el('div', { class: 'card card--flat stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: `場面（${nodeIds.length}）` }),
        button('＋ 場面を足す', () => { this.mark(); this.addNode(); }, 'btn btn--sm'),
      ]),
      el('div', { class: 'node-list' }, nodeIds.map(id => {
        const node = this.scenario.nodes[id];
        return el('button', {
          class: 'node-row', 'aria-current': id === this.nodeId,
          onclick: () => { this.nodeId = id; this.render(); },
        }, [
          el('span', { class: 'node-row__title', text: node.title || '（無題）' }),
          node.combat ? el('span', { class: 'badge badge--combat', text: '戦' }) : null,
          node.ending ? el('span', { class: 'badge badge--end', text: '終' }) : null,
          id === this.scenario.start ? el('span', { class: 'badge', text: '始' }) : null,
          el('span', { class: 'node-row__id', text: id }),
        ]);
      })),
    ]);
  }

  addNode() {
    const id = `node${Object.keys(this.scenario.nodes).length + 1}_${Math.random().toString(36).slice(2, 5)}`;
    this.scenario.nodes[id] = { id, title: '新しい場面', text: [''], choices: [] };
    this.nodeId = id;
    this.render();
  }

  /* ---------------------------------------------------------- node form */

  nodeCard(node) {
    if (!node) return el('p', { class: 'muted', text: '場面がありません。' });
    const update = () => this.render();

    return el('div', { class: 'card stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: `場面：${node.id}` }),
        el('div', { class: 'row', style: { gap: '5px' } }, [
          button('複製', () => { this.mark(); this.duplicateNode(node); }, 'btn btn--sm'),
          button('削除', () => this.removeNode(node), 'btn btn--sm btn--danger'),
        ]),
      ]),

      field('見出し', el('input', {
        class: 'input', value: node.title || '',
        oninput: e => { node.title = e.target.value; this.typed(); },
      })),
      field('アイコン（絵文字）', el('input', {
        class: 'input', value: node.art || '', maxlength: 4,
        oninput: e => { node.art = e.target.value; this.typed(); },
      })),
      field('本文（空行で段落を分ける）', el('textarea', {
        class: 'textarea', style: { minHeight: '160px' },
        value: [].concat(node.text || []).join('\n'),
        oninput: e => { node.text = e.target.value.split('\n'); this.typed(); },
      })),

      el('hr', { class: 'divider' }),
      this.choicesBlock(node, update),
      el('hr', { class: 'divider' }),
      this.combatBlock(node, update),
      el('hr', { class: 'divider' }),
      this.endingBlock(node, update),
    ]);
  }

  duplicateNode(node) {
    const id = `${node.id}_copy`;
    this.scenario.nodes[id] = { ...structuredClone(node), id };
    this.nodeId = id;
    this.render();
  }

  async removeNode(node) {
    if (Object.keys(this.scenario.nodes).length <= 1) { toast('最後の場面は消せません'); return; }
    if (!await confirmSheet('場面を削除', `「${node.title || node.id}」を削除します。ここへのリンクは切れます。（元に戻せます）`, { danger: true, okText: '削除' })) return;
    this.mark();
    delete this.scenario.nodes[node.id];
    this.nodeId = Object.keys(this.scenario.nodes)[0];
    this.render();
  }

  choicesBlock(node, update) {
    node.choices = node.choices || [];
    const nodeOptions = (selected, onChange) => el('select', {
      class: 'select', onchange: e => { onChange(e.target.value || undefined); this.save(); },
    }, [
      el('option', { value: '', text: '（進まない）', selected: !selected }),
      ...Object.keys(this.scenario.nodes).map(id =>
        el('option', { value: id, text: `${this.scenario.nodes[id].title || id}`, selected: id === selected })),
    ]);

    return el('div', { class: 'stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: `選択肢（${node.choices.length}）` }),
        button('＋ 選択肢を足す', () => { this.mark(); node.choices.push({ text: '新しい選択肢', to: this.scenario.start }); update(); }, 'btn btn--sm'),
      ]),
      ...node.choices.map((choice, index) => el('div', { class: 'card card--flat stack', style: { gap: '8px' } }, [
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [el('input', {
            class: 'input', value: choice.text || '',
            oninput: e => { choice.text = e.target.value; this.typed(); },
          })]),
          el('button', { class: 'btn btn--sm btn--danger', onclick: () => { this.mark(); node.choices.splice(index, 1); update(); } }, ['×']),
        ]),

        el('div', { class: 'row' }, [
          el('label', { class: 'chip' }, [
            el('input', {
              type: 'checkbox', checked: !!choice.check,
              onchange: e => {
                choice.check = e.target.checked
                  ? { skill: 'perception', dc: 12, success: { to: choice.to }, fail: { to: choice.to } }
                  : undefined;
                update();
              },
            }),
            ' 判定つき',
          ]),
          el('label', { class: 'chip' }, [
            el('input', {
              type: 'checkbox', checked: !!choice.once,
              onchange: e => { choice.once = e.target.checked || undefined; this.save(); },
            }),
            ' 一度きり',
          ]),
        ]),

        choice.check
          ? el('div', { class: 'stack', style: { gap: '6px' } }, [
            el('div', { class: 'row' }, [
              el('div', { class: 'grow' }, [field('技能', el('select', {
                class: 'select', onchange: e => { choice.check.skill = e.target.value; this.save(); },
              }, SKILLS.map(s => el('option', { value: s.id, text: s.name, selected: s.id === choice.check.skill }))))]),
              el('div', { style: { width: '120px' } }, [field('DC', el('input', {
                class: 'input', type: 'number', min: 1, max: 30, value: choice.check.dc,
                oninput: e => { choice.check.dc = Number(e.target.value) || 10; this.typed(); },
              }))]),
            ]),
            el('p', { class: 'tiny faint', text: `DC${choice.check.dc} = ${difficultyLabel(choice.check.dc)}` }),
            field('成功したら', nodeOptions(choice.check.success?.to, v => {
              choice.check.success = { ...(choice.check.success || {}), to: v };
            })),
            field('成功時の描写', el('textarea', {
              class: 'textarea', style: { minHeight: '60px' },
              value: [].concat(choice.check.success?.text || []).join('\n'),
              oninput: e => {
                choice.check.success = { ...(choice.check.success || {}), text: e.target.value.split('\n').filter(Boolean) };
              },
            })),
            field('失敗したら', nodeOptions(choice.check.fail?.to, v => {
              choice.check.fail = { ...(choice.check.fail || {}), to: v };
            })),
            field('失敗時の描写', el('textarea', {
              class: 'textarea', style: { minHeight: '60px' },
              value: [].concat(choice.check.fail?.text || []).join('\n'),
              oninput: e => {
                choice.check.fail = { ...(choice.check.fail || {}), text: e.target.value.split('\n').filter(Boolean) };
              },
            })),
          ])
          : field('行き先', nodeOptions(choice.to, v => { choice.to = v; })),
      ])),
    ]);
  }

  combatBlock(node, update) {
    const enemies = node.combat?.enemies || [];
    const difficulty = enemies.length ? encounterDifficulty(enemies, this.scenario.level || 1, 4) : null;

    return el('div', { class: 'stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: '戦闘' }),
        el('label', { class: 'chip' }, [
          el('input', {
            type: 'checkbox', checked: !!node.combat,
            onchange: e => {
              this.mark();
              node.combat = e.target.checked
                ? { title: node.title || '戦闘', enemies: ['goblin'], onVictory: { to: this.scenario.start } }
                : undefined;
              update();
            },
          }),
          ' この場面で戦う',
        ]),
      ]),
      node.combat ? el('div', { class: 'stack', style: { gap: '8px' } }, [
        el('div', { class: 'chips' }, enemies.map((id, index) =>
          el('button', {
            class: 'chip is-on',
            onclick: () => { this.mark(); node.combat.enemies.splice(index, 1); update(); },
          }, [`${MONSTERS[id]?.name || id} ×`]))),
        difficulty ? el('p', { class: 'tiny muted', text: `想定難易度: ${difficulty.name}（XP ${difficulty.xp}）` }) : null,
        el('select', {
          class: 'select',
          onchange: e => { if (e.target.value) { this.mark(); node.combat.enemies.push(e.target.value); update(); } },
        }, [
          el('option', { value: '', text: '＋ 敵を追加…' }),
          ...Object.values(MONSTERS).sort((a, b) => a.cr - b.cr).map(m =>
            el('option', { value: m.id, text: `${m.name}（CR${m.cr}）` })),
        ]),
        field('勝ったら', el('select', {
          class: 'select',
          onchange: e => { node.combat.onVictory = { ...(node.combat.onVictory || {}), to: e.target.value }; },
        }, Object.keys(this.scenario.nodes).map(id =>
          el('option', { value: id, text: this.scenario.nodes[id].title || id, selected: id === node.combat.onVictory?.to })))),
        field('負けたら（未設定なら全滅エンド）', el('select', {
          class: 'select',
          onchange: e => { node.combat.onDefeat = e.target.value ? { to: e.target.value } : undefined; },
        }, [
          el('option', { value: '', text: '（全滅エンド）', selected: !node.combat.onDefeat }),
          ...Object.keys(this.scenario.nodes).map(id =>
            el('option', { value: id, text: this.scenario.nodes[id].title || id, selected: id === node.combat.onDefeat?.to })),
        ])),
      ]) : null,
    ]);
  }

  endingBlock(node, update) {
    return el('div', { class: 'stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: 'エンディング' }),
        el('label', { class: 'chip' }, [
          el('input', {
            type: 'checkbox', checked: !!node.ending,
            onchange: e => {
              this.mark();
              node.ending = e.target.checked ? { type: 'neutral', title: node.title || '結末', text: '' } : undefined;
              update();
            },
          }),
          ' ここで物語が終わる',
        ]),
      ]),
      node.ending ? el('div', { class: 'stack', style: { gap: '8px' } }, [
        el('div', { class: 'chips' }, [['good', '良い結末'], ['neutral', 'ひとつの結末'], ['bad', '苦い結末']].map(([id, label]) =>
          el('button', {
            class: `chip ${node.ending.type === id ? 'is-on' : ''}`,
            onclick: () => { node.ending.type = id; update(); },
          }, [label]))),
        field('結末の見出し', el('input', {
          class: 'input', value: node.ending.title || '',
          oninput: e => { node.ending.title = e.target.value; this.typed(); },
        })),
        field('結末の文章', el('textarea', {
          class: 'textarea', value: [].concat(node.ending.text || []).join('\n'),
          oninput: e => { node.ending.text = e.target.value.split('\n').filter(Boolean); this.typed(); },
        })),
      ]) : null,
    ]);
  }
}

const difficultyLabel = dc => {
  let best = DIFFICULTY[0];
  for (const d of DIFFICULTY) if (dc >= d.dc) best = d;
  return best.name;
};
