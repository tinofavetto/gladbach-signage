// Alles, was man ohne Code-Verständnis anpassen möchte, steht hier.

export const ORT = {
  name: 'Mönchengladbach · Nordpark',
  lat: 51.1738,
  lon: 6.3860,
  zeitzone: 'Europe/Berlin',
};

// Figuren. Ankunft/Feierabend sind Szenenzeiten, keine echten Arbeitszeiten
// (die Seite ist öffentlich). Farben frei wählbar; frisur: 'glatze' | 'kurz' | 'zopf' | 'lang'
export const TEAM = [
  { id: 'tino', name: 'Tino', haut: '#e0b394', haar: '#3a2a20', frisur: 'glatze', bart: '#3a2a20', brille: true,
    shirt: '#1b3336', hose: '#2b2f36', schuhe: '#f2f2f2', kommt: '08:00', geht: '17:15', mitAuto: true },
  { id: 'ben', name: 'Ben', haut: '#edc4a4', haar: '#6b4a2e', frisur: 'kurz', bart: null, brille: false,
    shirt: '#42b8b4', hose: '#3a4a63', schuhe: '#1d1d1f', kommt: '08:15', geht: '17:00' },
  { id: 'steffi', name: 'Steffi', haut: '#f1cbb0', haar: '#a5642f', frisur: 'zopf', bart: null, brille: false,
    shirt: '#e8604c', hose: '#23262c', schuhe: '#efcf41', kommt: '08:30', geht: '16:45' },
];

export const HUND = { name: 'Hilde', fell: '#5b3a26', fellDunkel: '#3d2618', halsband: '#157e77' };

export const AUTO = { farbe: '#b0121b', name: 'Model Y' };

// Tagesablauf (werktags, Ortszeit)
export const ABLAUF = {
  darts: ['12:00', '12:40'],
  gassi: ['12:40', '13:20'],
  kaffee: ['10:00', '15:15'],      // kurze Kaffeerunden
};

// Datenquellen (alle ohne API-Key, CORS-fähig oder über Fallback)
export const QUELLEN = {
  wetter: (lat, lon) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,is_day,relative_humidity_2m' +
    '&hourly=temperature_2m,weather_code,precipitation_probability&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min' +
    '&timezone=Europe%2FBerlin&forecast_days=2',
  teamId: 87,            // Borussia Mönchengladbach bei OpenLigaDB
  ligen: ['bl1', 'bl2'],
  newsFeeds: [
    'https://rp-online.de/nrw/staedte/moenchengladbach/feed.rss',
    'https://rp-online.de/sport/fussball/borussia/feed.rss',
  ],
  // Fallbacks, falls der Browser den Feed wegen CORS nicht direkt lesen darf
  proxies: [
    (u) => u,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  ],
};
