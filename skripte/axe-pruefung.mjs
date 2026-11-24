// Prüft alle gebauten Seiten mit axe-core auf WCAG-Verstösse.
//
//   npm run build
//   node skripte/axe-pruefung.mjs
//
// Einmalig vorher:  npx playwright install chromium

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJEKT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WURZEL = join(PROJEKT, 'dist');
const AXE = await readFile(join(PROJEKT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const typen = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain',
  '.ics': 'text/calendar', '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  let datei = join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
  try {
    if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html');
  } catch {
    res.writeHead(404); return res.end('nicht gefunden');
  }
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': typen[extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  } catch {
    res.writeHead(404); res.end('nicht gefunden');
  }
});
await new Promise((r) => server.listen(4399, r));

function seiten(dir, basis = '') {
  const raus = [];
  for (const e of readdirSync(dir)) {
    const voll = join(dir, e);
    if (statSync(voll).isDirectory()) raus.push(...seiten(voll, `${basis}/${e}`));
    else if (e === 'index.html') raus.push(`${basis}/`);
  }
  return raus;
}

const liste = seiten(WURZEL).sort();
const browser = await chromium.launch();
let verstoesse = 0;

for (const pfad of liste) {
  const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await seite.goto(`http://127.0.0.1:4399${pfad}`, { waitUntil: 'load' });
  await seite.addScriptTag({ content: AXE });
  const ergebnis = await seite.evaluate(() =>
    axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    })
  );
  if (ergebnis.violations.length) {
    verstoesse += ergebnis.violations.length;
    console.log(`\nFEHLER ${pfad}`);
    for (const v of ergebnis.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      for (const k of v.nodes.slice(0, 3)) console.log(`     ${k.target.join(' ')} — ${k.html.slice(0, 120)}`);
    }
  } else {
    console.log(`ok     ${pfad}`);
  }
  await seite.close();
}

await browser.close();
server.close();
console.log(`\n${liste.length} Seiten geprüft, ${verstoesse} Verstösse.`);
process.exit(verstoesse ? 1 : 0);
