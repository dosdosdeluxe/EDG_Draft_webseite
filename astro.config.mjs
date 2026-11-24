import { defineConfig } from 'astro/config';

export default defineConfig({
  // Später auf die echte Domain ändern, sobald die Seite live geht.
  // Grundadresse für absolute Angaben (Vorschaubild, Canonical, Sitemap).
  // Die Entwurfsfassung auf GitHub Pages setzt SITE_URL auf ihre eigene
  // Adresse, damit das Vorschaubild beim Teilen auch dort geladen wird.
  site: process.env.SITE_URL || 'https://eaglegolfersdribbdebach.de',

  // Unterordner, in dem die Seite liegt.
  // Leer (also '/') für die echte Domain und für Alfahosting.
  // Auf GitHub Pages liegt sie unter /<Repository-Name>/ — den Wert
  // setzt der Pages-Workflow über die Umgebungsvariable BASE_PATH.
  base: process.env.BASE_PATH || '/',

  // Rein statische Ausgabe: Der Build erzeugt fertige HTML-Dateien.
  // Auf dem Webserver laeuft kein Node.js - genau deshalb passt das zu Alfahosting.
  output: 'static',

  // 'directory' erzeugt /termine/index.html, die Adresse lautet dann /termine/.
  // Das funktioniert auf Apache ohne zusaetzliche Konfiguration.
  build: {
    format: 'directory',
    // Nicht '_astro': GitHub Pages schickt im Branch-Modus alles durch
    // Jekyll, und Jekyll ueberspringt Ordner mit fuehrendem Unterstrich.
    // Die Seite kaeme dann ohne Stylesheet an.
    assets: 'assets',
  },

  compressHTML: true,
});
