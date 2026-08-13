/* Generates the PWA / iOS icons into icons/.
   Drawn in Chromium so the output matches the in-app palette exactly.
   Usage: node tools/icons.js */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = new URL('../icons/', import.meta.url).pathname;

/** Sizes we ship. `padded` leaves room for Android's maskable safe zone. */
const TARGETS = [
  { file: 'icon-192.png', size: 192, radius: 0.22 },
  { file: 'icon-512.png', size: 512, radius: 0.22 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0, padded: true },
  { file: 'apple-touch-icon.png', size: 180, radius: 0 },   // iOS applies its own mask
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();

  const images = await page.evaluate(targets => targets.map(t => {
    const c = document.createElement('canvas');
    c.width = c.height = t.size;
    const ctx = c.getContext('2d');
    const s = t.size;

    // Background — the app's night palette, warmed towards the middle.
    const bg = ctx.createRadialGradient(s * 0.5, s * 0.35, 0, s * 0.5, s * 0.5, s * 0.75);
    bg.addColorStop(0, '#2a2334');
    bg.addColorStop(1, '#141019');
    ctx.fillStyle = bg;
    if (t.radius) {
      ctx.beginPath();
      ctx.roundRect(0, 0, s, s, s * t.radius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, s, s);
    }

    // A d20 seen face-on: hexagonal silhouette with the top face picked out.
    const r = s * (t.padded ? 0.28 : 0.34);
    const cx = s / 2;
    const cy = s / 2;
    const corner = i => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    };

    const gold = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gold.addColorStop(0, '#e8bd72');
    gold.addColorStop(1, '#a87c33');

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x, y] = corner(i);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();

    // The upward-facing triangle, darker so the die reads as three-dimensional.
    const inner = r * 0.56;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = (2 * Math.PI / 3) * i - Math.PI / 2;
      const x = cx + inner * Math.cos(angle);
      const y = cy + inner * Math.sin(angle);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#1c1723';
    ctx.fill();

    // "20" on the face you always hope for.
    ctx.fillStyle = '#e8bd72';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${inner * 0.78}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
    ctx.fillText('20', cx, cy + inner * 0.02);

    return { file: t.file, data: c.toDataURL('image/png') };
  }), TARGETS);

  for (const { file, data } of images) {
    await writeFile(OUT + file, Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote icons/' + file);
  }
} finally {
  await browser.close();
}
