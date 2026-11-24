// Datumsformatierung für die Anzeige.
// Die Eingabe ist immer JJJJ-MM-TT, wie in den JSON-Dateien hinterlegt.

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function zerlegen(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  return { datum: new Date(Date.UTC(j, m - 1, t)), jahr: j, monat: m, tag: t };
}

/** "Samstag, 11. Oktober 2026" — ausgeschrieben, gut lesbar */
export function lang(iso) {
  const { datum, jahr, monat, tag } = zerlegen(iso);
  return `${TAGE[datum.getUTCDay()]}, ${tag}. ${MONATE[monat - 1]} ${jahr}`;
}

/** "11.10." — für Tabellen */
export function kurz(iso) {
  const { monat, tag } = zerlegen(iso);
  return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.`;
}

/** Sortierung: nächster Termin zuerst */
export function nachDatum(a, b) {
  return a.datum.localeCompare(b.datum);
}
