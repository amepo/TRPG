/* Scenario workshop — write, check and play your own adventures.

   The editor works on the same plain-data format the shipped scenarios use,
   so anything built here can be exported as JSON, shared, and played by the
   solo engine without conversion. */

import { el, frag, clear, toast, openSheet, closeSheet, confirmSheet, field, button } from './dom.js';
import {
  blankScenario, validate, describe, normalize,
} from '../core/scenario.js';
import { ABILITIES, SKILLS, skillName, DIFFICULTY } from '../core/rules.js';
import { MONSTERS, ITEMS, encounterDifficulty, CR_XP, xpForCr } from '../core/content.js';
import { listScenarios, putScenario, deleteScenario, downloadJSON, pickJSON } from '../core/store.js';
import { TEMPLATES } from '../templates.js';
import {
  effectsEditor, conditionEditor, describeEffect, describeConditionShort,
} from './effects.js';
import { WORLDS, useWorld, worldById, DEFAULT_WORLD } from '../worlds/index.js';

/* 工房が書けるもの、の宣言。収録シナリオが使っている書き方はすべてここに
   載っていなければならない——tests/effects-ui.test.js が突き合わせる。
   「JSON なら書けるが工房では書けない」を、増えた瞬間に落とすための表。 */
export const EDITABLE = {
  scenario: ['id', 'title', 'author', 'world', 'blurb', 'level', 'length', 'start',
    'vars', 'nodes', 'items', 'monsters', 'tutorial'],
  node: ['id', 'title', 'art', 'text', 'onEnter', 'repeatEffects', 'choices',
    'combat', 'netrun', 'ending'],
  choice: ['text', 'to', 'check', 'effects', 'once', 'if', 'requires', 'lockedText'],
  outcome: ['text', 'to', 'effects'],
  check: ['skill', 'dc', 'advantage', 'advantageIf', 'success', 'fail'],
  combat: ['title', 'enemies', 'surprise', 'onVictory', 'onDefeat', 'onFlee'],
  netrun: ['title', 'traceMax', 'layers', 'ice', 'onSuccess', 'onTraced'],
  layer: ['name', 'skill', 'dc', 'text', 'effects', 'onFail'],
  ending: ['type', 'title', 'text', 'noPay'],
  monster: ['id', 'name', 'kind', 'cr', 'xp', 'acOverride', 'hp', 'hpAvg', 'speed',
    'tactics', 'attacks', 'traits', 'blurb', 'backupId', 'abilities',
    'resistances', 'immunities', 'vulnerabilities'],
  item: ['id', 'name', 'desc', 'cost', 'keep', 'saveAdvantageVs',
    'damage', 'type', 'ability', 'use', 'amount', 'consumable', 'cures', 'light'],
};

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

  /* 効果と条件の編集に渡す文脈。打ち間違えると黙って効かなくなるので、
     すでに使われている名前を候補として出す。 */
  editCtx() {
    const vars = Object.keys(this.scenario.vars || {});
    const items = [...new Set([...Object.keys(this.scenario.items || {}), ...Object.keys(ITEMS)])];
    const nodes = Object.values(this.scenario.nodes).map(n => ({ id: n.id, title: n.title }));
    return {
      vars, items, nodes,
      onMark: () => this.mark(),
      onChange: () => { this.save(); this.render(); },
    };
  }

  /* 効果や条件の箱。たたんでおいて、中身があれば要約を出す。 */
  foldable(title, summary, body) {
    return el('details', { class: 'fold', open: !!summary }, [
      el('summary', {}, [
        el('span', { class: 'tiny', style: { fontWeight: '600' }, text: title }),
        el('span', { class: 'tiny faint', style: { marginLeft: '6px' }, text: summary || 'なし' }),
      ]),
      el('div', { class: 'stack', style: { marginTop: '8px' } }, [body]),
    ]);
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

      this.templateCard(),

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

  /* 見本。開いてそのまま書き足してもいいし、JSON を手元に落として
     好きな編集器で書いてもいい。中身は埋め込んであるので通信は要らない。 */
  templateCard() {
    return el('div', { class: 'card stack' }, [
      el('h3', { class: 'card__title', text: '見本から始める' }),
      el('p', { class: 'tiny faint', text: '「開く」はそのまま編集に入ります。「.json」は手元に保存して、好きな編集器で書けます。' }),
      ...TEMPLATES.map(template => el('div', { class: 'row', style: { gap: '6px', alignItems: 'stretch' } }, [
        el('div', { class: 'grow stack', style: { gap: '2px' } }, [
          el('div', { style: { fontWeight: '600' }, text: template.data.title || template.key }),
          el('div', { class: 'tiny faint', style: { lineHeight: '1.6' }, text: template.note }),
        ]),
        button('開く', () => this.openTemplate(template), 'btn btn--sm'),
        button('.json', () => {
          downloadJSON(template.data, template.file);
          toast(`${template.file} を保存しました`);
        }, 'btn btn--sm btn--ghost'),
      ])),
    ]);
  }

  /** 見本を自分のものとして開く。id は振り直す——見本を上書きしないため。 */
  openTemplate(template) {
    this.save({ now: true });
    const copy = normalize(structuredClone(template.data));
    copy.id = `sc_${Date.now().toString(36)}`;
    copy.title = `${template.data.title}（写し）`;
    this.scenario = copy;
    this.nodeId = copy.start;
    this.history = [];
    this.syncWorld();
    this.save({ now: true });
    this.render();
    toast('見本を開きました');
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
        this.itemsCard(),
        this.monstersCard(),
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
      /* 変数はここで宣言する。効果や条件から名前で参照するので、
         先に一覧があるほうが打ち間違えない。 */
      this.foldable(
        '変数',
        Object.entries(s.vars || {}).map(([k, v]) => `${k}=${v}`).join('、'),
        frag(
          el('p', { class: 'tiny faint', text: '数えたいもの。効果で動かし、条件で見て、本文には {var:名前} で差し込めます。' }),
          ...Object.entries(s.vars || {}).map(([name, value]) => el('div', { class: 'row', style: { gap: '6px' } }, [
            el('div', { class: 'grow' }, [el('input', {
              class: 'input', value: name,
              onchange: e => {
                const next = e.target.value.trim();
                if (!next || next === name) return;
                this.mark();
                const kept = s.vars[name];
                delete s.vars[name];
                s.vars[next] = kept;
                this.save();
                this.render();
              },
            })]),
            el('div', { style: { width: '90px' } }, [el('input', {
              class: 'input', type: 'number', value: value,
              oninput: e => { s.vars[name] = Number(e.target.value) || 0; this.typed(); },
            })]),
            el('button', {
              class: 'btn btn--sm btn--danger',
              onclick: () => { this.mark(); delete s.vars[name]; this.save(); this.render(); },
            }, ['×']),
          ])),
          button('＋ 変数を足す', () => {
            this.mark();
            s.vars = s.vars || {};
            let name = 'count';
            for (let i = 2; s.vars[name] !== undefined; i++) name = `count${i}`;
            s.vars[name] = 0;
            this.save();
            this.render();
          }, 'btn btn--sm'),
        ),
      ),

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

  /* ------------------------------------------------------ 自作のアイテム */

  /* 世界の道具で足りないときのために。手紙、鍵、証拠——物語のためだけの
     持ち物は、たいてい世界の品目には無い。エンジンは前から scenario.items を
     見ていたが、これも書ける場所が JSON しかなかった。 */
  itemsCard() {
    const bag = this.scenario.items || {};
    const list = Object.entries(bag);
    return el('div', { class: 'card card--flat stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: `自作のアイテム（${list.length}）` }),
        button('＋ アイテムを作る', () => this.addItem(), 'btn btn--sm'),
      ]),
      el('p', { class: 'tiny faint', text: '効果の「持ち物を渡す」と、条件の「持ち物がある」から名前で選べます。' }),
      ...list.map(([id, item]) => el('div', { class: 'card card--flat stack', style: { gap: '6px' } }, [
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [field('名前', el('input', {
            class: 'input', value: item.name || '',
            oninput: e => { item.name = e.target.value; this.typed(); },
            onchange: () => { this.save(); this.render(); },
          }))]),
          el('div', { style: { width: '92px' } }, [field('値段', el('input', {
            class: 'input', type: 'number', min: 0, value: item.cost ?? 0,
            oninput: e => { item.cost = Number(e.target.value) || 0; this.typed(); },
          }))]),
        ]),
        field('説明', el('input', {
          class: 'input', value: item.desc || '',
          oninput: e => { item.desc = e.target.value; this.typed(); },
        })),

        /* 何をする品か。持っているだけのものと、殴れるものと、使えるもの。 */
        field('種類', el('select', {
          class: 'select select--item-kind',
          onchange: e => {
            this.mark();
            for (const key of ['damage', 'type', 'ability', 'use', 'amount', 'consumable']) delete item[key];
            if (e.target.value === 'weapon') Object.assign(item, { damage: '1d6', type: '打撃', ability: 'str' });
            if (e.target.value === 'use') Object.assign(item, { use: 'heal', amount: '2d4+2', consumable: true });
            this.save();
            this.render();
          },
        }, [
          ['story', '物語の品（持っているだけ）'],
          ['weapon', '武器として振れる'],
          ['use', '使うと効く（消耗品）'],
        ].map(([value, text]) => el('option', {
          value, text, selected: itemKindOf(item) === value,
        })))),

        itemKindOf(item) === 'weapon' ? el('div', { class: 'row' }, [
          el('div', { style: { width: '96px' } }, [field('ダメージ', el('input', {
            class: 'input', value: item.damage || '', placeholder: '1d6',
            oninput: e => { item.damage = e.target.value; this.typed(); },
          }))]),
          el('div', { style: { width: '88px' } }, [field('種別', el('input', {
            class: 'input', value: item.type || '', placeholder: '刺突',
            oninput: e => { item.type = e.target.value; this.typed(); },
          }))]),
          el('div', { class: 'grow' }, [field('使う能力値', el('select', {
            class: 'select', onchange: e => { item.ability = e.target.value; this.save(); },
          }, ABILITIES.map(a => el('option', { value: a.id, text: a.name, selected: a.id === item.ability }))))]),
        ]) : null,

        itemKindOf(item) === 'use' ? el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [field('効き方', el('select', {
            class: 'select',
            onchange: e => { this.mark(); item.use = e.target.value; this.save(); this.render(); },
          }, [
            ['heal', '回復する'],
            ['damage', '投げてダメージ'],
          ].map(([value, text]) => el('option', { value, text, selected: (item.use || 'heal') === value }))))]),
          el('div', { style: { width: '110px' } }, [field('量', el('input', {
            class: 'input', value: item.amount || '', placeholder: '2d4+2',
            oninput: e => { item.amount = e.target.value; this.typed(); },
          }))]),
        ]) : null,

        el('div', { class: 'row' }, [
          el('label', { class: 'chip' }, [
            el('input', {
              type: 'checkbox', checked: !!item.keep,
              onchange: e => { this.mark(); item.keep = e.target.checked || undefined; this.save(); this.render(); },
            }),
            ' 手放せない（売れない）',
          ]),
          el('label', { class: 'chip' }, [
            el('input', {
              type: 'checkbox', checked: !!(item.saveAdvantageVs || []).length,
              onchange: e => {
                this.mark();
                item.saveAdvantageVs = e.target.checked ? ['frightened'] : undefined;
                this.save();
                this.render();
              },
            }),
            ' 持つ者は恐怖セーヴに有利',
          ]),
        ]),

        el('div', { class: 'row' }, [
          el('span', { class: 'tiny faint grow', text: `id: ${id}` }),
          button('消す', async () => {
            const ok = await confirmSheet('このアイテムを消す', `「${item.name || id}」を消します。渡す効果や持ち物の条件で使っていると、そこが空になります。`, { danger: true, okText: '消す' });
            if (!ok) return;
            this.mark();
            delete this.scenario.items[id];
            this.save();
            this.render();
          }, 'btn btn--sm btn--danger'),
        ]),
      ])),
    ]);
  }

  addItem() {
    this.mark();
    this.scenario.items = this.scenario.items || {};
    let id = 'item';
    for (let i = 2; this.scenario.items[id]; i++) id = `item${i}`;
    this.scenario.items[id] = { id, name: '新しいアイテム', desc: '', cost: 0 };
    this.save();
    this.render();
  }

  /* --------------------------------------------------------- 自作の敵 */

  /* 世界の敵で足りないときのために。エンジンは前から scenario.monsters を
     見ていたが、書ける場所が JSON しかなかった。「敵モブとか自分で追加したい」
     という声はもっともで、工房から作れないと存在しないのと同じ。 */
  monstersCard() {
    const bag = this.scenario.monsters || {};
    const list = Object.entries(bag);
    return el('div', { class: 'card card--flat stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: `自作の敵（${list.length}）` }),
        button('＋ 敵を作る', () => this.addMonster(), 'btn btn--sm'),
      ]),
      el('p', { class: 'tiny faint', text: 'ここで作った敵は、戦闘の「敵を追加」に出てきます。同じ敵を並べればＡＢＣが振られます。' }),
      ...list.map(([id, monster]) => this.monsterForm(id, monster)),
    ]);
  }

  addMonster() {
    this.mark();
    this.scenario.monsters = this.scenario.monsters || {};
    let id = 'mob';
    for (let i = 2; this.scenario.monsters[id]; i++) id = `mob${i}`;
    this.scenario.monsters[id] = {
      id, name: '新しい敵', kind: '人型', cr: 0.25, xp: xpForCr(0.25),
      acOverride: 12, hpAvg: 9, speed: 9, tactics: 'brute',
      attacks: [{ name: '殴る', bonus: 3, damage: '1d6+1', type: '打撃' }],
      blurb: '',
    };
    this.save();
    this.render();
  }

  monsterForm(id, m) {
    const touch = () => { this.typed(); };
    const num = (label, key, opts = {}) => field(label, el('input', {
      class: 'input', type: 'number', value: m[key] ?? 0, ...opts,
      oninput: e => { m[key] = Number(e.target.value) || 0; touch(); },
    }));

    return this.foldable(
      m.name || id,
      `CR${m.cr}／HP${m.hpAvg}／AC${m.acOverride}`,
      frag(
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [field('名前', el('input', {
            class: 'input', value: m.name || '',
            oninput: e => { m.name = e.target.value; touch(); },
            // 打っている間は描き直さない（入力欄から指が外れる）。離れたら
            // 見出しに反映する——一覧が「新しい敵」のままだと探せない。
            onchange: () => { this.save(); this.render(); },
          }))]),
          el('div', { style: { width: '110px' } }, [field('種類（絵柄）', el('input', {
            class: 'input', value: m.kind || '',
            oninput: e => { m.kind = e.target.value; touch(); },
          }))]),
        ]),
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [field('手ごわさ（経験点が決まります）', el('select', {
            class: 'select',
            onchange: e => {
              this.mark();
              m.cr = Number(e.target.value);
              m.xp = xpForCr(m.cr);
              this.save();
              this.render();
            },
          }, Object.keys(CR_XP).map(cr => el('option', {
            value: cr, text: `CR ${cr}（${CR_XP[cr]}点）`, selected: Number(cr) === m.cr,
          }))))]),
        ]),
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [num('体力', 'hpAvg', { min: 1 })]),
          el('div', { class: 'grow' }, [num('AC', 'acOverride', { min: 1 })]),
          el('div', { class: 'grow' }, [num('移動(m)', 'speed', { min: 0 })]),
        ]),
        field('動き方', el('select', {
          class: 'select',
          onchange: e => { m.tactics = e.target.value; touch(); },
        }, [
          ['brute', '力押し：相手を選ばず殴る'],
          ['skirmish', '狙い撃ち：弱った相手から。自分が最後の一体で瀕死なら逃げる'],
          ['caster', '後衛狙い：ACの低い相手を狙い、遠隔があればそれを使う'],
        ].map(([value, text]) => el('option', { value, text, selected: (m.tactics || 'brute') === value })))),
        field('登場したときの一言', el('input', {
          class: 'input', value: m.blurb || '',
          oninput: e => { m.blurb = e.target.value; touch(); },
        })),

        el('p', { class: 'tiny faint', text: '攻撃（2つ以上あって CR1 以上なら、1ターンに全部振ります）' }),
        /* 一行に詰めると、狭い画面で攻撃名がつぶれて読めなくなる。
           名前を一段目に置いて、数字だけを並べる。 */
        ...(m.attacks || []).map((atk, index) => el('div', {
          class: 'stack',
          style: { gap: '6px', padding: '8px', border: '1px solid var(--line)', borderRadius: '8px' },
        }, [
          field('攻撃名', el('input', {
            class: 'input', value: atk.name || '', placeholder: '噛みつき',
            oninput: e => { atk.name = e.target.value; touch(); },
          })),
          el('div', { class: 'row', style: { gap: '6px' } }, [
            el('div', { style: { width: '76px' } }, [field('命中', el('input', {
              class: 'input', type: 'number', value: atk.bonus ?? 0,
              oninput: e => { atk.bonus = Number(e.target.value) || 0; touch(); },
            }))]),
            el('div', { class: 'grow' }, [field('ダメージ', el('input', {
              class: 'input', value: atk.damage || '', placeholder: '1d6+1',
              oninput: e => { atk.damage = e.target.value; touch(); },
            }))]),
            el('div', { style: { width: '92px' } }, [field('種類', el('input', {
              class: 'input', value: atk.type || '', placeholder: '打撃',
              oninput: e => { atk.type = e.target.value; touch(); },
            }))]),
          ]),
          el('div', { class: 'row' }, [
            el('label', { class: 'chip' }, [
              el('input', {
                type: 'checkbox', checked: !!atk.ranged,
                onchange: e => { this.mark(); atk.ranged = e.target.checked || undefined; this.save(); this.render(); },
              }),
              ' 遠隔',
            ]),
            el('button', {
              class: 'btn btn--sm btn--danger',
              onclick: () => { this.mark(); m.attacks.splice(index, 1); this.save(); this.render(); },
            }, ['この攻撃を消す']),
          ]),
        ])),
        el('div', { class: 'row' }, [
          button('＋ 攻撃を足す', () => {
            this.mark();
            m.attacks = m.attacks || [];
            m.attacks.push({ name: '攻撃', bonus: 3, damage: '1d6', type: '打撃' });
            this.save();
            this.render();
          }, 'btn btn--sm'),
          button('この敵を消す', async () => {
            const used = this.usedBy(id);
            const ok = await confirmSheet('この敵を消す', used.length
              ? `${used.join('、')}で使われています。消すと、その場面の敵が未知になります。`
              : `「${m.name}」を消します。`, { danger: true, okText: '消す' });
            if (!ok) return;
            this.mark();
            delete this.scenario.monsters[id];
            this.save();
            this.render();
          }, 'btn btn--sm btn--danger'),
        ]),
      ),
    );
  }

  /** その敵を出している場面の名前。消す前に見せる。 */
  usedBy(monsterId) {
    return Object.values(this.scenario.nodes)
      .filter(n => (n.combat?.enemies || []).includes(monsterId))
      .map(n => n.title || n.id);
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
      this.foldable(
        'この場面に入ったとき',
        (node.onEnter || []).map(describeEffect).join('、'),
        frag(
          effectsEditor(node.onEnter = node.onEnter || [], this.editCtx()),
          el('label', { class: 'chip', style: { marginTop: '6px' } }, [
            el('input', {
              type: 'checkbox', checked: !!node.repeatEffects,
              onchange: e => { this.mark(); node.repeatEffects = e.target.checked || undefined; update(); },
            }),
            ' 来るたびに毎回はたらく（既定は初回だけ）',
          ]),
        ),
      ),

      el('hr', { class: 'divider' }),
      this.choicesBlock(node, update),
      el('hr', { class: 'divider' }),
      this.combatBlock(node, update),
      el('hr', { class: 'divider' }),
      this.netrunBlock(node, update),
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
            field('振り方', el('select', {
              class: 'select',
              onchange: e => {
                this.mark();
                choice.check.advantage = e.target.value || undefined;
                this.save();
                this.render();
              },
            }, [
              ['', 'ふつうに1個振る'],
              ['advantage', '有利：2個振って高いほう'],
              ['disadvantage', '不利：2個振って低いほう'],
            ].map(([value, text]) => el('option', { value, text, selected: (choice.check.advantage || '') === value })))),
            /* 条件つきの有利。「名簿を持っていれば説得しやすい」のような、
               それまでの行いが判定に効く形。収録シナリオが6箇所で使っている。 */
            this.foldable(
              '有利になる条件',
              describeConditionShort(choice.check.advantageIf),
              frag(
                el('p', { class: 'tiny faint', text: '満たしていれば、この判定は2個振って高いほうを使います。' }),
                conditionEditor(choice.check.advantageIf, next => {
                  choice.check.advantageIf = next;
                  this.save();
                  this.render();
                }, this.editCtx()),
              ),
            ),
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
            this.foldable(
              '成功したときの効果',
              (choice.check.success?.effects || []).map(describeEffect).join('、'),
              effectsEditor(
                (choice.check.success = choice.check.success || {}).effects
                  = choice.check.success.effects || [],
                this.editCtx(),
              ),
            ),
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
            /* 成功側だけ効果を書けて、失敗側は書けなかった。失敗にこそ
               「時間を食う」「怪我をする」を置きたいので、同じものを出す。 */
            this.foldable(
              '失敗したときの効果',
              (choice.check.fail?.effects || []).map(describeEffect).join('、'),
              effectsEditor(
                (choice.check.fail = choice.check.fail || {}).effects
                  = choice.check.fail.effects || [],
                this.editCtx(),
              ),
            ),
          ])
          : field('行き先', nodeOptions(choice.to, v => { choice.to = v; })),

        /* 選んだときの効果と、出す／開く条件。ここが無いあいだ、
           自作シナリオは状態を持てなかった。 */
        this.foldable(
          '選んだときの効果',
          (choice.effects || []).map(describeEffect).join('、'),
          effectsEditor(choice.effects = choice.effects || [], this.editCtx()),
        ),
        this.foldable(
          '見せる条件',
          describeConditionShort(choice.if),
          frag(
            el('p', { class: 'tiny faint', text: '満たすまで、この選択肢は現れません。' }),
            conditionEditor(choice.if, next => {
              choice.if = next;
              this.save();
              this.render();
            }, this.editCtx()),
          ),
        ),
        this.foldable(
          '開く条件',
          describeConditionShort(choice.requires),
          frag(
            el('p', { class: 'tiny faint', text: '見えてはいるが、満たすまで押せません。' }),
            conditionEditor(choice.requires, next => {
              choice.requires = next;
              this.save();
              this.render();
            }, this.editCtx()),
            choice.requires ? field('押せない理由', el('input', {
              class: 'input', value: choice.lockedText || '',
              placeholder: describeConditionShort(choice.requires),
              oninput: e => { choice.lockedText = e.target.value || undefined; this.typed(); },
            })) : null,
          ),
        ),
      ])),
    ]);
  }

  combatBlock(node, update) {
    const enemies = node.combat?.enemies || [];
    const custom = this.scenario.monsters || {};
    const nameOf = id => custom[id]?.name || MONSTERS[id]?.name || id;
    const difficulty = enemies.length
      ? encounterDifficulty(enemies, this.scenario.level || 1, 4, custom)
      : null;

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
            class: 'chip is-on chip--enemy',
            onclick: () => { this.mark(); node.combat.enemies.splice(index, 1); update(); },
          }, [`${nameOf(id)} ×`]))),
        difficulty ? el('p', { class: 'tiny muted', text: `想定難易度: ${difficulty.name}（XP ${difficulty.xp}）` }) : null,
        el('select', {
          class: 'select select--add-enemy',
          onchange: e => { if (e.target.value) { this.mark(); node.combat.enemies.push(e.target.value); update(); } },
        }, [
          el('option', { value: '', text: '＋ 敵を追加…' }),
          /* 自作の敵を先に出す。作った直後に探させない。 */
          ...Object.values(custom).sort((a, b) => a.cr - b.cr).map(m =>
            el('option', { value: m.id, text: `★ ${m.name}（CR${m.cr}）` })),
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
        /* 逃げ道。収録シナリオは24箇所すべてで書いているのに、工房からは
           書けなかった。行き先が無いと、逃げた先が行き止まりになる。 */
        field('逃げたら', el('select', {
          class: 'select',
          onchange: e => { this.mark(); node.combat.onFlee = e.target.value ? { to: e.target.value } : undefined; this.save(); },
        }, [
          el('option', { value: '', text: '（逃げられない）', selected: !node.combat.onFlee }),
          ...Object.keys(this.scenario.nodes).map(id =>
            el('option', { value: id, text: this.scenario.nodes[id].title || id, selected: id === node.combat.onFlee?.to })),
        ])),
        field('不意打ち', el('select', {
          class: 'select',
          onchange: e => { this.mark(); node.combat.surprise = e.target.value || undefined; this.save(); },
        }, [
          ['', 'なし（同時に始まる）'],
          ['party', 'こちらが先手：敵は1ラウンド動けない'],
          ['enemy', '敵が先手：こちらが1ラウンド動けない'],
        ].map(([value, text]) => el('option', { value, text, selected: (node.combat.surprise || '') === value })))),
      ]) : null,
    ]);
  }

  /* ------------------------------------------------------------ 侵入 */

  /* ネットラン。層を順に抜けていくあいだ、追跡ゲージが溜まる。
     世界に電脳が無ければ（灯火）この欄自体を出さない——書けても効かないので。 */
  netrunBlock(node, update) {
    const world = worldById(this.scenario.world || DEFAULT_WORLD);
    if (!world?.netrun && !node.netrun) return null;

    const nodeOptions = (selected, onChange) => el('select', {
      class: 'select', onchange: e => { this.mark(); onChange(e.target.value || undefined); this.save(); },
    }, [
      el('option', { value: '', text: '（進まない）', selected: !selected }),
      ...Object.keys(this.scenario.nodes).map(id =>
        el('option', { value: id, text: this.scenario.nodes[id].title || id, selected: id === selected })),
    ]);

    return el('div', { class: 'stack' }, [
      el('div', { class: 'spread' }, [
        el('h3', { class: 'card__title', text: '侵入（電脳）' }),
        el('label', { class: 'chip' }, [
          el('input', {
            type: 'checkbox', checked: !!node.netrun,
            onchange: e => {
              this.mark();
              node.netrun = e.target.checked
                ? {
                  title: node.title || '侵入', traceMax: 5,
                  layers: [{ name: '外殻', skill: 'netops', dc: 12, text: [''] }],
                  onSuccess: { to: this.scenario.start }, onTraced: { to: this.scenario.start },
                }
                : undefined;
              update();
            },
          }),
          ' この場面は電脳に入る',
        ]),
      ]),
      node.netrun ? el('div', { class: 'stack', style: { gap: '8px' } }, [
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [field('接続先の名前', el('input', {
            class: 'input', value: node.netrun.title || '',
            oninput: e => { node.netrun.title = e.target.value; this.typed(); },
          }))]),
          el('div', { style: { width: '120px' } }, [field('逆探知まで', el('input', {
            class: 'input', type: 'number', min: 2, max: 12, value: node.netrun.traceMax ?? 5,
            oninput: e => { node.netrun.traceMax = Number(e.target.value) || 5; this.typed(); },
          }))]),
        ]),
        el('p', { class: 'tiny faint', text: '層を上から順に抜けます。失敗すると追跡が溜まり、逆探知の数に届くと弾かれます。' }),

        ...(node.netrun.layers || []).map((layer, index) => el('div', {
          class: 'card card--flat stack', style: { gap: '6px' },
        }, [
          el('div', { class: 'row' }, [
            el('div', { class: 'grow' }, [field(`第${index + 1}層の名前`, el('input', {
              class: 'input', value: layer.name || '',
              oninput: e => { layer.name = e.target.value; this.typed(); },
            }))]),
            el('button', {
              class: 'btn btn--sm btn--danger',
              onclick: () => { this.mark(); node.netrun.layers.splice(index, 1); update(); },
            }, ['×']),
          ]),
          el('div', { class: 'row' }, [
            el('div', { class: 'grow' }, [field('技能', el('select', {
              class: 'select', onchange: e => { layer.skill = e.target.value; this.save(); },
            }, SKILLS.map(sk => el('option', { value: sk.id, text: sk.name, selected: sk.id === layer.skill }))))]),
            el('div', { style: { width: '110px' } }, [field('DC', el('input', {
              class: 'input', type: 'number', min: 1, max: 30, value: layer.dc ?? 12,
              oninput: e => { layer.dc = Number(e.target.value) || 12; this.typed(); },
            }))]),
          ]),
          field('この層の描写', el('textarea', {
            class: 'textarea', style: { minHeight: '60px' },
            value: [].concat(layer.text || []).join('\n'),
            oninput: e => { layer.text = e.target.value.split('\n').filter(Boolean); this.typed(); },
          })),
          field('抜けたときの効果', frag(effectsEditor(layer.effects = layer.effects || [], this.editCtx()))),
          el('div', { class: 'row' }, [
            el('div', { style: { width: '120px' } }, [field('弾かれた傷', el('input', {
              class: 'input', value: layer.onFail?.damage || '', placeholder: '1d4',
              oninput: e => {
                layer.onFail = { ...(layer.onFail || {}), damage: e.target.value || undefined };
                this.typed();
              },
            }))]),
            el('div', { class: 'grow' }, [field('弾かれたときの描写', el('input', {
              class: 'input', value: [].concat(layer.onFail?.text || []).join(' '),
              oninput: e => {
                layer.onFail = { ...(layer.onFail || {}), text: e.target.value ? [e.target.value] : undefined };
                this.typed();
              },
            }))]),
          ]),
        ])),
        button('＋ 層を足す', () => {
          this.mark();
          node.netrun.layers = node.netrun.layers || [];
          node.netrun.layers.push({ name: `第${node.netrun.layers.length + 1}層`, skill: 'netops', dc: 12, text: [''] });
          update();
        }, 'btn btn--sm'),

        /* 防壁。世界の敵から選ぶ。ここに置くと、逆探知の前に戦闘が入る。 */
        el('div', { class: 'chips' }, (node.netrun.ice || []).map((id, index) =>
          el('button', {
            class: 'chip is-on chip--ice',
            onclick: () => { this.mark(); node.netrun.ice.splice(index, 1); update(); },
          }, [`${MONSTERS[id]?.name || this.scenario.monsters?.[id]?.name || id} ×`]))),
        el('select', {
          class: 'select select--add-ice',
          onchange: e => {
            if (!e.target.value) return;
            this.mark();
            node.netrun.ice = node.netrun.ice || [];
            node.netrun.ice.push(e.target.value);
            update();
          },
        }, [
          el('option', { value: '', text: '＋ 防壁（ICE）を置く…' }),
          ...Object.values(MONSTERS).filter(m => m.kind === 'ICE' || /ICE/.test(m.name))
            .map(m => el('option', { value: m.id, text: `${m.name}（CR${m.cr}）` })),
        ]),

        field('抜けたら', nodeOptions(node.netrun.onSuccess?.to, v => {
          node.netrun.onSuccess = { ...(node.netrun.onSuccess || {}), to: v };
        })),
        field('抜けたときの描写', el('textarea', {
          class: 'textarea', style: { minHeight: '60px' },
          value: [].concat(node.netrun.onSuccess?.text || []).join('\n'),
          oninput: e => {
            node.netrun.onSuccess = {
              ...(node.netrun.onSuccess || {}), text: e.target.value.split('\n').filter(Boolean),
            };
            this.typed();
          },
        })),
        field('逆探知されたら', nodeOptions(node.netrun.onTraced?.to, v => {
          node.netrun.onTraced = { ...(node.netrun.onTraced || {}), to: v };
        })),
        field('逆探知されたときの描写', el('textarea', {
          class: 'textarea', style: { minHeight: '60px' },
          value: [].concat(node.netrun.onTraced?.text || []).join('\n'),
          oninput: e => {
            node.netrun.onTraced = {
              ...(node.netrun.onTraced || {}), text: e.target.value.split('\n').filter(Boolean),
            };
            this.typed();
          },
        })),
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
        /* 報酬の点検（npm run economy）が読む印。良い結末なのに一銭も
           入らないと「取りこぼし」として挙がるので、わざとの場合はここで言う。 */
        el('label', { class: 'chip' }, [
          el('input', {
            type: 'checkbox', checked: !!node.ending.noPay,
            onchange: e => { this.mark(); node.ending.noPay = e.target.checked || undefined; this.save(); },
          }),
          ' 報酬を払わないことに意味がある結末',
        ]),
      ]) : null,
    ]);
  }
}

/* その品はどの型か。データの形から見分ける（型そのものは持たせない）。 */
const itemKindOf = item => (item?.damage ? 'weapon' : item?.use ? 'use' : 'story');

const difficultyLabel = dc => {
  let best = DIFFICULTY[0];
  for (const d of DIFFICULTY) if (dc >= d.dc) best = d;
  return best.name;
};
