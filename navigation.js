// Zentrale Navigation. Wer hier einen Eintrag ändert, ändert ihn
// überall: Kopfzeile, Tab-Leiste und Fußzeile lesen aus dieser Datei.
//
//   label   Beschriftung, wie sie der Besucher sieht
//   href    Adresse der Seite (mit Schrägstrich am Ende)
//   icon    Zeichen für die Tab-Leiste auf dem Smartphone
//   imTab   true = erscheint in der Tab-Leiste unten (maximal 5!)

export const nav = [
  { label: 'Start',       href: '/',              icon: '\u{1F3E0}', imTab: true  },
  { label: 'Spielbetrieb', href: '/spielbetrieb/', icon: '⛳',    imTab: false },
  { label: 'Termine',     href: '/termine/',      icon: '\u{1F4C5}', imTab: true  },
  { label: 'Ergebnisse',  href: '/ergebnisse/',   icon: '\u{1F3C6}', imTab: true  },
  { label: 'Galerie',     href: '/galerie/',      icon: '\u{1F4F7}', imTab: true  },
  { label: 'Club',        href: '/club/',         icon: '\u{1F985}', imTab: true  },
];

// Layout-Vorschau der noch nicht gebauten Phasen.
// Steht nur in der Fußzeile, damit die öffentliche Seite sauber bleibt.
// Vor dem echten Start diesen Eintrag entfernen.
export const vorschau = { label: 'Vorschau kommender Funktionen', href: '/vorschau/' };

// Rechtlich vorgeschriebene Seiten. Stehen nur in der Fußzeile.
export const rechtliches = [
  { label: 'Impressum',   href: '/impressum/'   },
  { label: 'Datenschutz', href: '/datenschutz/' },
];
