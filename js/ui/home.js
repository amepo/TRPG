/* Title screen: pick a mode, or pick up where you left off. */

import { el, clear, toast, confirmSheet, button, openSheet, frag } from './dom.js';
import { catalogue, byId } from '../scenarios/index.js';
import { listSaves, deleteSave, listScenarios, usage } from '../core/store.js';
import { describe, validate } from '../core/scenario.js';
import { MONSTERS } from '../core/content.js';

export function homeScreen(root, { app }) {
  const saves = listSaves();

  clear(root).append(el('div', { class: 'stack' }, [
    el('div', { class: 'card center stack' }, [
      el('h2', { style: { fontSize: '26px' }, text: '灯火のテーブル' }),
      el('p', { class: 'muted tiny', text: 'd20 系ルールの TRPG。ブラウザだけで、通信なしで動きます。' }),
    ]),

    saves.length ? el('div', { class: 'card stack' }, [
      el('h3', { class: 'card__title', text: '続きから' }),
      ...saves.slice(0, 4).map(save => el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', {
          class: 'tile grow',
          onclick: () => app.resume(save),
        }, [
          el('div', { class: 'tile__head' }, [
            el('span', { class: 'tile__icon', text: save.finished ? '📕' : '📖' }),
            el('span', { class: 'tile__name', text: save.scenarioTitle || save.label }),
          ]),
          el('div', { class: 'tiny faint', text: `${save.nodeTitle || '—'}｜${(save.party || []).map(p => `${p.name} ${p.hp}/${p.maxHp}`).join('、')}` }),
          el('div', { class: 'tiny faint', text: formatWhen(save.savedAt) }),
        ]),
        el('button', {
          class: 'btn btn--sm btn--danger',
          onclick: async () => {
            if (await confirmSheet('セーブを削除', `「${save.scenarioTitle}」の記録を消します。`, { danger: true, okText: '削除' })) {
              deleteSave(save.id); homeScreen(root, { app });
            }
          },
        }, ['×']),
      ])),
    ]) : null,

    el('div', { class: 'grid grid--3' }, [
      modeTile('🗺️', 'ソロプレイ', 'シナリオを選んで、一人で最初から最後まで遊ぶ。判定も戦闘も自動で処理される。', () => app.go('scenarios')),
      modeTile('🎲', 'セッション支援', '対面やオンラインの卓で使う道具。ダイス、キャラクターシート、イニシアチブ表。', () => app.go('table')),
      modeTile('✍️', 'シナリオ工房', '自分の物語を書く。場面をつなぎ、判定と戦闘を置いて、そのまま遊べる。', () => app.go('editor')),
    ]),

    el('div', { class: 'card card--flat' }, [
      el('div', { class: 'row' }, [
        button('遊び方', () => openHelp(), 'btn btn--sm btn--ghost'),
        button('データの状況', () => openStorage(), 'btn btn--sm btn--ghost'),
      ]),
    ]),
  ]));
}

const modeTile = (icon, name, desc, onclick) => el('button', { class: 'tile', onclick }, [
  el('div', { class: 'tile__head' }, [
    el('span', { class: 'tile__icon', text: icon }),
    el('span', { class: 'tile__name', text: name }),
  ]),
  el('div', { class: 'tile__desc', text: desc }),
]);

/* ------------------------------------------------------- scenario picker */

export function scenarioScreen(root, { app }) {
  const built = catalogue();
  const mine = listScenarios();

  clear(root).append(el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: 'card__title', text: 'シナリオを選ぶ' }),
      el('p', { class: 'muted tiny', text: 'はじめてなら「はじめての依頼」から。10分ほどで一通りの操作を覚えられます。' }),
    ]),

    ...built.map(card => el('button', {
      class: 'tile',
      onclick: () => app.chooseScenario(byId(card.id)),
    }, [
      el('div', { class: 'tile__head' }, [
        el('span', { class: 'tile__icon', text: card.tutorial ? '🕯️' : '🔔' }),
        el('span', { class: 'tile__name', text: card.title }),
        el('span', { class: 'tiny faint grow', style: { textAlign: 'right' }, text: card.length }),
      ]),
      el('div', { class: 'tile__desc', text: card.blurb }),
      el('div', { class: 'tiny faint', text: `推奨Lv${card.level}｜場面 ${card.nodeCount}／戦闘 ${card.combatCount}／判定 ${card.checkCount}／結末 ${card.endingCount}` }),
    ])),

    mine.length ? el('div', { class: 'stack' }, [
      el('h3', { class: 'card__title', style: { marginTop: '8px' }, text: '自作シナリオ' }),
      ...mine.map(scenario => {
        const info = describe(scenario);
        const check = validate(scenario, { monsters: MONSTERS });
        return el('button', {
          class: 'tile',
          onclick: () => {
            if (!check.ok) { toast(`まだ遊べません: ${check.errors[0]}`); return; }
            app.chooseScenario(scenario);
          },
        }, [
          el('div', { class: 'tile__head' }, [
            el('span', { class: 'tile__icon', text: '📝' }),
            el('span', { class: 'tile__name', text: scenario.title }),
          ]),
          el('div', { class: 'tiny faint', text: `場面 ${info.nodeCount}／戦闘 ${info.combatCount}／結末 ${info.endingCount}${check.ok ? '' : '　⚠ 未完成'}` }),
        ]);
      }),
    ]) : null,
  ]));
}

/* ----------------------------------------------------------------- help */

function openHelp() {
  openSheet('遊び方', frag(
    section('ソロプレイ', [
      '物語が段落で流れ、下に選択肢が並びます。選ぶだけで進みます。',
      '【技能】と DC が書かれた選択肢は 1d20 判定です。誰が振るかを選べます（修正値が高い人ほど有利）。',
      '戦闘に入ると手番制になります。敵を選んでから行動を押してください。',
      'HPが0になっても即死ではありません。死亡セーヴに3回成功すれば持ち直します。',
    ]),
    section('判定の読み方', [
      '1d20 ＋ 能力修正 ＋（習熟していれば習熟ボーナス）が DC 以上なら成功。',
      'ナチュラル20は必ず命中してダメージダイスが倍、ナチュラル1は必ず失敗します。',
      '有利は 2d20 の高い方、不利は低い方を採用します。両方あると打ち消し合います。',
    ]),
    section('休憩', [
      '小休憩：ヒットダイスを1つ使って回復し、「再起」などの能力が戻ります。',
      '長休憩：HP全快、呪文スロットも全回復します。',
    ]),
    section('セッション支援', [
      'ダイスタブは 2d6+3 や 4d6kh3 のような式をそのまま受け付けます。',
      '「進行」タブはイニシアチブ表です。PCと敵を並べて手番を回せます。',
    ]),
    section('シナリオ工房', [
      '場面（ノード）を作り、選択肢でつなぎます。判定・戦闘・エンディングを置けます。',
      '「点検」に赤が出ていなければ遊べます。JSONで書き出して共有できます。',
    ]),
  ));
}

const section = (title, lines) => el('div', { style: { marginBottom: '16px' } }, [
  el('h3', { class: 'card__title', text: title }),
  ...lines.map(text => el('p', { class: 'muted tiny', style: { margin: '4px 0' }, text })),
]);

function openStorage() {
  const info = usage();
  openSheet('データの状況', frag(
    el('p', { class: 'muted tiny', text: 'すべて端末内（localStorage）に保存されています。サーバーには何も送られません。' }),
    el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: '使用量' }), el('span', { text: `${info.kb} KB` })]),
    el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: 'セーブ' }), el('span', { text: `${listSaves().length} 件` })]),
    el('div', { class: 'kv' }, [el('span', { class: 'kv__k', text: '自作シナリオ' }), el('span', { text: `${listScenarios().length} 件` })]),
  ));
}

function formatWhen(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'たった今';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 時間前`;
  return new Date(ts).toLocaleDateString('ja-JP');
}
