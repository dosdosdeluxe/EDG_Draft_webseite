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
import { relativeAdressen } from './relative-pfade.mjs';

const SEITE_ECHT = 'https://eaglegolfersdribbdebach.de';
const SEITE_ENTWURF = 'https://dosdosdeluxe.github.io';

function bauen(basis, zusatz = {}) {
  execSync('npx astro build', {
    cwd: PROJEKT,
    env: { ...process.env, BASE_PATH: basis, ...zusatz },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

// Bricht den Lauf ab, statt eine falsche Fassung auszuliefern.
function pruefen(bedingung, meldung) {
  if (!bedingung) throw new Error(`Prüfung fehlgeschlagen: ${meldung}`);
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
// Regel 10: Die Entwurfsfassung darf nicht in die Suche. robots.txt und
// noindex-Metatag schreibt der Build selbst (sitemap-und-robots.mjs und
// Base.astro, gesteuert über NOINDEX=1). Hier wird nur noch nachgeprüft.
pruefen(readFileSync(join(PROJEKT, 'docs', 'robots.txt'), 'utf8').includes('Disallow: /'), 'docs/robots.txt sperrt nicht');
pruefen(readFileSync(join(PROJEKT, 'docs', 'index.html'), 'utf8').includes('noindex'), 'docs/index.html hat kein noindex');
pruefen(!existsSync(join(PROJEKT, 'docs', 'sitemap.xml')), 'docs/ enthält eine sitemap.xml');
console.log('docs/ gebaut — Grundpfad ' + REPO_PFAD + ', nicht indexierbar');

// ── 2. Fassung zum Doppelklicken ──────────────────────────────────
bauen('/', { SITE_URL: SEITE_ECHT });
const sitemap = join(PROJEKT, 'dist', 'sitemap.xml');
pruefen(existsSync(sitemap), 'dist/sitemap.xml fehlt');
console.log(`sitemap.xml vorhanden, ${(readFileSync(sitemap, 'utf8').match(/<loc>/g) || []).length} Seiten`);
const ZIEL = join(PROJEKT, 'EGD-Website-Vorschau');
rmSync(ZIEL, { recursive: true, force: true });
cpSync(join(PROJEKT, 'dist'), ZIEL, { recursive: true });

const umgeschrieben = relativeAdressen(ZIEL);
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
