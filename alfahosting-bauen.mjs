// Erzeugt die Upload-Pakete für Alfahosting in ausgabe/ (Aufruf: npm run alfahosting).
//
//   ausgabe/alfahosting-live/      für die echte Adresse, Wurzel "/", mit sitemap.xml
//   ausgabe/alfahosting-entwurf/   zum Zeigen: läuft in jedem Unterordner und jeder
//                                  Subdomain (relative Adressen), für Suchmaschinen gesperrt
//   ausgabe/*.zip                  derselbe Inhalt als ZIP
//   ausgabe/UPLOAD-ANLEITUNG.txt   Schritte und Stand der Go-Live-Prüfung
//
// Der Ordner ausgabe/ steht in .gitignore. Nichts davon landet im Repository.
// Hochgeladen wird hier nichts, das macht der Mensch per SFTP.

import { execSync, execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kalenderSchreiben } from './kalender-erzeugen.mjs';
import { relativeAdressen } from './relative-pfade.mjs';

const PROJEKT = dirname(fileURLToPath(import.meta.url));
const AUSGABE = join(PROJEKT, 'ausgabe');
const SEITE_ECHT = 'https://eaglegolfersdribbdebach.de';

// .htaccess für den Entwurf: ohne Weiterleitung auf https und ohne eigene
// Fehlerseite, weil beides vom Zielordner abhängt. Gesperrt wird über das
// noindex-Metatag und zusätzlich über diesen Header.
const HTACCESS_ENTWURF = `# Entwurfsfassung: läuft in jedem Ordner und jeder Subdomain.
# Bei Fehler 500 nach dem Upload diese Datei löschen, die Seite läuft auch ohne sie.
AddType application/manifest+json .webmanifest

<IfModule mod_headers.c>
  Header always set X-Robots-Tag "noindex, nofollow"
  Header always set X-Content-Type-Options "nosniff"
</IfModule>

<IfModule mod_deflate.c>
  <IfModule mod_filter.c>
    AddOutputFilterByType DEFLATE text/html text/css text/plain image/svg+xml
  </IfModule>
</IfModule>

Options -Indexes
`;

function pruefen(bedingung, meldung) {
  if (!bedingung) throw new Error(`Prüfung fehlgeschlagen: ${meldung}`);
}

function bauen(zusatz) {
  // Die Fassung entscheidet sich nur an diesen drei Variablen. Was in der
  // Umgebung der Aufrufer steht, darf nicht hineinspielen.
  const env = { ...process.env };
  for (const k of ['NOINDEX', 'SITE_URL', 'BASE_PATH']) delete env[k];
  execSync('npx astro build', { cwd: PROJEKT, env: { ...env, ...zusatz }, stdio: ['ignore', 'ignore', 'inherit'] });
}

function alleDateien(ordner) {
  return readdirSync(ordner).flatMap((e) => {
    const voll = join(ordner, e);
    return statSync(voll).isDirectory() ? alleDateien(voll) : [voll];
  });
}

function paketAnlegen(name) {
  const ziel = join(AUSGABE, name);
  rmSync(ziel, { recursive: true, force: true });
  cpSync(join(PROJEKT, 'dist'), ziel, { recursive: true });
  return ziel;
}

function zippen(ordner) {
  const zip = `${ordner}.zip`;
  rmSync(zip, { force: true });
  execFileSync('zip', ['-rq', zip, '.', '-x', '*.DS_Store'], { cwd: ordner });
  return zip;
}

// Was auf der echten Adresse noch nach Entwurf aussieht. Die Vorschauseiten
// bleiben außen vor, sie sind ihrer Natur nach Attrappen.
const MARKER = [
  { suche: /Entwurfsfassung/, text: 'Hinweiskasten "Entwurfsfassung" auf der Startseite' },
  { suche: /PLATZHALTER|Platzhalter/, text: 'Platzhalter-Hinweise in Texten oder Tabellen' },
  { suche: /\[[^\]<]{2,80}(eintragen|optional)[^\]<]*\]|\[PLZ\]/, text: 'Impressum: Angaben in eckigen Klammern fehlen' },
  { suche: /beispiel\.de/, text: 'Beispiel-Adressen (beispiel.de)' },
];

function goLivePruefen(ordner) {
  const offen = [];
  const seiten = alleDateien(ordner).filter((f) => f.endsWith('.html') && !f.startsWith(join(ordner, 'vorschau')));
  const texte = seiten.map((f) => ({ f, t: readFileSync(f, 'utf8') }));
  for (const m of MARKER) {
    const treffer = texte.filter(({ t }) => m.suche.test(t)).length;
    if (treffer) offen.push(`${m.text} (${treffer} Seiten)`);
  }
  if (texte.some(({ t }) => t.includes('href="/vorschau/'))) {
    offen.push('Die 13 Vorschauseiten sind enthalten und von Startseite und Fußzeile verlinkt (README: vor dem Start entfernen)');
  }
  return offen;
}

// ── 0. Kalenderdatei aus den Terminen erzeugen ────────────────────
kalenderSchreiben(join(PROJEKT, 'public'));
mkdirSync(AUSGABE, { recursive: true });

// ── 1. Entwurf: relative Adressen, noindex ────────────────────────
// Zuerst bauen, damit dist/ am Ende die echte Fassung enthält.
bauen({ BASE_PATH: '/', SITE_URL: SEITE_ECHT, NOINDEX: '1' });
const entwurf = paketAnlegen('alfahosting-entwurf');
const umgestellt = relativeAdressen(entwurf);
writeFileSync(join(entwurf, '.htaccess'), HTACCESS_ENTWURF);
pruefen(readFileSync(join(entwurf, 'robots.txt'), 'utf8').includes('Disallow: /'), 'Entwurf: robots.txt sperrt nicht');
pruefen(readFileSync(join(entwurf, 'index.html'), 'utf8').includes('noindex'), 'Entwurf: index.html hat kein noindex');
pruefen(!existsSync(join(entwurf, 'sitemap.xml')), 'Entwurf enthält eine sitemap.xml');
const absolut = alleDateien(entwurf).filter((f) => f.endsWith('.html') && /(href|src)="\/[^/]/.test(readFileSync(f, 'utf8')));
pruefen(absolut.length === 0, `Entwurf hat noch Adressen mit führendem Schrägstrich in ${absolut.length} Dateien`);
console.log(`alfahosting-entwurf/: ${alleDateien(entwurf).length} Dateien, ${umgestellt} Adressen relativ, noindex`);

// ── 2. Live: echte Adresse, Wurzel ────────────────────────────────
bauen({});
const live = paketAnlegen('alfahosting-live');
pruefen(existsSync(join(live, 'sitemap.xml')), 'Live: sitemap.xml fehlt');
pruefen(existsSync(join(live, '.htaccess')), 'Live: .htaccess fehlt');
pruefen(readFileSync(join(live, 'robots.txt'), 'utf8').includes('Allow: /'), 'Live: robots.txt erlaubt nicht');
pruefen(!readFileSync(join(live, 'index.html'), 'utf8').includes('noindex'), 'Live: index.html trägt noindex');
console.log(`alfahosting-live/: ${alleDateien(live).length} Dateien, mit sitemap.xml und .htaccess`);

// ── 3. Go-Live-Prüfung (nur Hinweis, bricht nichts ab) ────────────
const offen = goLivePruefen(live);
console.log(offen.length ? `Go-Live-Prüfung: ${offen.length} Punkte offen` : 'Go-Live-Prüfung: keine offenen Punkte');
offen.forEach((o) => console.log(`  - ${o}`));

// ── 4. ZIP und Anleitung ──────────────────────────────────────────
zippen(entwurf);
zippen(live);

const heute = new Date().toLocaleDateString('de-DE');
writeFileSync(join(AUSGABE, 'UPLOAD-ANLEITUNG.txt'), `UPLOAD AUF ALFAHOSTING
======================
Erzeugt am ${heute} mit:  npm run alfahosting
Nach jeder Änderung an Texten oder Daten den Befehl erneut ausführen.

ZWEI PAKETE
-----------
alfahosting-live/      Für die echte Adresse (eaglegolfersdribbdebach.de).
                       Mit sitemap.xml, https-Weiterleitung und eigener 404-Seite.
alfahosting-entwurf/   Zum Zeigen. Läuft in einem Unterordner oder auf einer
                       Subdomain, ist für Suchmaschinen gesperrt (noindex).
Zu jedem Paket gibt es eine ZIP-Datei mit demselben Inhalt.

GO-LIVE-PRÜFUNG FÜR alfahosting-live
------------------------------------
${offen.length ? 'NICHT hochladen, solange diese Punkte offen sind:\n' + offen.map((o) => `  - ${o}`).join('\n') : 'Keine offenen Punkte gefunden.'}

Die Prüfung findet nur Platzhalter, die im Text stehen. Ob das Impressum
rechtlich vollständig ist und die Datenschutzerklärung geprüft wurde, kann
sie nicht beurteilen.

SO GEHT DER UPLOAD
------------------
1. Zugangsdaten (SFTP oder FTP) stehen im Alfahosting-Kundenmenü.
2. Live: Zuerst die bisherige Seite sichern (alle Dateien und die Datenbank
   der alten Joomla-Seite herunterladen). Sonst gibt es kein Zurück.
3. Mit einem SFTP-Programm (zum Beispiel FileZilla) verbinden und den
   Zielordner der Domain öffnen.
4. Den INHALT des Pakets hochladen, nicht den Ordner selbst. Im Programm
   "versteckte Dateien anzeigen" einschalten, sonst fehlt die .htaccess.
5. Entwurf: In einen eigenen Unterordner (zum Beispiel entwurf/) oder auf eine
   Subdomain legen und mit einem Passwortschutz versehen. Aufruf dann unter
   .../entwurf/index.html. Die Seite enthält Platzhalterdaten.
6. Prüfen: Startseite öffnen, eine Unterseite öffnen, eine falsche Adresse
   aufrufen (zeigt die eigene 404-Seite), bei Live http:// aufrufen (muss auf
   https:// umleiten).

FEHLER 500 NACH DEM UPLOAD
--------------------------
Die .htaccess enthält Einstellungen, die der Server eventuell nicht erlaubt.
Datei löschen und neu laden. Läuft die Seite dann, die Fehlermeldung aus dem
Fehlerprotokoll im Kundenmenü weitergeben.
`);

console.log(`ausgabe/: 2 Pakete, 2 ZIP-Dateien, UPLOAD-ANLEITUNG.txt`);
