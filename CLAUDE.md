# CLAUDE.md — Eagle Golfers Dribbdebach e.V.

Static website for a golf club in Frankfurt Niederrad. Astro 5, zero JavaScript
in the output, WCAG 2.1 AA. Target audience: members aged 60 and up, mobile first.

Antworte auf Deutsch, Code und Commits auf Englisch.

## Befehle

```bash
npm install
npm run dev            # localhost:4321
npm run build          # -> dist/ (prebuild erzeugt public/termine.ics neu, danach
                       #    schreibt sitemap-und-robots.mjs sitemap.xml bzw. die Sperr-robots.txt)
node fassungen-bauen.mjs   # erzeugt docs/ (GitHub Pages) + EGD-Website-Vorschau/ (file://)
node bilder-erzeugen.mjs   # Vorschaubild og-bild.jpg + App-Symbole neu rendern
npm run alfahosting    # ausgabe/: Upload-Pakete live + entwurf (Ordner und ZIP) + UPLOAD-ANLEITUNG.txt
```

## Wo was liegt

| Was | Datei |
|---|---|
| Vereinsname, Zahlen, **Impressum** | `src/data/verein.json` |
| Turniere und Veranstaltungen | `src/data/termine.json` |
| Eagle Tour, Holy Mountain, Hall of Fame | `src/data/ergebnisse.json` |
| Matchplay-Turnierbaum | `src/data/matchplay.json` |
| Beschreibung der Wettbewerbe | `src/data/wettbewerbe.json` |
| Checklisten Turnier + Mitgliederversammlung | `src/data/organisatorisches.json` |
| Menüpunkte | `src/data/navigation.js` |
| Farben, Typografie, Komponenten | `src/styles/design-system.css` |

`src/data/mitglieder.json` enthält **ausschliesslich Platzhalter**. Echte
Mitgliederdaten gehören nie ins Repository, sondern in eine Datenbank hinter
einer Anmeldung mit Row Level Security.

`src/pages/vorschau/` sind Layout-Attrappen für noch nicht gebaute Funktionen.
Jede dieser Seiten trägt `<VorschauHinweis>`, Formularfelder sind `disabled`.
Das ist nicht optional: sonst tippt jemand ein echtes Passwort in ein totes
Formular. In der echten Fassung stehen sie nicht in der Sitemap, und
`public/robots.txt` sperrt `/vorschau/` für Crawler (Crawl-Sperre, kein
`noindex`).

## Harte Regeln

Jede davon steht hier, weil sie schon einmal gebrochen wurde.

1. **Umlaute ausschreiben.** In jedem Anzeigetext: `nächsten`, nicht `naechsten`.
   JSON-Schlüssel und JS-Bezeichner bleiben ASCII.
2. **Interne Links nur über `pfad()`** aus `src/utils/url.js`, aktiver Zustand
   über `istAktiv()`. Die Seite läuft unter `/` und unter `/EDG_Draft_webseite/`.
   In `.astro`-Dateien nie eine lokale Variable `pfad` anlegen, die kollidiert
   mit dem Import.
3. **Asset-Ordner heisst `assets`, nicht `_astro`.** GitHub Pages schickt im
   Branch-Modus alles durch Jekyll, und Jekyll überspringt Ordner mit führendem
   Unterstrich. Zusätzlich liegt `.nojekyll` in `docs/`.
4. **Jede Tabelle in einem scrollbaren Bereich mit Tastaturzugang:**
   `<div class="table-scroll" role="region" tabindex="0" aria-label="...">`.
   Ohne `tabindex` ist der Bereich nur mit der Maus scrollbar (WCAG 2.1.1).
5. **Überschriftenebenen nicht überspringen.** Der Kasten `.note` nimmt `h2`,
   `h3` oder `h4`, je nachdem was davor steht; alle drei sehen gleich aus.
6. **Grid-Spalten als `minmax(min(320px, 100%), 1fr)`**, sonst läuft die Seite
   auf schmalen Geräten über den Rand. Flex-Kinder mit langem Text brauchen
   `min-width: 0`.
7. **Farbe trägt nie allein die Bedeutung.** Jedes Status-Kennzeichen hat
   zusätzlich Zeichen und Text.
8. **`--gold` (#d4a820) ist Dekoration, kein Textton** (2,23:1). Für Text auf
   Hell `--gold-text` (#8A6D25, 4,89:1), auf Dunkel `--gold-lt`.
9. **Schriften werden mitgeliefert** (`@fontsource-variable/inter`), nie von
   Google geladen (LG München I, 3 O 17493/20).
10. **Die Entwurfsfassung ist `noindex`.** Jeder Build mit `NOINDEX=1` setzt das
    Metatag (`Base.astro`) und schreibt eine sperrende `robots.txt` ohne
    Sitemap (`sitemap-und-robots.mjs`, eingebunden in `astro.config.mjs`).
    `NOINDEX=1` setzen `fassungen-bauen.mjs` (docs/), `alfahosting-bauen.mjs`
    (Entwurfspaket) und `github-pages.yml`.
    Jeder neue Weg, die Entwurfsseite zu bauen, muss es ebenfalls setzen.
    Platzhalterdaten dürfen nicht in die Google-Suche.

## Prüfen vor dem Abhaken

```bash
npx playwright install chromium     # einmalig
node skripte/axe-pruefung.mjs       # alle Seiten, erwartet 0 Verstösse
node skripte/breite-pruefen.mjs     # erwartet: keine Überbreite ab 320px
```

Beide Skripte bauen vorher nicht selbst. Erst `npm run build`, dann prüfen.

## Veröffentlichen

**GitHub Pages (Entwurf):** `node fassungen-bauen.mjs` erzeugt `docs/`. Der
Ordner muss per Drag and Drop ins Upload-Feld von GitHub gezogen werden, nicht
über die Dateiauswahl: sonst verliert GitHub die Unterordner. Danach
Settings → Pages → Deploy from a branch → `main` / `/docs`.

**Alfahosting (Ziel):** `.github/workflows/deploy.yml` lädt `dist/` per lftp
hoch. Er läuft **nur von Hand** (Actions → Run workflow), weil der Upload mit
`--delete` spiegelt und im Zielordner alles löscht, was nicht in `dist/` liegt
(auch das alte Joomla). Einen Push-Trigger erst ergänzen, wenn Impressum und
Datenschutz echt sind. Von Hand: `npm run alfahosting` baut `ausgabe/` (Anleitung
und Go-Live-Prüfung in `UPLOAD-ANLEITUNG.txt`). Das Livepaket ist die echte
Fassung, das Entwurfspaket läuft mit relativen Adressen in jedem Unterordner und
ist `noindex`. Alfahosting kann PHP und MariaDB, aber **kein Node.js und kein
PostgreSQL**. Astro braucht Node nur zum Bauen, das Ergebnis sind statische
Dateien. Für ein späteres Backend ist der Hoster damit raus.

## Winter-Matchplay (PHP-Tool in `public/matchplay-winter/`)

Übernommen aus der Live-Version auf hammaecker.de/Eaglesmatchplay (Stand 2026-11-24).
Anders als die Astro-Seiten braucht es PHP und JavaScript: Spielplan, Tabellen,
Ergebnis melden, Fotos, Editor mit Login und Verlauf. Nicht im Menü der
Entwurfsfassung testbar, auf GitHub Pages läuft kein PHP.

- `api.php` trägt nur Platzhalter-Passwörter (`BITTE-AENDERN`). Echte Startpasswörter
  gehören nie ins Repository. `data.json` ist eine leere Vorlage.
- **Nie ins Repo:** `data.json` mit Inhalt, `users.php`, `verlauf.php`, `meldungen.php`,
  `fotos.php`, `terminspieler.php`, `fotos/`. Sie enthalten Namen und Passwort-Hashes.
- `deploy.yml` nimmt diese Dateien samt `api.php` vom `--delete` aus. Sonst würde ein
  Deploy die Live-Daten und die Passwörter überschreiben.
- Nicht in der Sitemap, `noindex`. Kontrastfarbe `--accent` auf `#7FCB86` angehoben (axe).
- Offen: nicht auf Alfahosting getestet (PHP-Version, Schreibrechte, `mail()`).

## Dev-Server (Alfahosting, /html/dev26)

Passwortschutz per Basic Auth: `.htpasswd` und ein erweiterter `.htaccess` liegen nur
auf dem Server. Beim Upload des Pakets `.htaccess`, `.htpasswd`, `matchplay-winter/api.php`
und `matchplay-winter/data.json` überspringen, sonst fällt der Schutz weg. Zugangsdaten
lokal in `~/.matchplay-dev-zugang.txt`, nie ins Repo.

## Stand und offene Punkte

Fertig: 11 öffentliche Seiten, 13 Vorschauseiten, Organisatorisches,
Kalender-Abo (`termine.ics`, mit deutschen Zeitzonenregeln), Vorschaubild fürs
Teilen, App-Manifest, Sitemap, robots.txt. 23 Seiten, 0 axe-Verstösse, kein
Querscrollen ab 320px.

Offen:
- **Impressum** besteht aus Platzhaltern. Ohne echte Daten (§ 5 DDG) darf die
  Seite nicht unter der echten Vereinsadresse laufen.
- **Datenschutzerklärung** ist ein Entwurf und braucht juristische Prüfung.
- **Satzung fehlt.** Die Fristen in `organisatorisches.json` sind Platzhalter
  und in der Tabelle als solche markiert.
- **`public/bilder/` ist leer**, die Galerie zeigt nichts.
- **Mitgliederbereich und Backend** sind nur Attrappen. Die Daten werden
  derzeit in einer Eingabemaske ausserhalb des Repositories gepflegt und von
  Hand in die JSON-Dateien übernommen.
- **Golf-Starterlisten-Tool** steht noch aus. Offene Frage: Eagles- oder
  Eintracht-Frankfurt-Gestaltung.
