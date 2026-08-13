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
