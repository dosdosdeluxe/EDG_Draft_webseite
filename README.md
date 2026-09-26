# Website Eagle Golfers Dribbdebach e.V.

Phase 1 des Relaunch: die vollständige öffentliche Website, noch ohne
Mitgliederbereich.

---

## Was Sie ändern wollen, und wo

Fast alle Inhalte stehen in vier Dateien unter `src/data/`. Diese Dateien
lassen sich direkt auf github.com im Browser bearbeiten — Sie brauchen
dafür kein Programm auf dem Rechner.

| Was | Datei |
|---|---|
| Vereinsname, Zahlen auf der Startseite, **Impressumsdaten** | `src/data/verein.json` |
| Turniere und Veranstaltungen | `src/data/termine.json` |
| Eagle Tour, Holy Mountain, Hall of Fame | `src/data/ergebnisse.json` |
| Beschreibung der Wettbewerbe | `src/data/wettbewerbe.json` |
| Reihenfolge der Menüpunkte | `src/data/navigation.js` |

Längere Texte wie Vereinsgeschichte oder Datenschutzerklärung stehen in den
Seiten selbst unter `src/pages/`.

### Beim Bearbeiten der JSON-Dateien beachten

Jeder Eintrag steht in geschweiften Klammern, die Angaben sind durch Kommas
getrennt. **Nach dem letzten Eintrag steht kein Komma.** Ein vergessenes oder
zu viel gesetztes Komma bricht den Build ab — die Website bleibt dann auf dem
letzten funktionierenden Stand stehen, es geht also nichts verloren.

Datumsangaben immer im Format `JJJJ-MM-TT`, also `2026-10-11` für den
11. Oktober 2026.

---

## Vor dem Start unbedingt erledigen

- [ ] **Impressum ausfüllen.** In `src/data/verein.json` alle Platzhalter in
      eckigen Klammern ersetzen. Fehlende Angaben können abgemahnt werden.
- [ ] **Datenschutzerklärung prüfen lassen.** Der Entwurf beschreibt den
      technischen Stand zutreffend, ist aber keine Rechtsberatung.
- [ ] Echte Termine eintragen
- [ ] Echte Punktestände aus dem PC-Caddie-Export eintragen
- [ ] Vorstandsmitglieder auf der Club-Seite ergänzen
- [ ] Fotos übertragen — nur solche, für die eine Einwilligung vorliegt
- [ ] Weiterleitungen der alten Joomla-Adressen einrichten

---

## Vorschau der kommenden Phasen

Unter `/vorschau/` liegen Layout-Entwürfe für Phase 2 bis 5: Anmeldung,
Mitgliederprofil mit Handicap-Verlauf, Beitrags-Editor, KI-Textkorrektur,
Benachrichtigungen und die Verwaltungsansicht.

**Diese Seiten funktionieren nicht.** Sie zeigen nur, wie es aussehen soll,
damit der Vorstand entscheiden kann, bevor programmiert wird. Jede trägt
oben ein braunes Band, das darauf hinweist — sonst hält jemand die
Anmeldemaske für echt und tippt ein Passwort ein.

Der Zugang steht nur in der Fußzeile, nicht in der Hauptnavigation.
**Vor dem echten Start entfernen:** den Eintrag `vorschau` aus
`src/data/navigation.js` und den Ordner `src/pages/vorschau/`.

---

## Veröffentlichen

Es gibt zwei Wege, die sich nicht in die Quere kommen.

### Testversion auf GitHub Pages

Zum Herumklicken und Herzeigen, ohne die echte Domain anzufassen.

1. Im Repository: *Settings → Pages*
2. Bei **Source** `GitHub Actions` auswählen (nicht „Deploy from a branch")
3. Fertig. Nach dem nächsten Push steht die Adresse unter *Settings → Pages*

Die Adresse lautet `https://<benutzername>.github.io/<repository-name>/`.
Dass die Seite dort in einem Unterordner liegt, ist berücksichtigt — der
Workflow setzt den Pfad automatisch.

Ist das Repository öffentlich, ist auch die Testseite öffentlich. Solange
dort nur Platzhalterdaten stehen, ist das unproblematisch. **Echte
Mitgliederdaten gehören nicht dorthin.**

### Echtbetrieb auf Alfahosting

Bei jedem Push auf `main` baut GitHub die Seite und lädt sie per SFTP hoch.
Das dauert ungefähr zwei Minuten.

Einmalig einzurichten sind vier Zugangsdaten im Repository unter
*Settings → Secrets and variables → Actions*. Welche das sind, steht als
Kommentar am Ende von `.github/workflows/deploy.yml`.

### Interne Links

Interne Adressen immer über die Hilfsfunktion schreiben, nie direkt:

```astro
---
import { pfad } from '../utils/url.js';
---
<a href={pfad('/termine/')}>Termine</a>   <!-- richtig -->
<a href="/termine/">Termine</a>           <!-- falsch, bricht auf GitHub Pages -->
```

### Örtlich ausprobieren

```bash
npm install     # nur beim ersten Mal
npm run dev     # startet unter http://localhost:4321
npm run build   # erzeugt den Ordner dist/
```

---

## Wie die Seite gebaut ist

Astro erzeugt beim Bauen fertige HTML-Dateien. Auf dem Webserver läuft
**kein Node.js und keine Datenbank** — er liefert nur Dateien aus. Genau
deshalb passt die Seite auf das bestehende Alfahosting-Paket.

Die Ausgabe enthält **kein einziges Byte JavaScript**. Das Aufklappen der
Fragen auf der Seite *Spielbetrieb* nutzt die eingebauten HTML-Elemente
`details` und `summary`. Die Navigation besteht aus gewöhnlichen Links. Die
Seite funktioniert damit auch bei abgeschaltetem JavaScript vollständig.

### Barrierefreiheit

Die Seite ist auf WCAG 2.1 AA ausgelegt:

- 18 px Grundschrift, keine Textgröße unter 16 px
- Alle Farbkombinationen geprüft, die Werte stehen als Kommentar in
  `src/styles/design-system.css`
- Bedienelemente mindestens 48 × 48 Pixel
- Sichtbare Fokusrahmen — **diese Regeln nicht entfernen**
- Sprunglink zum Hauptinhalt
- Farbe trägt nie allein die Bedeutung; Status hat immer Zeichen und Text
- Bewegung wird abgeschaltet, wenn das Betriebssystem das vorgibt

Wer Farben ändert, muss den Kontrast neu prüfen, zum Beispiel auf
[webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/).
Das helle Gold `#d4a820` erreicht auf Weiß nur 2,23:1 und darf deshalb
**niemals als Textfarbe auf hellem Grund** verwendet werden. Dafür gibt es
`--gold-text`.

### Datenschutz

Die Schriftart wird mitgeliefert und **nicht von Google geladen**. Beim
Seitenaufruf entsteht damit keine Verbindung zu einem Drittanbieter. Es gibt
keine Cookies, kein Tracking und kein Einwilligungsbanner — weil nichts da
ist, wofür eingewilligt werden müsste.

---

## Abweichung vom Pflichtenheft

Das Pflichtenheft nennt Tailwind CSS. Umgesetzt ist stattdessen gewöhnliches
CSS mit benannten Farbwerten. Grund: Bei Tailwind stehen Dutzende
Hilfsklassen im Markup, was das Bearbeiten für Vereinsmitglieder ohne
Programmierkenntnisse deutlich erschwert. Der Nutzen — schnelleres Gestalten
durch Entwickler — wiegt das bei acht Seiten nicht auf.

---

## Aufbau der Dateien

```
src/
├── data/         Inhalte — hier wird gepflegt
├── pages/        je eine Datei pro Seite
├── layouts/      gemeinsamer Rahmen aller Seiten
├── components/   wiederverwendete Bausteine
├── styles/       Design-System mit allen Farben und Größen
└── utils/        Hilfsfunktionen, z.B. Datumsformat
public/           Dateien, die unverändert ausgeliefert werden
```
