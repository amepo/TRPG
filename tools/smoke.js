/* End-to-end smoke test: drives a real browser through the
   tutorial scenario, the session tool and the scenario editor, and fails on
   any console error along the way.
   Usage: node tools/smoke-trpg.js [--headed] */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
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
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

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
