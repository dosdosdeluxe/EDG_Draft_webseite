# Plan: Verwaltung (Backend) auf Alfahosting

Stand 2026-11-24. Entwurf, nicht freigegeben. Zeitangaben sind grobe Schätzungen und nicht auf Alfahosting getestet.

## Ziel

Der Vorstand pflegt ohne technische Kenntnisse und ohne GitHub-Konto:
Termine, Impressum, Bilder und Mitgliederlisten (Import).

## Randbedingungen

- Alfahosting kann PHP und MariaDB, aber kein Node.js. Astro braucht Node zum Bauen.
- Die öffentliche Seite bleibt statisch und ohne JavaScript (Barrierefreiheit, Tempo).
- Das Repo ist öffentlich. Mitgliederdaten gehören nie ins Repo, auch nicht als Testdaten mit echten Namen.
- DSGVO: Der Verein ist verantwortlich, Alfahosting ist Auftragsverarbeiter.

## Architektur

```
Redakteur  ->  /verwaltung/  (PHP + MariaDB, Login, Rollen)
                 Mitglieder           nur in der Datenbank, nie im Repo
                 Termine, Impressum   öffentliche Daten
                 Bilder               Dateien in uploads/, nicht im Repo
                      |
                      |  JSON-Endpunkt mit Token (nur öffentliche Daten)
                      v
GitHub Actions: holt das JSON, baut Astro, lädt per SFTP hoch
                (ohne verwaltung/ und uploads/ zu löschen)
Auslöser: Knopf "Veröffentlichen" in der Verwaltung, nachts als Rückfall
```

Folge: Nach "Veröffentlichen" ist die Änderung nach etwa zwei Minuten live, nicht sofort.
`deploy.yml` muss `verwaltung/` und `uploads/` vom Löschen ausnehmen (heute spiegelt er mit `--delete`).

## Phasen

| Phase | Inhalt | Prüfpunkt |
|---|---|---|
| 0 | Klärung: PHP- und MariaDB-Version, SSH, AV-Vertrag, Rollen | Antworten liegen vor |
| 1 | Login mit Rollen, Termine, Impressum mit Änderungsverlauf, Kette "Veröffentlichen" | Termin ändern, nach 2 Minuten live. Impressum-Änderung ist nachvollziehbar |
| 2 | Bilder: Upload, Verkleinern, EXIF entfernen, Alt-Text Pflicht, Vermerk zur Einwilligung. Galerie liest daraus | Galerie zeigt hochgeladene Bilder, keine Originalgrößen |
| 3 | Mitglieder: CSV-Import mit Vorschau und Fehlerliste, Liste, Suche, Export, Löschen. Nur Rolle Vorstand | Beispiel-CSV mit Fehlern wird korrekt gemeldet, nichts landet im Repo |
| 4 | später: öffentlicher Mitgliederbereich, Matchplay-Erfassung (die heutigen Vorschauseiten) | nicht Teil dieses Plans |

Grobe Größe: Phase 1 zwei bis drei Tage, Phase 2 ein bis zwei, Phase 3 zwei bis drei.

## Sicherheit

- Passwörter mit `password_hash` (Argon2id oder bcrypt), Sitzungen HttpOnly, Secure, SameSite.
- CSRF-Token in jedem Formular, Begrenzung der Login-Versuche, Datenbankzugriff nur mit Prepared Statements (PDO).
- Upload: MIME-Prüfung, Größenlimit, Umbenennen, in `uploads/` keine Ausführung von Skripten (`.htaccess`).
- CSV: Größenlimit, UTF-8 prüfen, beim Export Formelzeichen entschärfen (CSV-Injection).
- `/verwaltung/` nur über HTTPS und `noindex`.
- GitHub-Token nur mit dem Recht, diesen einen Workflow zu starten, als Geheimnis auf dem Server.
- Tägliches Backup der Datenbank und von `uploads/`, Protokoll "wer hat was geändert".

## DSGVO

- Auftragsverarbeitungsvertrag mit Alfahosting abschließen, Verarbeitungsverzeichnis des Vereins ergänzen.
- Nur nötige Felder: Name, E-Mail, Handicap, Eintrittsjahr, Status.
- Zugriff nur für den Vorstand, Löschkonzept festlegen, Datenschutzerklärung anpassen.
- Impressum ändern darf nur die Rolle Admin.

## Offene Fragen

1. Welche Felder hat die Mitgliederliste, und aus welchem Programm kommt sie (Excel, PC-Caddie)? Eine Beispieldatei mit erfundenen Namen genügt.
2. Wer ist Admin, wer Redakteur, wie viele Personen?
3. Reicht "nach etwa zwei Minuten live", oder muss es sofort sein? Sofort bedeutet, die datengetriebenen Seiten auf PHP umzubauen.
4. Ist ein GitHub-Token auf dem Server akzeptabel, oder soll die Seite stattdessen nur nachts neu gebaut werden?
5. PHP-Version, MariaDB-Version und SSH-Zugang im Alfahosting-Kundenmenü nachsehen.
