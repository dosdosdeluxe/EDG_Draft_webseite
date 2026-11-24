// Zahlenkacheln im Kopfbereich der Startseite.
//
// Feste Werte stehen in verein.json unter "zahlen". Einträge mit dem Feld
// "berechnet" füllt die Seite selbst, damit sie nicht jedes Jahr von Hand
// nachgezogen werden müssen:
//
//   "jahreAktiv"  laufendes Jahr minus Gründungsjahr
//   "saison"      Saison aus termine.json
//
// Der Wert gilt ab dem letzten Build der Seite, wie das Jahr im Fuß.

export function heroZahlen(verein, saison) {
  const berechnet = {
    jahreAktiv: String(new Date().getFullYear() - verein.gegruendet),
    saison: String(saison),
  };

  return verein.zahlen.map(({ wert, label, berechnet: schluessel }) => {
    if (!schluessel) return { wert, label };
    if (!(schluessel in berechnet)) {
      // Lieber der Build bricht ab, als dass eine leere Kachel online geht.
      throw new Error(`verein.json: unbekanntes Feld berechnet="${schluessel}" bei "${label}"`);
    }
    return { wert: berechnet[schluessel], label };
  });
}
