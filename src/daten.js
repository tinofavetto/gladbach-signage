// Live-Daten: Wetter (Open-Meteo), Borussia (OpenLigaDB), Nachrichten (RP Online RSS).
// Jede Quelle merkt sich ihren letzten guten Stand, damit ein Netzaussetzer
// auf dem Signage-Screen nie zu leeren Kacheln führt.
import { ORT, QUELLEN } from './config.js';
import { PARAM, jetzt } from './zeit.js';

const merke = (k, v) => { try { localStorage.setItem('gs:' + k, JSON.stringify({ t: Date.now(), v })); } catch {} };
const lies = (k) => { try { return JSON.parse(localStorage.getItem('gs:' + k))?.v ?? null; } catch { return null; } };

async function holJSON(url, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function holText(url, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.text(); }
  finally { clearTimeout(t); }
}

// ---------------------------------------------------------------- Wetter
const WMO = {
  0: ['Klar', 'klar'], 1: ['Überwiegend klar', 'klar'], 2: ['Teils bewölkt', 'wolkig'], 3: ['Bedeckt', 'bedeckt'],
  45: ['Nebel', 'nebel'], 48: ['Reifnebel', 'nebel'],
  51: ['Leichter Niesel', 'niesel'], 53: ['Nieselregen', 'niesel'], 55: ['Starker Niesel', 'regen'],
  56: ['Gefrierender Niesel', 'regen'], 57: ['Gefrierender Niesel', 'regen'],
  61: ['Leichter Regen', 'regen'], 63: ['Regen', 'regen'], 65: ['Starker Regen', 'starkregen'],
  66: ['Eisregen', 'regen'], 67: ['Starker Eisregen', 'starkregen'],
  71: ['Leichter Schneefall', 'schnee'], 73: ['Schneefall', 'schnee'], 75: ['Starker Schneefall', 'schnee'], 77: ['Schneegriesel', 'schnee'],
  80: ['Regenschauer', 'regen'], 81: ['Kräftige Schauer', 'starkregen'], 82: ['Heftige Schauer', 'starkregen'],
  85: ['Schneeschauer', 'schnee'], 86: ['Starke Schneeschauer', 'schnee'],
  95: ['Gewitter', 'gewitter'], 96: ['Gewitter mit Hagel', 'gewitter'], 99: ['Schweres Gewitter', 'gewitter'],
};
export const wetterText = (code) => (WMO[code] || ['–', 'wolkig'])[0];

const TEST_WETTER = {
  klar: [0, 5], wolkig: [2, 50], bedeckt: [3, 95], nebel: [45, 100], regen: [63, 90],
  starkregen: [65, 100], schnee: [73, 95], gewitter: [95, 100], niesel: [53, 90],
};

export async function wetter() {
  let w;
  try {
    const d = await holJSON(QUELLEN.wetter(ORT.lat, ORT.lon));
    const c = d.current;
    w = {
      temp: c.temperature_2m, gefuehlt: c.apparent_temperature, code: c.weather_code,
      wind: c.wind_speed_10m, boeen: c.wind_gusts_10m, windRichtung: c.wind_direction_10m,
      wolken: c.cloud_cover, niederschlag: c.precipitation, feuchte: c.relative_humidity_2m,
      aufgang: d.daily.sunrise, untergang: d.daily.sunset,
      max: d.daily.temperature_2m_max[0], minT: d.daily.temperature_2m_min[0],
      stunden: d.hourly.time.map((t, i) => ({ t, temp: d.hourly.temperature_2m[i], code: d.hourly.weather_code[i], pp: d.hourly.precipitation_probability[i] })),
      stand: new Date().toISOString(),
    };
    merke('wetter', w);
  } catch (err) {
    w = lies('wetter');
    if (!w) throw err;
    w.alt = true;
  }
  const test = PARAM.get('wetter');
  if (test && TEST_WETTER[test]) { w = { ...w, code: TEST_WETTER[test][0], wolken: TEST_WETTER[test][1] }; if (test === 'gewitter' || test === 'starkregen') w.wind = 38; }
  w.art = (WMO[w.code] || ['', 'wolkig'])[1];
  w.text = wetterText(w.code);
  return w;
}

// ---------------------------------------------------------------- Borussia
const saison = (d) => (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);

export async function borussia() {
  const id = QUELLEN.teamId;
  const s = saison(jetzt());
  try {
    let spiele = [], liga = null;
    for (const l of QUELLEN.ligen) {
      const d = await holJSON(`https://api.openligadb.de/getmatchdata/${l}/${s}`, 20000);
      spiele = d.filter((m) => m.team1.teamId === id || m.team2.teamId === id);
      if (spiele.length) { liga = l; break; }
    }
    if (!spiele.length) throw new Error('kein Spielplan');
    const ende = (m) => m.matchResults.find((r) => r.resultTypeID === 2) || m.matchResults.at(-1);
    const fertig = spiele.filter((m) => m.matchIsFinished && m.matchResults.length);
    const offen = spiele.filter((m) => !m.matchIsFinished).sort((a, b) => a.matchDateTimeUTC.localeCompare(b.matchDateTimeUTC));
    const kurz = (t) => ({ name: t.teamName, kurz: t.shortName || t.teamName, id: t.teamId });
    const form = (m) => {
      const r = ende(m); const heim = m.team1.teamId === id;
      const wir = heim ? r.pointsTeam1 : r.pointsTeam2, die = heim ? r.pointsTeam2 : r.pointsTeam1;
      return wir > die ? 'S' : wir < die ? 'N' : 'U';
    };
    const letztes = fertig.at(-1);
    const out = {
      liga: liga === 'bl1' ? 'Bundesliga' : '2. Bundesliga',
      letztes: letztes && {
        heim: kurz(letztes.team1), gast: kurz(letztes.team2),
        tore: [ende(letztes).pointsTeam1, ende(letztes).pointsTeam2],
        halbzeit: (letztes.matchResults.find((r) => r.resultTypeID === 1) || null),
        spieltag: letztes.group.groupName, datum: letztes.matchDateTimeUTC,
        torschuetzen: (letztes.goals || []).map((g) => ({ min: g.matchMinute, name: g.goalGetterName, stand: `${g.scoreTeam1}:${g.scoreTeam2}` })),
        ergebnis: form(letztes),
      },
      naechstes: offen[0] && {
        heim: kurz(offen[0].team1), gast: kurz(offen[0].team2), datum: offen[0].matchDateTimeUTC,
        spieltag: offen[0].group.groupName, heimspiel: offen[0].team1.teamId === id,
      },
      heimspiele: offen.filter((m) => m.team1.teamId === id).map((m) => m.matchDateTimeUTC),
      form: fertig.slice(-5).map(form),
      platz: null,
    };
    try {
      const tab = await holJSON(`https://api.openligadb.de/getbltable/${liga}/${s}`);
      const i = tab.findIndex((t) => t.teamInfoId === id);
      if (i >= 0) out.platz = { platz: i + 1, punkte: tab[i].points, tore: `${tab[i].goals}:${tab[i].opponentGoals}` };
    } catch {}
    merke('borussia', out);
    return out;
  } catch (err) {
    const alt = lies('borussia');
    if (!alt) throw err;
    return alt;
  }
}

// ---------------------------------------------------------------- Nachrichten
function teile(t, zeit, quelle) {
  t = (t || '').trim(); const i = t.indexOf(': ');
  return { dach: i > 0 && i < 60 ? t.slice(0, i) : '', titel: (i > 0 && i < 60 ? t.slice(i + 2) : t).trim(), zeit, quelle };
}
function parseRSS(xml, quelle) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].map((it) => {
    const t = it.querySelector('title')?.textContent?.trim() || '';
    const i = t.indexOf(': ');
    return {
      dach: i > 0 && i < 60 ? t.slice(0, i) : '',
      titel: (i > 0 && i < 60 ? t.slice(i + 2) : t).trim(),
      zeit: it.querySelector('pubDate')?.textContent || '',
      quelle,
    };
  }).filter((n) => n.titel);
}

export async function nachrichten() {
  // 1) vom GitHub-Workflow vorbereitete Datei (kein CORS-Problem)
  try {
    const d = await holJSON('data/feeds.json?' + Date.now(), 8000);
    if (d?.news?.length && Date.now() - new Date(d.stand).getTime() < 6 * 3600e3) { merke('news', d.news); return d.news; }
  } catch {}
  // 2) rss2json (CORS-fähig), danach RSS direkt bzw. über öffentliche Proxys
  const alle = [];
  for (const [i, url] of QUELLEN.newsFeeds.entries()) {
    const quelle = i === 0 ? 'Mönchengladbach' : 'Borussia';
    try {
      const d = await holJSON(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`, 10000);
      if (d.status === 'ok' && d.items?.length) {
        alle.push(...d.items.slice(0, 8).map((it) => teile(it.title, it.pubDate.replace(' ', 'T') + 'Z', quelle)));
        continue;
      }
    } catch {}
    for (const p of QUELLEN.proxies) {
      try {
        const x = await holText(p(url), 9000);
        if (!x.includes('<item')) throw new Error('kein RSS');
        alle.push(...parseRSS(x, i === 0 ? 'Mönchengladbach' : 'Borussia').slice(0, 8));
        break;
      } catch {}
    }
  }
  if (alle.length) {
    alle.sort((a, b) => new Date(b.zeit) - new Date(a.zeit));
    merke('news', alle);
    return alle;
  }
  const alt = lies('news');
  if (alt) return alt;
  throw new Error('Nachrichten nicht erreichbar');
}
