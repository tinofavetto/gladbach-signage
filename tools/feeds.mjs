#!/usr/bin/env node
// Holt die RP-Schlagzeilen serverseitig (kein CORS) und schreibt data/feeds.json.
// Läuft per GitHub Action alle 30 Minuten; lokal: `node tools/feeds.mjs`.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FEEDS = [
  ['https://rp-online.de/nrw/staedte/moenchengladbach/feed.rss', 'Mönchengladbach'],
  ['https://rp-online.de/sport/fussball/borussia/feed.rss', 'Borussia'],
];
const ziel = fileURLToPath(new URL('../data/feeds.json', import.meta.url));

const ent = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const news = [];
for (const [url, quelle] of FEEDS) {
  try {
    const xml = await (await fetch(url, { headers: { 'user-agent': 'esyon-gladbach-signage/1.0' } })).text();
    for (const it of xml.match(/<item>[\s\S]*?<\/item>/g)?.slice(0, 8) || []) {
      const t = ent(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), i = t.indexOf(': ');
      const zeit = new Date(ent(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '')).toISOString();
      news.push({ dach: i > 0 && i < 60 ? t.slice(0, i) : '', titel: (i > 0 && i < 60 ? t.slice(i + 2) : t).trim(), zeit, quelle });
    }
  } catch (e) { console.error(quelle, e.message); }
}
news.sort((a, b) => b.zeit.localeCompare(a.zeit));
if (!news.length) { console.error('keine Nachrichten – Datei bleibt unverändert'); process.exit(0); }
const alt = existsSync(ziel) ? JSON.parse(readFileSync(ziel, 'utf8')) : null;
if (alt && JSON.stringify(alt.news) === JSON.stringify(news)) { console.log('unverändert'); process.exit(0); }
writeFileSync(ziel, JSON.stringify({ stand: new Date().toISOString(), news }, null, 1) + '\n');
console.log(`${news.length} Schlagzeilen → data/feeds.json`);
