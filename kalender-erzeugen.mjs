// Erzeugt aus src/data/termine.json eine Kalenderdatei im ICS-Format.
//
// Wer sie abonniert, bekommt alle Vereinstermine in seinen eigenen
// Kalender — und jede spaetere Aenderung wandert automatisch mit,
// weil der Kalender die Datei regelmaessig neu abruft.
//
// Wird von fassungen-bauen.mjs nach jedem Build aufgerufen.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJEKT = '/home/claude/egd-website';

// Zeilen im ICS-Format duerfen hoechstens 75 Zeichen lang sein.
function falten(zeile) {
  const bytes = Buffer.from(zeile, 'utf8');
  if (bytes.length <= 74) return zeile;
  const teile = [];
  let rest = zeile;
  let grenze = 73;
  while (Buffer.from(rest, 'utf8').length > grenze) {
    let schnitt = grenze;
    while (Buffer.from(rest.slice(0, schnitt), 'utf8').length > grenze) schnitt--;
    teile.push(rest.slice(0, schnitt));
    rest = rest.slice(schnitt);
    grenze = 72; // Folgezeilen beginnen mit einem Leerzeichen
  }
  teile.push(rest);
  return teile.join('\r\n ');
}

// Semikolon, Komma und Backslash haben im ICS-Format eine Bedeutung.
const schuetzen = (text) =>
  String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

function stempel(datum, uhrzeit, plusStunden = 0) {
  const [j, m, t] = datum.split('-').map(Number);
  const [h, min] = (uhrzeit || '09:00').split(':').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t, h + plusStunden, min));
  const z = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}` +
    `T${z(d.getUTCHours())}${z(d.getUTCMinutes())}00`
  );
}

export function kalenderSchreiben(zielOrdner) {
  const daten = JSON.parse(readFileSync(join(PROJEKT, 'src/data/termine.json'), 'utf8'));
  const verein = JSON.parse(readFileSync(join(PROJEKT, 'src/data/verein.json'), 'utf8'));

  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eagle Golfers Dribbdebach e.V.//Termine//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${schuetzen(verein.kurzname + ' Termine')}`,
    `X-WR-CALDESC:${schuetzen('Turniere und Veranstaltungen des ' + verein.name)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    // Wie oft der Kalender nachschaut, ob sich etwas geaendert hat.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    // Sommer- und Winterzeit fuer Deutschland, damit die Uhrzeiten stimmen.
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:MESZ',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:MEZ',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  let anzahl = 0;
  for (const t of daten.termine) {
    if (!t.datum) continue;
    const dauer = Number(t.dauer_stunden) > 0 ? Number(t.dauer_stunden) : 5;
    const kennung = `${t.datum}-${(t.titel || 'termin')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}@eaglegolfersdribbdebach.de`;

    const beschreibung = [
      t.spielform ? `Spielform: ${t.spielform}` : '',
      t.hinweis || '',
      t.status === 'abgesagt' ? 'Dieser Termin wurde abgesagt.' : '',
      'Dauer geschätzt. Änderungen wandern automatisch in diesen Kalender.',
    ]
      .filter(Boolean)
      .join('\n');

    zeilen.push(
      'BEGIN:VEVENT',
      `UID:${kennung}`,
      `DTSTAMP:${stempel(daten.stand || t.datum, '08:00')}Z`,
      `DTSTART;TZID=Europe/Berlin:${stempel(t.datum, t.uhrzeit)}`,
      `DTEND;TZID=Europe/Berlin:${stempel(t.datum, t.uhrzeit, dauer)}`,
      falten(`SUMMARY:${schuetzen((t.status === 'abgesagt' ? 'ABGESAGT: ' : '') + (t.titel || 'Vereinstermin'))}`),
      falten(`LOCATION:${schuetzen(t.platz || '')}`),
      falten(`DESCRIPTION:${schuetzen(beschreibung)}`),
      `STATUS:${t.status === 'abgesagt' ? 'CANCELLED' : 'CONFIRMED'}`,
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Erinnerung',
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT'
    );
    anzahl++;
  }

  zeilen.push('END:VCALENDAR');
  writeFileSync(join(zielOrdner, 'termine.ics'), zeilen.join('\r\n') + '\r\n', 'utf8');
  return anzahl;
}

// Direkter Aufruf: node kalender-erzeugen.mjs <ordner>
if (import.meta.url === `file://${process.argv[1]}`) {
  const ordner = process.argv[2] || join(PROJEKT, 'public');
  console.log(`${kalenderSchreiben(ordner)} Termine nach ${ordner}/termine.ics geschrieben.`);
}
