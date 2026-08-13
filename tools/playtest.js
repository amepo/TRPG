/* シナリオの健康診断 — 自動で何十回も遊んで、実際の手触りを数字にする。

   書いている最中には分からないことがある。長さ、結末の偏り、そもそも到達
   しない結末。それを毎回手で確かめるのは無理なので、ここでまとめて測る。

   使い方:
     node tools/playtest.js                 収録シナリオ全部を一覧で
     node tools/playtest.js rain-check      1本を詳しく
     node tools/playtest.js --runs=200      試行回数を変える
     node tools/playtest.js --strict        問題があれば終了コード1（CI用）

   2種類のボットで挟んで測る。ランダムだけだと悲観側に偏り、賢いボットだけ
   だと楽観側に偏るため、両方の数字を並べて「幅」として読む。
     無作為 … 選べるものから一様に選ぶ。行き当たりばったりの初回プレイ
     熟考   … 未見の場面を優先し、得意な技能の判定を選ぶ。二周目のプレイヤー */

import { useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';
import { Session } from '../js/core/engine.js';
import { pregeneratedParty } from '../js/core/character.js';
import { APPROACHES } from '../js/core/netrun.js';
import { Rng } from '../js/core/rng.js';
import { BUILT_IN, byId } from '../js/scenarios/index.js';
import { validate } from '../js/core/scenario.js';
import { MONSTERS } from '../js/core/content.js';
import { pathToFileURL } from 'node:url';

/* ------------------------------------------------------------------ ボット */

const BOTS = {
  random: {
    name: '無作為',
    choose: (choices, _session, rng) => rng.pick(choices),
  },
  thoughtful: {
    name: '熟考',
    choose: (choices, session, rng) => {
      /* まだ見ていない場面へ進む手を優先する。判定つきの選択肢は行き先が
         check.success/fail の下にあるので、そこも見ないと「行き先なし」と
         誤判定して判定を一切選ばなくなる。 */
      const destinations = choice => [
        choice?.to, choice?.check?.success?.to, choice?.check?.fail?.to,
      ].filter(Boolean);
      const fresh = choices.filter(c => {
        const raw = session.node?.choices?.[c.index];
        const targets = destinations(raw);
        return targets.length && targets.some(t => !session.visited.has(t));
      });
      const pool = fresh.length ? fresh : choices;

      // 判定つきなら、一番得意な仲間の修正値が高いものを選ぶ。
      const scored = pool.map(c => ({
        c, score: c.check ? (c.check.candidates[0]?.mod ?? 0) : 0,
      }));
      const best = Math.max(...scored.map(s => s.score));
      const top = scored.filter(s => s.score === best).map(s => s.c);
      return rng.pick(top);
    },
  },
};

/* -------------------------------------------------------------- 1回のプレイ */

function playOnce(scenario, { seed, bot, level = 1 }) {
  useWorld(scenario.world || DEFAULT_WORLD);
  const rng = new Rng(seed * 7919 + 13);
  const party = pregeneratedParty();
  const session = new Session({ scenario, party, seed });
  session.start();

  const stat = {
    turns: 0,
    combats: 0,
    combatRounds: 0,
    netruns: 0,
    checks: 0,
    checksPassed: 0,
    bySkill: {},
    lockedSeen: new Set(),
    ending: null,
    endingType: null,
    deadend: false,
    looped: false,
    stallNode: null,
    deaths: 0,
    wiped: false,
  };

  let logCursor = 0;
  let combatRound = 0;
  let inCombat = false;

  const drainLog = () => {
    for (const entry of session.log.slice(logCursor)) {
      if (entry.roll?.skill) {
        stat.checks++;
        const s = stat.bySkill[entry.roll.skill] || (stat.bySkill[entry.roll.skill] = { n: 0, ok: 0, dc: 0 });
        s.n++; s.dc += entry.roll.dc;
        if (entry.roll.success) { stat.checksPassed++; s.ok++; }
      }
    }
    logCursor = session.log.length;
  };

  let guard = 0;
  while (!session.finished && guard++ < 1200) {
    drainLog();

    if (session.combat) {
      if (!inCombat) { inCombat = true; stat.combats++; combatRound = 0; }
      combatRound = Math.max(combatRound, session.combat.round);
      const view = session.view();
      const options = view.combat.options;
      // 誰かが瀕死なら回復を優先する。それ以外は殴る。
      const hurt = view.combat.allies.find(a => a.hp / a.maxHp < 0.35);
      const heal = hurt && options.find(o => o.kind === 'item' && o.item?.use === 'heal');
      let action;
      if (bot === 'random') {
        // 逃げる手も選ばないと、逃走で分岐する結末が永久に測れない。
        const flee = options.find(o => o.kind === 'flee');
        action = (flee && rng.float() < 0.25) ? flee
          : (heal && rng.float() < 0.6) ? heal
            : rng.pick(options.filter(o => !o.disabled && o.kind !== 'flee')) || options[0];
      } else {
        action = heal || options.find(o => o.kind === 'attack') || options[0];
      }
      if (!action) break;
      const target = action.target === 'ally' ? hurt?.uid : view.combat.targets[0]?.uid;
      session.act({ ...action, targetUid: target });
      continue;
    }
    if (inCombat) { inCombat = false; stat.combatRounds += combatRound; }

    if (session.netrun) {
      if (session.netrun.trace === 0) stat.netruns++;
      const run = session.netrun;
      // 痕跡に余裕があるうちは静かに、詰まってきたら焼き切る。
      const id = bot === 'random'
        ? rng.pick(APPROACHES).id
        : (run.trace >= run.traceMax - 2 ? 'burn' : 'careful');
      session.hack({ id });
      continue;
    }

    const view = session.view();
    for (const c of view.choices) if (c.locked) stat.lockedSeen.add(`${session.nodeId}:${c.index}`);
    const open = view.choices.filter(c => !c.locked);
    if (!open.length) { stat.deadend = true; stat.stallNode = session.nodeId; break; }

    session.choose(BOTS[bot].choose(open, session, rng).index);
    stat.turns++;
  }

  drainLog();
  if (inCombat) stat.combatRounds += combatRound;

  stat.ending = session.ending?.title || null;
  stat.endingType = session.ending?.type || null;
  stat.deaths = session.party.filter(p => p.dead).length;
  stat.wiped = session.party.every(p => p.dead || p.hp <= 0);
  stat.visited = new Set(session.visited);
  // 選択肢が尽きて進めないのは詰み（バグ）。選択肢はあるのに上限まで
  // 往復し続けたのは、出口の条件が開かないまま巡回できてしまう構造。
  if (!session.finished && !stat.deadend) {
    stat.looped = true;
    stat.stallNode = session.nodeId;
  }
  return stat;
}

/* ------------------------------------------------------------- 集計 */

export function playtest(scenario, { runs = 80, level = 1 } = {}) {
  const nodes = Object.keys(scenario.nodes);
  const declaredEndings = Object.values(scenario.nodes)
    .filter(n => n.ending).map(n => n.ending.title);

  const report = { id: scenario.id, title: scenario.title, world: scenario.world, runs, bots: {}, problems: [] };

  const visitedEver = new Set();
  const endingsEver = new Set();

  for (const [botId, bot] of Object.entries(BOTS)) {
    const turns = [], deaths = [], rounds = [], coverage = [];
    const endings = {};
    let stalls = 0, loops = 0, checks = 0, passed = 0, combats = 0, netruns = 0;
    const stallNodes = {}, loopNodes = {};
    const bySkill = {};

    for (let seed = 0; seed < runs; seed++) {
      const s = playOnce(scenario, { seed, bot: botId, level });
      turns.push(s.turns);
      deaths.push(s.deaths);
      if (s.combats) rounds.push(s.combatRounds / s.combats);
      const key = s.ending || '(結末に届かず)';
      endings[key] = (endings[key] || 0) + 1;
      if (s.ending) endingsEver.add(s.ending);
      if (s.deadend) { stalls++; if (s.stallNode) stallNodes[s.stallNode] = (stallNodes[s.stallNode] || 0) + 1; }
      if (s.looped) { loops++; if (s.stallNode) loopNodes[s.stallNode] = (loopNodes[s.stallNode] || 0) + 1; }
      checks += s.checks; passed += s.checksPassed;
      combats += s.combats; netruns += s.netruns;
      for (const [id, v] of Object.entries(s.bySkill)) {
        const t = bySkill[id] || (bySkill[id] = { n: 0, ok: 0, dc: 0 });
        t.n += v.n; t.ok += v.ok; t.dc += v.dc;
      }
      coverage.push(s.visited.size / nodes.length);
      for (const n of s.visited) visitedEver.add(n);
    }

    const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    report.bots[botId] = {
      name: bot.name,
      turns: { mean: mean(turns), min: Math.min(...turns), max: Math.max(...turns) },
      deaths: mean(deaths),
      combatRounds: mean(rounds),
      combatsPerRun: combats / runs,
      netrunsPerRun: netruns / runs,
      checkRate: checks ? passed / checks : 0,
      checkCount: checks,
      coverage: mean(coverage),
      stallRate: stalls / runs,
      stallNodes,
      loopRate: loops / runs,
      loopNodes,
      endings: Object.fromEntries(
        Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / runs])),
      bySkill,
    };
  }

  /* ------------------------------------------------------- 問題の検出 */

  const unreachedEndings = declaredEndings.filter(t => !endingsEver.has(t));
  if (unreachedEndings.length) {
    report.problems.push({
      level: 'error',
      text: `書いたのに一度も到達しない結末: ${unreachedEndings.join('、')}`,
    });
  }

  const unvisited = nodes.filter(id => !visitedEver.has(id));
  if (unvisited.length) {
    report.problems.push({
      level: 'error',
      text: `一度も訪れない場面: ${unvisited.join('、')}`,
    });
  }

  for (const [botId, b] of Object.entries(report.bots)) {
    const top3 = m => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 3)
      .map(([n, c]) => `${n}×${c}`).join('、');
    if (b.stallRate > 0) {
      report.problems.push({
        level: 'error',
        text: `${b.name}: ${pct(b.stallRate)} で選択肢が尽きて詰む（${top3(b.stallNodes)}）`,
      });
    }
    if (b.loopRate > 0.05) {
      report.problems.push({
        level: 'warn',
        text: `${b.name}: ${pct(b.loopRate)} で出口が開かないまま巡回し続ける（${top3(b.loopNodes)}）`
          + ' — 条件を満たせなくても進める道が要る',
      });
    }
    // 一つの結末に偏りすぎ＝実質分岐がない。
    const top = Object.entries(b.endings)[0];
    if (top && top[1] >= 0.9 && declaredEndings.length > 1) {
      report.problems.push({
        level: 'warn',
        text: `${b.name}: 結末「${top[0]}」が ${Math.round(top[1] * 100)}% — 分岐が機能していない`,
      });
    }
    if (b.checkCount >= 20 && (b.checkRate < 0.35 || b.checkRate > 0.85)) {
      report.problems.push({
        level: 'warn',
        text: `${b.name}: 判定の成功率 ${Math.round(b.checkRate * 100)}% — DC が${b.checkRate < 0.5 ? '高' : '低'}すぎる`,
      });
    }
  }

  /* 1回のプレイで、書いた場面のどれだけが実際に読まれるか。
     所要時間はボットの癖に左右されすぎて当てにならないので、
     「書いた分が届いているか」を到達率で見る。 */
  const cover = Math.max(report.bots.random.coverage, report.bots.thoughtful.coverage);
  report.coverage = cover;
  if (nodes.length >= 12 && cover < 0.45) {
    report.problems.push({
      level: 'warn',
      text: `1回のプレイで読まれるのは全${nodes.length}場面の ${pct(cover)} だけ — 書いた分が届いていない`,
    });
  }

  const check = validate(scenario, { monsters: MONSTERS });
  for (const e of check.errors) report.problems.push({ level: 'error', text: `構造: ${e}` });

  return report;
}

/* ------------------------------------------------------------ 表示 */

const pct = v => `${Math.round(v * 100)}%`;
const bar = (v, width = 18) => '█'.repeat(Math.round(v * width)).padEnd(width, '·');

function printOne(r, { detail = true } = {}) {
  console.log(`\n■ ${r.title}  〔${r.world}〕  ${r.runs}回×2ボット`);

  for (const b of Object.values(r.bots)) {
    console.log(`  ${b.name.padEnd(4)} ${b.turns.mean.toFixed(0).padStart(3)}手（${b.turns.min}〜${b.turns.max}）`
      + ` ｜場面到達 ${pct(b.coverage).padStart(4)}`
      + ` ｜判定成功 ${b.checkCount ? pct(b.checkRate).padStart(4) : '  --'}`
      + ` ｜戦闘 ${b.combatsPerRun.toFixed(1)}回/${b.combatRounds.toFixed(1)}R`
      + ` ｜死者 ${b.deaths.toFixed(2)}人`);
  }

  if (detail) {
    console.log('\n  結末の分布');
    const all = new Set([...Object.keys(r.bots.random.endings), ...Object.keys(r.bots.thoughtful.endings)]);
    for (const title of all) {
      const a = r.bots.random.endings[title] || 0;
      const b = r.bots.thoughtful.endings[title] || 0;
      console.log(`    ${title.padEnd(14, '　')} 無作為 ${bar(a, 12)} ${pct(a).padStart(4)}   熟考 ${bar(b, 12)} ${pct(b).padStart(4)}`);
    }

    const skills = Object.entries(r.bots.thoughtful.bySkill).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    if (skills.length) {
      console.log('\n  よく振られる技能（熟考ボット）');
      for (const [id, s] of skills) {
        console.log(`    ${id.padEnd(14)} ${String(s.n).padStart(4)}回  成功 ${pct(s.ok / s.n).padStart(4)}  平均DC ${(s.dc / s.n).toFixed(1)}`);
      }
    }
  }

  if (r.problems.length) {
    console.log('');
    for (const p of r.problems) {
      console.log(`  ${p.level === 'error' ? '✗' : '⚠'} ${p.text}`);
    }
  } else {
    console.log('\n  ✓ 問題は見つかりません');
  }
}

/* -------------------------------------------------------------- 実行 */

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();

function main() {
const args = process.argv.slice(2);
const runsArg = args.find(a => a.startsWith('--runs='));
const runs = runsArg ? Number(runsArg.split('=')[1]) : 80;
const strict = args.includes('--strict');
const target = args.find(a => !a.startsWith('--'));

const scenarios = target
  ? [byId(target)].filter(Boolean)
  : BUILT_IN;

if (target && !scenarios.length) {
  console.error(`シナリオ "${target}" が見つかりません。収録: ${BUILT_IN.map(s => s.id).join(', ')}`);
  process.exit(1);
}

console.log(`プレイテスト — ${scenarios.length}本 × ${runs}回 × 2ボット`);
if (runs < 50) {
  console.log('  ※ 試行が少ないと稀な結末を拾えず「到達しない」と誤検知します（--runs=80 以上を推奨）');
}

let errors = 0;
for (const scenario of scenarios) {
  const report = playtest(scenario, { runs });
  printOne(report, { detail: !!target || scenarios.length <= 2 });
  errors += report.problems.filter(p => p.level === 'error').length;
}

console.log(`\n${errors ? `✗ ${errors} 件の要修正` : '✓ 要修正なし'}`);
if (strict && errors) process.exit(1);
}
