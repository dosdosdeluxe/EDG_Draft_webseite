// Schreibt nach jedem Build die Dateien, die Suchmaschinen lesen.
//
//   Echte Fassung    ->  dist/sitemap.xml
//                        (die robots.txt aus public/ verweist darauf)
//   Entwurfsfassung  ->  dist/robots.txt sperrt alles, keine sitemap.xml
//
// Entwurfsfassung heißt: NOINDEX=1 ist gesetzt. Dieselbe Variable steuert
// das noindex-Metatag in src/layouts/Base.astro. Die Fassung entscheidet
// sich also an genau einer Stelle, egal ob der Build von "npm run build",
// von fassungen-bauen.mjs oder von GitHub Actions kommt.
//
// Eingebunden über astro.config.mjs, läuft deshalb bei jedem "astro build".
// Adresse und Unterordner kommen aus der Astro-Konfiguration (SITE_URL und
// BASE_PATH), hier steht nichts doppelt.

import { readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROBOTS_ENTWURF = [
  '# Entwurfsfassung mit Platzhalterdaten, gehört nicht in die Suche.',
  'User-agent: *',
  'Disallow: /',
  '',
].join('\n');

// Alle Ordner mit einer index.html, als Adresse: "/", "/termine/", ...
function seitenSammeln(ordner, pfadTeil = '') {
  const seiten = [];
  for (const eintrag of readdirSync(ordner)) {
    const voll = join(ordner, eintrag);
    if (statSync(voll).isDirectory()) seiten.push(...seitenSammeln(voll, `${pfadTeil}/${eintrag}`));
    else if (eintrag === 'index.html') seiten.push(`${pfadTeil}/`);
  }
  return seiten;
}

/**
 * Schreibt <ordner>/sitemap.xml und gibt die Zahl der Seiten darin zurück.
 * Die Vorschau des Mitgliederbereichs bleibt draußen, sie ist nur ein Entwurf.
 */
export function sitemapSchreiben(ordner, grundadresse, basis = '/') {
  const heute = new Date().toISOString().slice(0, 10);
  const seiten = seitenSammeln(ordner)
    .filter((s) => !s.startsWith('/vorschau'))
    .sort();

  const eintraege = seiten
    .map((s) => {
      const adresse = new URL(basis.replace(/\/+$/, '') + s, grundadresse).href;
      const wichtig = s === '/' ? '1.0' : '0.7';
      return `  <url>\n    <loc>${adresse}</loc>\n    <lastmod>${heute}</lastmod>\n    <priority>${wichtig}</priority>\n  </url>`;
    })
    .join('\n');

  writeFileSync(
    join(ordner, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`
  );
  return seiten.length;
}

/** Ersetzt <ordner>/robots.txt durch eine sperrende Fassung, entfernt die Sitemap. */
export function entwurfSperren(ordner) {
  writeFileSync(join(ordner, 'robots.txt'), ROBOTS_ENTWURF);
  rmSync(join(ordner, 'sitemap.xml'), { force: true });
}

/** Astro-Integration, siehe astro.config.mjs */
export function suchmaschinenHinweise() {
  let site;
  let base;

  return {
    name: 'sitemap-und-robots',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
        base = config.base;
      },
      'astro:build:done': ({ dir, logger }) => {
        const ordner = fileURLToPath(dir);
        if (process.env.NOINDEX === '1') {
          entwurfSperren(ordner);
          logger.info('Entwurfsfassung: robots.txt sperrt alles, keine sitemap.xml');
        } else {
          const anzahl = sitemapSchreiben(ordner, site, base);
          logger.info(`sitemap.xml mit ${anzahl} Seiten geschrieben (${site})`);
        }
      },
    },
  };
}
