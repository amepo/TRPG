/* シナリオの骨組みを作る。白紙から 30 ノードを手書きしないための道具。

   6本書いて、構造は4つの型に収束した。型を選んで骨組みを出し、
   本文を埋める順で書くと速い（構造を先に固め、文章は最後）。

   使い方:
     node tools/new-scenario.js <id> --shape=hub --world=neon --title="題名"

   型:
     linear  導入・一本道。判定と戦闘を一度ずつ通す
     hub     ハブ探索。拠点から複数の調査先、手がかりが揃うと次へ
     clock   時間制限。変数が上限に達すると強制的に場面が変わる
     route   経路選択。複数の道のうち二区間を通って目的地へ */

import { writeFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
const opt = name => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

if (!id) {
  console.error('使い方: node tools/new-scenario.js <id> --shape=hub --world=neon --title="題名"');
  process.exit(1);
}

const shape = opt('shape') || 'hub';
const world = opt('world') || 'neon';
const title = opt('title') || '無題のシナリオ';
const varName = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/* 世界ごとに、骨組みで使う技能を変える。存在しない技能を書くと点検で落ちる。 */
const SKILLS = {
  neon: { look: 'perception', talk: 'persuasion', tech: 'tech', sneak: 'stealth', read: 'insight' },
  embers: { look: 'perception', talk: 'persuasion', tech: 'investigation', sneak: 'stealth', read: 'insight' },
}[world] || { look: 'perception', talk: 'persuasion', tech: 'investigation', sneak: 'stealth', read: 'insight' };

const ENEMY = world === 'neon' ? 'punk' : 'bandit';

const scene = (nid, t, art, body, choices) => `    ${nid}: {
      id: '${nid}', title: '${t}', art: '${art}',
      text: [
        ${body.map(b => `'${b}',`).join('\n        ')}
      ],
      choices: [
${choices}
      ],
    },`;

const ending = (nid, t, art, type, body, closing) => `    ${nid}: {
      id: '${nid}', title: '${t}', art: '${art}',
      text: ['${body}'],
      ending: {
        type: '${type}',
        title: '${t}',
        text: ['${closing}'],
      },
    },`;

const SHAPES = {
  linear: () => [
    scene('start', '導入', '📋', ['ここに情景。何を頼まれたのかを一段落で。', '——TODO: 導入の本文'], `        { text: '引き受ける', to: 'approach' },
        {
          text: '相手の様子を窺う',
          once: true,
          check: {
            skill: '${SKILLS.read}', dc: 11,
            success: { text: ['TODO: 見抜いたこと'], effects: [{ setFlag: 'sawThrough' }], to: 'approach' },
            fail: { text: ['TODO: 読めなかった'], to: 'approach' },
          },
        },`),
    scene('approach', '現場', '🚪', ['TODO: 現場の描写。障害が一つ見えている。'], `        {
          text: '静かに入る',
          check: {
            skill: '${SKILLS.sneak}', dc: 12,
            success: { text: ['TODO: 抜けた'], to: 'core' },
            fail: { text: ['TODO: 見つかった'], to: 'fight' },
          },
        },
        { text: '正面から入る', to: 'fight' },`),
    `    fight: {
      id: 'fight', title: '衝突', art: '⚔️',
      text: ['TODO: 戦闘に入る一行'],
      combat: {
        title: 'TODO',
        enemies: ['${ENEMY}', '${ENEMY}'],
        onVictory: { text: ['TODO: 勝った後'], to: 'core' },
        onDefeat: { to: 'endBad' },
        onFlee: { to: 'endBad' },
      },
    },`,
    scene('core', '核心', '🔍', ['TODO: ここで一番の情報か物が手に入る。'], `        { text: 'TODO: 良い側の選択', to: 'endGood' },
        { text: 'TODO: 割り切る側の選択', to: 'endPlain' },`),
    ending('endGood', 'TODO 良い結末', '🌅', 'good', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endPlain', 'TODO ひとつの結末', '🚶', 'neutral', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endBad', 'TODO 苦い結末', '🩸', 'bad', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
  ],

  hub: () => [
    scene('start', '依頼', '📋', ['TODO: 依頼を受ける場面。'], `        { text: '引き受ける', to: 'hub' },`),
    scene('hub', '拠点', '🏙️', ['TODO: 調べられる先が三つ。', '（手がかりが揃うと次へ進める）'], `        { text: 'TODO: 調査先A', to: 'leadA' },
        { text: 'TODO: 調査先B', to: 'leadB' },
        { text: 'TODO: 調査先C', to: 'leadC' },
        {
          text: 'TODO: 核心へ向かう',
          requires: { var: 'clues', gte: 2 },
          lockedText: 'まだ手がかりが足りない',
          to: 'core',
        },
        {
          // 条件が揃わなくても進める道。無いとハブから出られなくなる。
          text: 'TODO: 手がかりがないまま踏み込む',
          if: { var: 'clues', lte: 1 },
          effects: [{ log: 'TODO: 代償の一行', kind: 'bad' }],
          to: 'core',
        },`),
    ...['A', 'B', 'C'].map((L, i) => scene(`lead${L}`, `TODO 調査先${L}`, '🔍', [`TODO: 調査先${L}の描写`],
      `        {
          text: 'TODO: 調べる',
          once: true,
          check: {
            skill: '${[SKILLS.look, SKILLS.talk, SKILLS.tech][i]}', dc: 12,
            success: {
              text: ['TODO: 分かったこと'],
              effects: [{ var: 'clues', add: 1 }, { setFlag: 'lead${L}' }],
              to: 'hub',
            },
            fail: { text: ['TODO: 空振り'], to: 'hub' },
          },
        },
        { text: '拠点に戻る', to: 'hub' },`)),
    scene('core', '核心', '🕯️', ['TODO: 真相が見える場面。'], `        { text: 'TODO: 対決する', to: 'fight' },
        {
          text: 'TODO: 話し合う',
          check: {
            skill: '${SKILLS.talk}', dc: 14,
            success: { text: ['TODO: 通じた'], to: 'endGood' },
            fail: { text: ['TODO: 通じなかった'], to: 'fight' },
          },
        },`),
    `    fight: {
      id: 'fight', title: '対決', art: '⚔️',
      text: ['TODO: 戦闘に入る一行'],
      combat: {
        title: 'TODO',
        enemies: ['${ENEMY}', '${ENEMY}'],
        onVictory: { text: ['TODO: 勝った後'], to: 'endPlain' },
        onDefeat: { to: 'endBad' },
        onFlee: { to: 'endBad' },
      },
    },`,
    ending('endGood', 'TODO 良い結末', '🌅', 'good', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endPlain', 'TODO ひとつの結末', '🚶', 'neutral', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endBad', 'TODO 苦い結末', '🩸', 'bad', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
  ],

  clock: () => [
    scene('plan', '下見', '🔭', ['TODO: 下見の場面。重ねるほど本番が楽になる。'], `        {
          text: 'TODO: 下見A',
          once: true,
          check: {
            skill: '${SKILLS.look}', dc: 12,
            success: { text: ['TODO'], effects: [{ var: 'prep', add: 1 }, { setFlag: 'prepA' }], to: 'plan' },
            fail: { text: ['TODO'], to: 'plan' },
          },
        },
        {
          text: 'TODO: 下見B',
          once: true,
          check: {
            skill: '${SKILLS.tech}', dc: 12,
            success: { text: ['TODO'], effects: [{ var: 'prep', add: 1 }, { setFlag: 'prepB' }], to: 'plan' },
            fail: { text: ['TODO'], to: 'plan' },
          },
        },
        { text: '本番へ', to: 'run' },`),
    scene('run', '本番', '🕑', ['TODO: ここから時計が進む。'], `        {
          text: 'TODO: 静かな手（下見が要る）',
          requires: { flag: 'prepA' },
          lockedText: 'TODO: 下見していない',
          effects: [{ var: 'clock', add: 1 }],
          to: 'target',
        },
        {
          text: 'TODO: 強引な手',
          effects: [{ var: 'clock', add: 2 }],
          to: 'target',
        },`),
    scene('target', '目的地', '🔐', ['TODO: 目的の場面。時間との勝負。'], `        {
          text: 'TODO: 慎重にやる',
          effects: [{ var: 'clock', add: 2 }],
          check: {
            skill: '${SKILLS.tech}', dc: 14,
            success: { text: ['TODO: 成功'], to: 'escape' },
            fail: { text: ['TODO: 失敗'], effects: [{ var: 'clock', add: 1 }], to: 'target' },
          },
        },
        {
          text: 'TODO: 時間切れが近い。引く',
          if: { var: 'clock', gte: 6 },
          to: 'timeUp',
        },`),
    scene('escape', '脱出', '🏃', ['TODO: 戻り道'], `        { text: 'TODO: 逃げ切る', if: { var: 'clock', lte: 7 }, to: 'endGood' },
        { text: 'TODO: 間に合わない', if: { var: 'clock', gte: 8 }, to: 'timeUp' },`),
    `    timeUp: {
      id: 'timeUp', title: '時間切れ', art: '⏱️',
      text: ['TODO: 時間が尽きた場面'],
      combat: {
        title: 'TODO',
        enemies: ['${ENEMY}', '${ENEMY}'],
        onVictory: { text: ['TODO'], to: 'endPlain' },
        onDefeat: { to: 'endBad' },
        onFlee: { to: 'endBad' },
      },
    },`,
    ending('endGood', 'TODO 良い結末', '🌅', 'good', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endPlain', 'TODO ひとつの結末', '🚶', 'neutral', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endBad', 'TODO 苦い結末', '🩸', 'bad', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
  ],

  route: () => [
    scene('start', '出発', '🚗', ['TODO: 出発の場面。'], `        { text: '出す', to: 'route' },`),
    scene('route', '道を選ぶ', '🗺️', ['TODO: 道が三つ。それぞれ危険が違う。'], `        { text: 'TODO: 道A', to: 'legA' },
        { text: 'TODO: 道B', to: 'legB' },
        { text: 'TODO: 道C', to: 'legC' },`),
    ...['A', 'B', 'C'].map((L, i) => scene(`leg${L}`, `TODO 道${L}`, '🛣️', [`TODO: 道${L}の描写`],
      `        {
          text: 'TODO: 切り抜ける',
          check: {
            skill: '${[SKILLS.sneak, SKILLS.talk, SKILLS.look][i]}', dc: 12,
            success: { text: ['TODO: 抜けた'], to: 'waypoint' },
            fail: { text: ['TODO: 捕まった'], effects: [{ var: 'pursuit', add: 1 }], to: 'trouble' },
          },
        },`)),
    `    trouble: {
      id: 'trouble', title: '道中の衝突', art: '⚔️',
      text: ['TODO: 戦闘に入る一行'],
      combat: {
        title: 'TODO',
        enemies: ['${ENEMY}', '${ENEMY}'],
        onVictory: { text: ['TODO'], to: 'waypoint' },
        onDefeat: { to: 'endBad' },
        onFlee: { effects: [{ var: 'pursuit', add: 1 }], to: 'waypoint' },
      },
    },`,
    `    waypoint: {
      id: 'waypoint', title: '一度止まる', art: '🚙',
      text: ['TODO: 中継点。もう一区間ある。'],
      onEnter: [{ var: 'legs', add: 1 }],
      repeatEffects: true,
      choices: [
        {
          text: '次の区間へ——別の道に乗り換える',
          if: { var: 'legs', lte: 1 },
          to: 'route',
        },
        {
          text: '目的地へ',
          requires: { var: 'legs', gte: 2 },
          lockedText: 'まだ一区間ある',
          to: 'arrival',
        },
      ],
    },`,
    scene('arrival', '到着', '🌅', ['TODO: 目的地の場面。'], `        { text: 'TODO: 良い側の選択', to: 'endGood' },
        { text: 'TODO: 割り切る側の選択', to: 'endPlain' },`),
    ending('endGood', 'TODO 良い結末', '🌅', 'good', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endPlain', 'TODO ひとつの結末', '🚶', 'neutral', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
    ending('endBad', 'TODO 苦い結末', '🩸', 'bad', 'TODO: 結末の一段落', 'TODO: 締めの一行'),
  ],
};

if (!SHAPES[shape]) {
  console.error(`型は ${Object.keys(SHAPES).join(' / ')} のいずれかです`);
  process.exit(1);
}

const VARS = {
  linear: '{}', hub: '{ clues: 0 }', clock: '{ clock: 0, prep: 0 }', route: '{ pursuit: 0, legs: 0 }',
}[shape];
const START = { linear: 'start', hub: 'start', clock: 'plan', route: 'start' }[shape];

const source = `/* シナリオ「${title}」— ${world === 'neon' ? 'ネオンの雨' : '灯火のテーブル'}・${shape} 型の骨組み。

   TODO を埋めてから \`npm run playtest -- ${id}\` で長さと分岐を測る。
   本文は最後に書く。構造を先に固めないと、直すたびに書き直しになる。 */

export const ${varName} = {
  id: '${id}',
  title: '${title}',
  author: '灯火のテーブル',
  world: '${world}',
  blurb: 'TODO: 一行のあらすじ',
  level: 1,
  length: '短編（30〜45分）',
  start: '${START}',
  vars: ${VARS},

  nodes: {
${SHAPES[shape]().join('\n\n')}
  },
};

export default ${varName};
`;

/* --json を渡すと、工房が読み込める JSON として書き出す。
   骨組みは同じものを使う——見本が本体とずれると意味がないので。 */
if (opt('json') !== undefined || process.argv.includes('--json')) {
  const temp = join(ROOT, 'templates', `.${id}.tmp.mjs`);
  await writeFile(temp, source);
  const { default: scenario } = await import(pathToFileURL(temp).href);
  await rm(temp);
  const out = join(ROOT, 'templates', `${id}.json`);
  await writeFile(out, `${JSON.stringify(scenario, null, 2)}\n`);
  console.log(`templates/${id}.json を作りました（${shape} 型）`);
  process.exit(0);
}

const path = join(ROOT, 'js/scenarios', `${id}.js`);
try {
  await access(path);
  console.error(`${id}.js はすでにあります`);
  process.exit(1);
} catch { /* 無いので作る */ }

await writeFile(path, source);
console.log(`js/scenarios/${id}.js を作りました（${shape} 型）`);
console.log('次: npm run sync && npm run playtest -- ' + id);
