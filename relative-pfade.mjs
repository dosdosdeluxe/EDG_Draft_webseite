// Stellt eine gebaute Seite auf relative Adressen um.
//
// Ein Browser liest bei file:// ein führendes "/" als Wurzel der Festplatte,
// und auf einem Server im Unterordner zeigt es ins Leere. Mit relativen
// Adressen läuft dieselbe Seite überall: per Doppelklick, in einem Unterordner
// oder auf einer Subdomain. Ordner-Adressen werden ausgeschrieben
// ("termine/" wird "termine/index.html"), weil file:// kein automatisches
// Nachladen der index.html kennt.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

function alleDateien(ordner) {
  const raus = [];
  for (const e of readdirSync(ordner)) {
    const voll = join(ordner, e);
    if (statSync(voll).isDirectory()) raus.push(...alleDateien(voll));
    else raus.push(voll);
  }
  return raus;
}

/** Schreibt alle HTML- und CSS-Dateien unter `ziel` um, gibt die Zahl der geänderten Adressen zurück. */
export function relativeAdressen(ziel) {
  let umgeschrieben = 0;
  for (const datei of alleDateien(ziel)) {
    const istHtml = datei.endsWith('.html');
    const istCss = datei.endsWith('.css');
    if (!istHtml && !istCss) continue;
    let text = readFileSync(datei, 'utf8');

    // Wie tief liegt diese Datei unter der Wurzel?
    const nachOben = relative(dirname(datei), ziel).replace(/\\/g, '/');
    const praefix = nachOben === '' ? '' : nachOben + '/';

    if (istHtml) {
      text = text.replace(/(href|src)="\/([^"]*)"/g, (_, attribut, rest) => {
        let adresse = rest;
        if (adresse === '' || adresse.endsWith('/')) adresse += 'index.html';
        umgeschrieben++;
        return `${attribut}="${praefix}${adresse}"`;
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
  return umgeschrieben;
}
