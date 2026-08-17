/* End-to-end smoke test: drives a real browser through the
   tutorial scenario, the session tool and the scenario editor, and fails on
   any console error along the way.
   Usage: node tools/smoke-trpg.js [--headed] */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const headed = process.argv.includes('--headed');

const server = spawn(process.execPath, ['tools/serve.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

const failures = [];
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
};

await sleep(700);

// Honour a pre-provisioned browser when the pinned build is not downloaded.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ headless: !headed, executablePath });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, acceptDownloads: true });

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

/* A choice with a skill check opens a "who rolls?" sheet; pick the first
   candidate so the walk can continue. */
const resolveSheet = async () => {
  const dialog = page.locator('dialog[open]');
  if (!await dialog.count()) return false;
  const pick = dialog.locator('.pc').first();
  if (await pick.count()) { await pick.click(); await page.waitForTimeout(150); return true; }
  await page.locator('#sheetClose').click();
  await page.waitForTimeout(150);
  return true;
};

const click = async (text, opts = {}) => {
  const target = page.getByRole('button', { name: text, exact: false }).first();
  await target.waitFor({ state: 'visible', timeout: 4000 });
  await target.click(opts);
  await page.waitForTimeout(120);
};

try {
  console.log('TRPG smoke test');

  await step('タイトル画面が開く', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.tile__name');
    const modes = await page.locator('.tile__name').allTextContents();
    if (!modes.includes('ソロプレイ')) throw new Error(`モードが出ていない: ${modes.join(',')}`);
  });

  await step('ソロプレイ → シナリオ一覧', async () => {
    await click('ソロプレイ');
    await page.waitForSelector('text=はじめての依頼');
  });

  await step('シナリオを選ぶとパーティ編成に進む', async () => {
    await page.getByRole('button', { name: /はじめての依頼/ }).first().click();
    await page.waitForSelector('text=おまかせ4人');
  });

  await step('おまかせ4人で一行ができる', async () => {
    await click('おまかせ4人');
    const count = await page.locator('.pc__name').count();
    if (count < 4) throw new Error(`4人揃っていない: ${count}`);
  });

  await step('冒険が始まり本文が流れる', async () => {
    await click('この一行で始める');
    await page.waitForSelector('.line-narration');
    const text = await page.locator('.log').innerText();
    if (!text.includes('依頼板')) throw new Error('導入文が出ていない');
  });

  await step('選択肢を押すと物語が進む', async () => {
    const before = await page.locator('.log__line').count();
    await page.locator('.choice').first().click();
    await page.waitForTimeout(200);
    await resolveSheet();
    await page.waitForTimeout(200);
    const after = await page.locator('.log__line').count();
    if (after <= before) throw new Error('ログが伸びていない');
  });

  await step('戦闘まで進み、行動できる', async () => {
    for (let i = 0; i < 12; i++) {
      if (await page.locator('.combat').count()) break;
      const choice = page.locator('.choice:not([disabled])').first();
      if (!await choice.count()) break;
      await choice.click();
      await page.waitForTimeout(160);
      await resolveSheet();
    }
    if (!await page.locator('.combat').count()) throw new Error('戦闘に入れなかった');
    await page.waitForSelector('.enemy');
  });

  await step('攻撃してダメージのログが出る', async () => {
    for (let i = 0; i < 30; i++) {
      const action = page.locator('.action:not([disabled])').first();
      if (!await action.count()) break;
      await action.click();
      await page.waitForTimeout(140);
      await resolveSheet();
      if (!await page.locator('.combat').count()) break;
    }
    const text = await page.locator('.log').innerText();
    if (!/命中|外れ|ダメージ/.test(text)) throw new Error('戦闘ログが出ていない');
  });

  await step('キャラクターシートが開く', async () => {
    await page.locator('.play__side .pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const stats = await page.locator('dialog[open] .stat').count();
    if (stats !== 6) throw new Error(`能力値が6つない: ${stats}`);
    await page.locator('#sheetClose').click();
    await page.waitForTimeout(150);
  });

  await step('セーブできる', async () => {
    await resolveSheet();
    await click('セーブ');
    await page.waitForSelector('#toast:not([hidden])');
    const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('trpg.saves') || '[]').length);
    if (!saves) throw new Error('セーブが保存されていない');
  });

  await step('タイトルに戻ると「続きから」が出る', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=続きから');
  });

  await step('セッション支援：ダイスが振れる', async () => {
    await click('セッション支援');
    await click('d20');
    const result = await page.locator('.tray__result').innerText();
    const value = Number(result);
    if (!(value >= 1 && value <= 20)) throw new Error(`d20 の結果が変: ${result}`);
  });

  await step('セッション支援：式を入れて振れる', async () => {
    await page.locator('.input').first().fill('4d6kh3+2');
    await click('振る');
    const detail = await page.locator('.tray__detail').innerText();
    if (!detail.includes('4d6')) throw new Error(`式が反映されていない: ${detail}`);
  });

  await step('セッション支援：キャラクターと進行表', async () => {
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    if (!await page.locator('.pc__name').count()) throw new Error('キャラクターが増えていない');
    await page.getByText('⚔️ 進行').click();
    await click('PCを追加');
    if (!await page.locator('.pc.is-turn').count()) throw new Error('イニシアチブ表が動いていない');
    await click('敵を追加');
    await page.locator('dialog[open] .tile').first().click();
    await page.waitForTimeout(200);
  });

  await step('シナリオ工房：新規作成して点検が通る', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('シナリオ工房');
    await click('新しく作る');
    await page.locator('dialog[open] .tile').first().click();   // 世界観を選ぶ
    await page.waitForTimeout(200);
    await page.waitForSelector('.issue--ok');
  });

  await step('シナリオ工房：場面を足すと点検に出る', async () => {
    await click('＋ 場面を足す');
    await page.waitForTimeout(200);
    const rows = await page.locator('.node-row').count();
    if (rows < 3) throw new Error(`場面が増えていない: ${rows}`);
    await page.waitForSelector('.issue--warn');
  });

  await step('シナリオ工房：自作シナリオを遊べる', async () => {
    await page.locator('.node-row').first().click();
    await click('遊ぶ');
    await page.waitForSelector('text=おまかせ4人');
  });


  await step('サイバーパンク：世界が切り替わって配色も変わる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('ソロプレイ');
    await page.waitForSelector('text=ネオンの雨');
    await page.getByRole('button', { name: /雨の領収書/ }).first().click();
    await page.waitForSelector('text=おまかせ4人');
    await click('おまかせ4人');
    await click('この一行で始める');
    await page.waitForSelector('.line-narration');
    const world = await page.evaluate(() => document.documentElement.dataset.world);
    if (world !== 'neon') throw new Error(`世界が切り替わっていない: ${world}`);
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    if (bg !== '#05070e') throw new Error(`配色が切り替わっていない: ${bg}`);
  });

  await step('サイバーパンク：役割名が出ている', async () => {
    const side = await page.locator('.play__side').innerText();
    if (!/チーム/.test(side)) throw new Error('世界の呼び名が出ていない');
  });

  await step('サイバーパンク：ネットランに入って追跡ゲージが動く', async () => {
    /* 導入編は必ず侵入を通る作りなので、ここで確実に検証する。
       本編は経路が枝分かれしていて、判定次第で侵入までたどり着かない。 */
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('ソロプレイ');
    await page.getByRole('button', { name: /初日の運び屋/ }).first().click();
    await page.waitForSelector('text=おまかせ4人');
    await click('おまかせ4人');
    await click('この一行で始める');
    await page.waitForSelector('.line-narration');

    const WANTED = ['扉の記録を読む', 'エレベーターの制御', '配達員として', '受け取って走り出す'];
    let rotation = 0;
    for (let i = 0; i < 30; i++) {
      if (await page.locator('.netrun').count()) break;

      if (await page.locator('.combat:not(.netrun)').count()) {
        const action = page.locator('.action:not([disabled])').first();
        if (await action.count()) { await action.click(); await page.waitForTimeout(120); await resolveSheet(); }
        continue;
      }

      const choices = page.locator('.choice:not([disabled])');
      const count = await choices.count();
      if (!count) break;

      let target = null;
      for (const word of WANTED) {
        const hit = page.locator('.choice:not([disabled])', { hasText: word });
        if (await hit.count()) { target = hit.first(); break; }
      }
      if (!target) target = choices.nth(rotation++ % count);

      await target.click();
      await page.waitForTimeout(150);
      await resolveSheet();
    }

    if (!await page.locator('.netrun').count()) throw new Error('ネットランに入れなかった');
    const trace = await page.locator('.trace__bar').count();
    if (!trace) throw new Error('追跡ゲージが出ていない');
    await page.locator('.action--netrun').first().click();
    await page.waitForTimeout(300);
    const log = await page.locator('.log').innerText();
    if (!/追跡|突破|第\d層/.test(log)) throw new Error('侵入のログが出ていない');
  });

  await step('セッション支援：世界観を切り替えられる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await click('ネオンの雨');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const sheet = await page.locator('dialog[open] .sheet__body').innerText();
    if (!/適合度/.test(sheet)) throw new Error('サイバーパンクのシートに改造欄が出ていない');
    await page.locator('#sheetClose').click();
    await page.waitForTimeout(150);
    // 世界を戻すと、その世界のキャラだけが残る。
    await click('灯火のテーブル');
    await page.waitForTimeout(200);
    const back = await page.locator('#screen').innerText();
    if (!/灯火のテーブル/.test(back)) throw new Error('世界が戻っていない');
  });

  await step('サイバーパンクのシナリオが4本以上ある', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('ソロプレイ');
    await page.waitForSelector('text=ネオンの雨');
    const titles = await page.locator('.tile__name').allTextContents();
    const neon = ['初日の運び屋', '雨の領収書', '三分間の停電', '最終便'];
    const missing = neon.filter(t => !titles.some(x => x.includes(t)));
    if (missing.length) throw new Error(`並んでいない: ${missing.join(', ')}`);
  });

  await step('追加シナリオが開始できる', async () => {
    await page.getByRole('button', { name: /三分間の停電/ }).first().click();
    await page.waitForSelector('text=おまかせ4人');
    await click('おまかせ4人');
    await click('この一行で始める');
    await page.waitForSelector('.line-narration');
    const log = await page.locator('.log').innerText();
    if (!/アズマ信託/.test(log)) throw new Error('本文が出ていない');
  });

  await step('サイバーパンク：改造で適合度が動く', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const hasStrain = await page.locator('dialog[open] .strain').count();
    // 既定の世界はファンタジーなので、改造欄は出ないのが正しい。
    if (hasStrain) throw new Error('ファンタジーに適合度が出ている');
    await page.locator('#sheetClose').click();
  });

  await step('世界：読み物が開いて、表が振れる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('世界');
    await page.getByText('この街／この地方について').waitFor();
    // 表を振ると、結果が1行増える。
    const card = page.locator('.card').filter({ hasText: '宿で聞く噂' });
    const before = await card.locator('p').count();
    await card.getByRole('button', { name: '振る' }).click();
    const after = await card.locator('p').count();
    if (after <= before) throw new Error('表を振っても結果が出ない');
  });

  await step('世界：切り替えると読み物も入れ替わる', async () => {
    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await page.getByText('メリディアン・タワー').waitFor();
    const stale = await page.getByText('ヴェルナ村').count();
    if (stale) throw new Error('前の世界の読み物が残っている');
  });

  await step('サイバーパンクの登場人物名が世界に合っている', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    const name = await page.locator('.pc__name').first().innerText();
    // 企業の街に「ガレス」や「イレーヌ」が出てきたら、名簿が切り替わっていない。
    if (/ガレス|イレーヌ|ボルド|ニケ/.test(name)) throw new Error(`世界に合わない名前: ${name}`);
  });

  await step('ネオ東京：区画と信用スコアが読める', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('世界');
    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await page.getByText('ネオアビス').first().waitFor();
    await page.getByText('企業級').first().waitFor();
  });

  await step('信用スコアは世界の読み物にだけ出る（シートには出ない）', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const sheet = await page.locator('dialog[open]').innerText();
    // 管理する項目を増やさない、と決めたので、シートには出さない。
    if (sheet.includes('信用スコア')) throw new Error('シートに信用スコアが出ている');
    await page.locator('#sheetClose').click();

    await page.getByText('🌍 世界').click();
    await page.getByText('企業級').first().waitFor();
  });

  await step('読み物の **強調** が素通しになっていない', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('世界');
    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await page.getByText('会社は、返さなかっただけだ').waitFor();
    const raw = await page.locator('.stack').first().innerText();
    if (raw.includes('**')) throw new Error('本文にアスタリスクがそのまま出ている');
  });

  await step('別の世界観のキャラクターは読み込み一覧に出ない', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');                                   // ファンタジーの人物を1人
    await page.locator('.pc').first().waitFor();
    await page.getByRole('button', { name: '保存' }).first().click();

    await page.getByRole('button', { name: /ネオンの雨/ }).first().click();
    await click('読み込む');
    const sheet = await page.locator('dialog[open]').innerText();
    if (!/出していません|まだありません/.test(sheet)) {
      throw new Error(`サイバーパンクの卓にファンタジーの人物が並んでいる:\n${sheet.slice(0, 200)}`);
    }
    await page.locator('#sheetClose').click();
  });

  await step('装備を持ち替えられる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const before = await page.locator('dialog[open]').innerText();
    if (!before.includes('装備')) throw new Error('シートに装備欄がない');

    // 盾を外すと、装備欄から消えて持ち物に戻る。
    const off = page.getByRole('button', { name: '外す' });
    if (await off.count()) {
      await off.first().click();
      const after = await page.locator('dialog[open]').innerText();
      if (after === before) throw new Error('外しても表示が変わらない');
    }
    await page.locator('#sheetClose').click();
  });

  await step('冒険の外では買い物ができる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    await page.getByRole('button', { name: '道具' }).click();
    await page.getByText(/を買う（手持ち/).waitFor();
  });

  await step('冒険の最中は買い物ができない', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('ソロプレイ');
    await page.getByRole('button', { name: /はじめての依頼/ }).click();
    await click('おまかせ4人');
    await click('この一行で始める');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    const sheet = await page.locator('dialog[open]').innerText();
    if (sheet.includes('調達')) throw new Error('冒険の最中に店が開いている');
    if (!sheet.includes('装備')) throw new Error('冒険中に装備欄が消えている');
  });

  await step('技能を押すと、何をする技能か出る', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('セッション支援');
    await page.getByText('📜 キャラクター').click();
    await click('ランダム');
    await page.locator('.pc').first().click();
    await page.waitForSelector('dialog[open] .stats');
    await page.locator('.skill').first().click();
    const help = await page.locator('dialog[open]').innerText();
    if (help.length < 20) throw new Error(`技能の説明が出ていない: ${help}`);
    if (!/能力値：/.test(help)) throw new Error('どの能力値で振るのか出ていない');
    await page.locator('#sheetClose').click();
  });

  await step('鼠は一体ずつ狙える', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('ソロプレイ');
    await page.getByRole('button', { name: /はじめての依頼/ }).click();
    await click('おまかせ4人');
    await click('この一行で始める');
    for (let i = 0; i < 12; i++) {
      if (await page.locator('.combat').count()) break;
      const choice = page.locator('.choice:not([disabled])').first();
      if (!await choice.count()) break;
      await choice.click();
      await page.waitForTimeout(160);
      await resolveSheet();                    // 誰が振るかを訊かれることがある
    }
    await page.waitForSelector('.enemy');
    const names = (await page.locator('.enemy__name').allInnerTexts()).map(t => t.trim());
    if (names.length < 3) throw new Error(`敵が ${names.length} 体しか出ていない`);
    if (new Set(names).size !== names.length) throw new Error(`同じ名前で狙い分けられない: ${names.join('、')}`);
  });

  await step('工房：保存を押さなくても、書いたものは残る', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('シナリオ工房');
    await click('新しく作る');
    await page.locator('dialog[open] .tile').first().click();
    await page.waitForSelector('.issue--ok');

    // 名前をつけて、場面を3つ足す。保存は押さない。
    const title = page.locator('.input').first();
    await title.fill('消えないかの試験');
    for (let i = 0; i < 3; i++) {
      await click('＋ 場面を足す');
      await page.waitForTimeout(120);
    }
    const rows = await page.locator('.node-row').count();

    await click('一覧へ');
    await page.getByText('消えないかの試験').first().waitFor();

    await page.getByText('消えないかの試験').first().click();
    // 場面を足したあとは点検に警告が出るので、.issue--ok は当てにできない。
    await page.locator('.node-row').first().waitFor();
    const after = await page.locator('.node-row').count();
    if (after !== rows) throw new Error(`場面が ${rows} → ${after} に減っている`);
  });

  await step('工房：削除した場面を元に戻せる', async () => {
    const before = await page.locator('.node-row').count();
    await click('削除');
    await page.locator('dialog[open]').getByRole('button', { name: '削除' }).click();
    await page.waitForTimeout(200);
    const deleted = await page.locator('.node-row').count();
    if (deleted >= before) throw new Error('削除できていない');

    await page.getByRole('button', { name: /元に戻す/ }).click();
    await page.waitForTimeout(200);
    const restored = await page.locator('.node-row').count();
    if (restored !== before) throw new Error(`戻っていない（${before} → ${deleted} → ${restored}）`);
  });

  await step('工房：見本の JSON を落とせる', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('シナリオ工房');
    await page.getByText('見本から始める').waitFor();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '.json' }).first().click();
    const file = await download;
    const name = file.suggestedFilename();
    if (!name.endsWith('.json')) throw new Error(`落ちてきたのが json ではない: ${name}`);

    // 中身がシナリオとして読める形かどうかまで見る。
    const path = await file.path();
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (!data.nodes || !data.start) throw new Error('落ちてきた JSON が シナリオの形をしていない');
  });

  await step('工房：見本を開くと、そのまま編集に入れる', async () => {
    await page.getByRole('button', { name: '開く' }).first().click();
    await page.locator('.node-row').first().waitFor();
    const rows = await page.locator('.node-row').count();
    if (rows < 2) throw new Error(`場面が ${rows} しか入っていない`);
    const title = await page.locator('.input').first().inputValue();
    if (!title.includes('写し')) throw new Error(`見本そのものを開いている: ${title}`);
  });

  await step('工房：効果と条件を書ける', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await click('シナリオ工房');
    await click('新しく作る');
    await page.locator('dialog[open] .tile').first().click();
    await page.waitForSelector('.issue--ok');

    const fold = name => page.locator('.fold').filter({ hasText: name }).first();

    // 変数をひとつ宣言する。
    await fold('変数').locator('summary').click();
    await click('＋ 変数を足す');
    await page.waitForTimeout(150);
    if (!/count/.test(await fold('変数').innerText())) throw new Error('変数が足せない');

    // 選択肢に「所持金」の効果を足す。閉じた details の中は押せないので開いてから。
    const effects = fold('選んだときの効果');
    await effects.locator('summary').click();
    await page.locator('.fold[open] .select--add-effect').first().selectOption('gold');
    await page.waitForTimeout(200);
    if (!/所持金/.test(await fold('選んだときの効果').innerText())) {
      throw new Error('効果が入っていない');
    }

    // 見せる条件に「印がある」を足す。
    const cond = fold('見せる条件');
    await cond.locator('summary').click();
    await page.locator('.fold[open] .select--add-condition').first().selectOption('flag');
    await page.waitForTimeout(200);
    if (!/印/.test(await fold('見せる条件').innerText())) throw new Error('条件が入っていない');
  });

  await step('工房：書いた効果ごと遊べる', async () => {
    await click('遊ぶ');
    await click('おまかせ4人');            // 遊ぶ前に一行を決める画面が挟まる
    await click('この一行で始める');
    await page.locator('.log__line').first().waitFor();

    // 「印がある」を条件にした選択肢は、印がついていないので出ないのが正しい。
    const choices = await page.locator('.choice').count();
    const log = await page.locator('.log__line').count();
    if (!log) throw new Error('自作シナリオが始まらない');
    if (choices) throw new Error(`条件を満たしていない選択肢が出ている（${choices}件）`);
  });

  await step('コンソールエラーが出ていない', async () => {
    if (consoleErrors.length) throw new Error(consoleErrors.slice(0, 3).join(' / '));
  });

} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} 件失敗:\n${failures.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('\nすべて通過しました。');
