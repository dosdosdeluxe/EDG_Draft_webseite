// Erzeugt das Vorschaubild fuers Teilen (WhatsApp, Facebook, LinkedIn)
// und die App-Symbole fuer den Home-Bildschirm.
//
//   public/og-bild.png        1200x630, erscheint beim Teilen des Links
//   public/icon-180.png       Apple-Touch-Icon (iPhone, iPad)
//   public/icon-192.png       Android
//   public/icon-512.png       Android, Splash-Screen
//
// Aufruf:  node bilder-erzeugen.mjs
//
// Das Vorschaubild wird im Browser gesetzt und abfotografiert, damit es
// dieselbe Schrift und dieselben Farben verwendet wie die Website.

import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJEKT = '/home/claude/egd-website';
const logo = readFileSync(join(PROJEKT, 'public/logo.png')).toString('base64');
const schrift = readFileSync(
  join(PROJEKT, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')
).toString('base64');

const karte = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Inter';
    src: url(data:font/woff2;base64,${schrift}) format('woff2-variations');
    font-weight: 100 900;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    display: flex; align-items: center; gap: 56px;
    padding: 0 88px;
    font-family: 'Inter', sans-serif;
    color: #fff;
    background:
      radial-gradient(1100px 700px at 78% 22%, rgba(212,168,32,.20), transparent 62%),
      linear-gradient(145deg, #1a3a5c 0%, #122848 62%, #0d1e36 100%);
    position: relative;
    overflow: hidden;
  }
  .band {
    position: absolute; left: 0; right: 0; bottom: 0; height: 12px;
    background: linear-gradient(90deg, #d4a820 0%, #F5C518 45%, #3a7c3f 100%);
  }
  .wappen { width: 268px; flex-shrink: 0; filter: drop-shadow(0 12px 32px rgba(0,0,0,.45)); }
  .text { min-width: 0; }
  .ort {
    font-size: 25px; font-weight: 600; letter-spacing: .16em;
    text-transform: uppercase; color: #F5C518; margin-bottom: 22px;
  }
  h1 {
    font-size: 70px; font-weight: 700; line-height: 1.04;
    letter-spacing: -.022em; text-wrap: balance;
  }
  .unter {
    margin-top: 26px; font-size: 32px; font-weight: 400;
    color: rgba(255,255,255,.82); line-height: 1.35;
  }
  .fuss {
    margin-top: 40px; display: flex; gap: 14px; flex-wrap: wrap;
  }
  .marke {
    font-size: 22px; font-weight: 600;
    padding: 10px 20px; border-radius: 999px;
    border: 2px solid rgba(255,255,255,.34);
    color: rgba(255,255,255,.93);
  }
</style></head><body>
  <img class="wappen" src="data:image/png;base64,${logo}" alt="">
  <div class="text">
    <p class="ort">Frankfurt am Main &middot; seit 2010</p>
    <h1>Eagle Golfers<br>Dribbdebach e.V.</h1>
    <p class="unter">Golf mit Leidenschaft, ohne Standesd&uuml;nkel</p>
    <div class="fuss">
      <span class="marke">Eagle Tour</span>
      <span class="marke">Matchplay</span>
      <span class="marke">Clubmeisterschaft</span>
    </div>
  </div>
  <div class="band"></div>
</body></html>`;

const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await seite.setContent(karte, { waitUntil: 'load' });
await seite.evaluate(() => document.fonts.ready);
await seite.waitForTimeout(400);
await seite.screenshot({ path: join(PROJEKT, 'public/og-bild.png') });

// App-Symbole: Wappen mittig auf dunkelblauem Grund mit runden Ecken.
for (const groesse of [180, 192, 512]) {
  const rand = Math.round(groesse * 0.14);
  const radius = Math.round(groesse * 0.22);
  const symbol = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box}
    body{width:${groesse}px;height:${groesse}px;display:grid;place-items:center;
         padding:${rand}px;background:#122848;border-radius:${radius}px;overflow:hidden}
    img{width:100%;height:100%;object-fit:contain}
  </style></head><body><img src="data:image/png;base64,${logo}" alt=""></body></html>`;
  const s = await browser.newPage({ viewport: { width: groesse, height: groesse } });
  await s.setContent(symbol, { waitUntil: 'load' });
  await s.screenshot({ path: join(PROJEKT, `public/icon-${groesse}.png`), omitBackground: false });
  await s.close();
}

await browser.close();
console.log('og-bild.png und icon-180/192/512.png in public/ erzeugt.');
