// Prüft, ob eine Seite auf einem schmalen Telefon waagerecht scrollt.
// 320px ist das schmalste Gerät, das noch verbreitet ist.
//
//   npm run build
//   node skripte/breite-pruefen.mjs

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJEKT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WURZEL = join(PROJEKT, 'dist');
const BREITE = 320;

const typen = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  let datei = join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
  try { if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html'); } catch {}
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': typen[extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(4405, r));

function seiten(dir, basis = '') {
  const raus = [];
  for (const e of readdirSync(dir)) {
    const voll = join(dir, e);
    if (statSync(voll).isDirectory()) raus.push(...seiten(voll, `${basis}/${e}`));
    else if (e === 'index.html') raus.push(`${basis}/`);
  }
  return raus;
}

const browser = await chromium.launch();
let schlecht = 0;

for (const pfad of seiten(WURZEL).sort()) {
  const seite = await browser.newPage({ viewport: { width: BREITE, height: 800 } });
  await seite.goto(`http://127.0.0.1:4405${pfad}`, { waitUntil: 'load' });
  await seite.waitForTimeout(150);
  const ueber = await seite.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (ueber > 0) {
    schlecht++;
    // Welches Element ragt heraus? Bereiche mit eigenem Scrollbalken zählen nicht.
    const schuld = await seite.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const raus = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.getBoundingClientRect().right <= cw + 0.5) continue;
        let p = el.parentElement, gekapselt = false;
        while (p) {
          if (getComputedStyle(p).overflowX !== 'visible') { gekapselt = true; break; }
          p = p.parentElement;
        }
        if (!gekapselt) raus.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`);
      }
      return raus.slice(-3);
    });
    console.log(`ÜBERBREITE ${ueber}px  ${pfad}  ${schuld.join(', ')}`);
  }
  await seite.close();
}

await browser.close();
server.close();
console.log(schlecht === 0
  ? `Alle Seiten passen auf ${BREITE}px Breite.`
  : `${schlecht} Seiten mit Überbreite.`);
process.exit(schlecht ? 1 : 0);
