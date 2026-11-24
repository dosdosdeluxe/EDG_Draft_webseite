// Erzeugt aus dem Astro-Projekt die beiden Fassungen, die der Vorstand bekommt:
//
//   1. docs/                     für GitHub Pages (Unterpfad /EDG_Draft_webseite/)
//   2. EGD-Website-Vorschau/     zum Doppelklicken ohne Server (file://)
//
// Aufruf:  node fassungen-bauen.mjs
//
// Die Doppelklick-Fassung braucht relative Pfade, weil ein Browser bei
// file:// ein führendes "/" als Wurzel der Festplatte liest. Ausserdem
// muss jeder Ordner-Link ausgeschrieben werden: file:// kennt kein
// "index.html automatisch nachladen".

import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJEKT = dirname(fileURLToPath(import.meta.url));
const REPO_PFAD = '/EDG_Draft_webseite/';   // Name des GitHub-Repos

import { kalenderSchreiben } from './kalender-erzeugen.mjs';

const SEITE_ECHT = 'https://eaglegolfersdribbdebach.de';
const SEITE_ENTWURF = 'https://dosdosdeluxe.github.io';

function bauen(basis, zusatz = {}) {
  execSync('npx astro build', {
    cwd: PROJEKT,
    env: { ...process.env, BASE_PATH: basis, ...zusatz },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

// Sitemap: sagt Suchmaschinen, welche Seiten es gibt. Die Vorschau des
// Mitgliederbereichs bleibt draussen, sie ist nur ein Entwurf.
function sitemapSchreiben(ordner, grundadresse, basis = '/') {
  const seiten = [];
  (function sammeln(dir, pfadTeil = '') {
    for (const e of readdirSync(dir)) {
      const voll = join(dir, e);
      if (statSync(voll).isDirectory()) sammeln(voll, `${pfadTeil}/${e}`);
      else if (e === 'index.html') seiten.push(`${pfadTeil}/`);
    }
  })(ordner);

  const heute = new Date().toISOString().slice(0, 10);
  const eintraege = seiten
    .filter((s) => !s.startsWith('/vorschau'))
    .sort()
    .map((s) => {
      const adresse = new URL(basis.replace(/\/+$/, '') + s, grundadresse).href;
      const wichtig = s === '/' ? '1.0' : '0.7';
      return `  <url>\n    <loc>${adresse}</loc>\n    <lastmod>${heute}</lastmod>\n    <priority>${wichtig}</priority>\n  </url>`;
    })
    .join('\n');

  writeFileSync(
    join(ordner, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`
  );
  return seiten.length;
}

function alleDateien(ordner) {
  const raus = [];
  for (const e of readdirSync(ordner)) {
    const voll = join(ordner, e);
    if (statSync(voll).isDirectory()) raus.push(...alleDateien(voll));
    else raus.push(voll);
  }
  return raus;
}

// ── 0. Kalenderdatei aus den Terminen erzeugen ────────────────────
// Muss vor dem Build laufen: alles in public/ wandert unveraendert mit.
console.log(`termine.ics: ${kalenderSchreiben(join(PROJEKT, 'public'))} Termine`);

// ── 1. Fassung für GitHub Pages ───────────────────────────────────
// Entwurf: nicht indexieren, aber das Vorschaubild soll beim Teilen
// von der GitHub-Adresse geladen werden.
bauen(REPO_PFAD, { SITE_URL: SEITE_ENTWURF, NOINDEX: '1' });
rmSync(join(PROJEKT, 'docs'), { recursive: true, force: true });
cpSync(join(PROJEKT, 'dist'), join(PROJEKT, 'docs'), { recursive: true });
// .nojekyll schaltet die Jekyll-Verarbeitung ab. Ohne diese Datei
// verschluckt GitHub Ordner, deren Name mit einem Unterstrich beginnt.
writeFileSync(join(PROJEKT, 'docs', '.nojekyll'), '');
writeFileSync(
  join(PROJEKT, 'docs', 'robots.txt'),
  '# Entwurfsfassung. Platzhalterdaten — gehoert nicht in die Suche.\nUser-agent: *\nDisallow: /\n'
);
console.log('docs/ gebaut — Grundpfad ' + REPO_PFAD + ', nicht indexierbar');

// ── 2. Fassung zum Doppelklicken ──────────────────────────────────
bauen('/', { SITE_URL: SEITE_ECHT });
const anzahl = sitemapSchreiben(join(PROJEKT, 'dist'), SEITE_ECHT);
console.log(`sitemap.xml geschrieben — ${anzahl} Seiten gefunden`);
const ZIEL = join(PROJEKT, 'EGD-Website-Vorschau');
rmSync(ZIEL, { recursive: true, force: true });
cpSync(join(PROJEKT, 'dist'), ZIEL, { recursive: true });

let umgeschrieben = 0;
for (const datei of alleDateien(ZIEL)) {
  const istHtml = datei.endsWith('.html');
  const istCss = datei.endsWith('.css');
  if (!istHtml && !istCss) continue;
  let text = readFileSync(datei, 'utf8');

  // Wie tief liegt diese Datei unter der Wurzel?
  const nachOben = relative(dirname(datei), ZIEL).replace(/\\/g, '/');
  const praefix = nachOben === '' ? '' : nachOben + '/';

  if (istHtml) {
    text = text.replace(/(href|src)="\/([^"]*)"/g, (_, attribut, rest) => {
      let ziel = rest;
      // Ordner-Adressen ausschreiben: "termine/" → "termine/index.html"
      if (ziel === '' || ziel.endsWith('/')) ziel += 'index.html';
      umgeschrieben++;
      return `${attribut}="${praefix}${ziel}"`;
    });
  }

  // url(...) in Stylesheets und in <style>-Blöcken: Schriftdateien und
  // das Hintergrundlogo stehen dort ebenfalls mit führendem Schrägstrich.
  text = text.replace(/url\((['"]?)\/([^)'"]+)\1\)/g, (_, anf, rest) => {
    umgeschrieben++;
    return `url(${anf}${praefix}${rest}${anf})`;
  });

  writeFileSync(datei, text, 'utf8');
}
console.log(`EGD-Website-Vorschau/ gebaut — ${umgeschrieben} Adressen auf relative Pfade umgestellt.`);

// Kurze Anleitung dazulegen
writeFileSync(join(ZIEL, 'ANLEITUNG.txt'), `EGD-Website — Vorschau zum Anschauen
=====================================

Doppelklick auf  index.html  öffnet die Startseite im Browser.
Es wird nichts installiert und nichts ins Internet geladen.

Direkt zu einzelnen Bereichen:

  index.html                    Startseite
  organisatorisches/index.html  Organisatorisches: Checklisten und
                                Mitgliederversammlung
  matchplay/index.html          Turnierbaum Matchplay
  vorschau/index.html           Mitgliederbereich und Backend
                                (Layout-Vorschau, noch nicht gebaut)

Alle Namen, Termine und Punktestände sind Platzhalter.

Die Formulare im Ordner "vorschau" nehmen keine Eingaben entgegen.
Bitte dort niemals ein echtes Passwort eintippen.
`);

mkdirSync(join(PROJEKT, 'ausgabe'), { recursive: true });
console.log('Fertig.');
