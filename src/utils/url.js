// Erzeugt interne Adressen, die auch dann stimmen, wenn die Seite
// nicht im Wurzelverzeichnis liegt.
//
// Auf der echten Domain liegt sie unter /  ->  /termine/
// Auf GitHub Pages unter /egd-website/    ->  /egd-website/termine/
//
// Den Unterordner setzt der Build über die Umgebungsvariable BASE_PATH
// (siehe astro.config.mjs). Im Code immer pfad('/termine/') schreiben,
// niemals '/termine/' direkt.

export function pfad(ziel = '/') {
  // Sprungmarken und externe Adressen bleiben unverändert
  if (ziel.startsWith('#') || /^[a-z]+:/i.test(ziel)) return ziel;

  const basis = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const rest = ziel.replace(/^\/+/, '');
  return rest ? `${basis}/${rest}` : `${basis}/`;
}

// Vergleiche müssen den abschließenden Schrägstrich ignorieren:
// Astro liefert für die Startseite mal '/egd-website', mal '/egd-website/'.
function normiert(adresse) {
  const ohne = String(adresse).split('#')[0].replace(/\/+$/, '');
  return ohne === '' ? '/' : ohne;
}

/**
 * Liegt der Besucher gerade auf dieser Seite?
 * Für die Startseite muss exakt verglichen werden, sonst wäre sie
 * bei jeder Unterseite mitmarkiert.
 */
export function istAktiv(aktuellerPfad, ziel) {
  const hier = normiert(aktuellerPfad);
  const dorthin = normiert(pfad(ziel));
  const wurzel = normiert(pfad('/'));

  return dorthin === wurzel ? hier === dorthin : hier.startsWith(dorthin);
}
