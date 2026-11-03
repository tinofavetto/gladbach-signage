// Overlay für den Signage-Screen: Uhr, Wetter, Sonne, Borussia, Büro-Status, Nachrichtenticker, Pins.
import * as THREE from 'three';
import { TEAM, HUND } from './config.js';

const $ = (id) => document.getElementById(id);
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const ICON = {
  klar: '<circle cx="24" cy="24" r="9"/><g stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="${24 + Math.cos(a * Math.PI / 180) * 14}" y1="${24 + Math.sin(a * Math.PI / 180) * 14}" x2="${24 + Math.cos(a * Math.PI / 180) * 19}" y2="${24 + Math.sin(a * Math.PI / 180) * 19}"/>`).join('') + '</g>',
  mond: '<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z"/>',
  wolke: '<path d="M14 36h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13z"/>',
  wolkig: '<circle cx="17" cy="17" r="7"/><path d="M17 40h18a7 7 0 0 0 0-14 10 10 0 0 0-19 3 5.5 5.5 0 0 0 1 11z"/>',
  regen: '<path d="M14 30h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13z"/><g stroke-linecap="round"><line x1="17" y1="35" x2="15" y2="41"/><line x1="24" y1="35" x2="22" y2="41"/><line x1="31" y1="35" x2="29" y2="41"/></g>',
  schnee: '<path d="M14 30h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13z"/><g><circle cx="17" cy="38" r="1.6"/><circle cx="24" cy="41" r="1.6"/><circle cx="31" cy="38" r="1.6"/></g>',
  gewitter: '<path d="M14 28h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13z"/><path d="M25 30l-5 8h5l-3 7 8-10h-5l3-5z"/>',
  nebel: '<g stroke-linecap="round"><line x1="9" y1="18" x2="39" y2="18"/><line x1="6" y1="25" x2="36" y2="25"/><line x1="11" y1="32" x2="41" y2="32"/></g>',
};
const ICON_ART = { klar: 'klar', wolkig: 'wolkig', bedeckt: 'wolke', nebel: 'nebel', niesel: 'regen', regen: 'regen', starkregen: 'regen', schnee: 'schnee', gewitter: 'gewitter' };
export const icon = (art, nacht) => `<svg viewBox="0 0 48 48" class="ic">${art === 'klar' && nacht ? ICON.mond : ICON[ICON_ART[art] || 'wolkig']}</svg>`;

let letzteNews = '', letzteBvb = '', letztesWetter = '', avatare = false;
const v = new THREE.Vector3();

export function hud({ now, b, live, buero, env, kam, pins, shot }) {
  // Uhr
  $('zeit').textContent = `${String(b.h).padStart(2, '0')}:${String(b.mi).padStart(2, '0')}`;
  $('sek').textContent = String(b.sek).padStart(2, '0');
  $('datum').textContent = `${TAGE[b.wt]}, ${b.tag}. ${MON[b.monat - 1]}`;

  // Wetter
  const w = live.wetter;
  if (w) {
    const key = JSON.stringify([w.temp, w.code, w.wind, b.h, env.nacht > 0.5]);
    if (key !== letztesWetter) {
      letztesWetter = key;
      $('w-temp').textContent = `${Math.round(w.temp)}°`;
      $('w-text').textContent = w.text;
      $('w-icon').innerHTML = icon(w.art, env.nacht > 0.5);
      $('w-detail').innerHTML = `gefühlt ${Math.round(w.gefuehlt)}° <i></i> Wind ${Math.round(w.wind)} km/h ${himmelsrichtung(w.windRichtung)} <i></i> ${w.feuchte}&thinsp;%`;
      $('w-minmax').textContent = `${Math.round(w.minT)}° / ${Math.round(w.max)}°`;
      // nächste Stunden
      const ab = w.stunden.findIndex((s) => s.t.slice(0, 13) === `${b.iso}T${String(b.h).padStart(2, '0')}`);
      const st = ab >= 0 ? w.stunden.slice(ab + 1, ab + 13).filter((_, i) => i % 3 === 0).slice(0, 4) : [];
      $('w-stunden').innerHTML = st.map((s) => {
        const h = +s.t.slice(11, 13); const art = artVon(s.code);
        return `<div><span>${h} Uhr</span>${icon(art, h < 7 || h > 17)}<b>${Math.round(s.temp)}°</b>${s.pp >= 30 ? `<em>${s.pp}&thinsp;%</em>` : '<em>&nbsp;</em>'}</div>`;
      }).join('');
      $('w-alt').hidden = !w.alt;
    }
    // Sonnenbogen
    const auf = w.aufgang?.[0], unter = w.untergang?.[0];
    if (auf && unter) {
      const am = hmin(auf), um = hmin(unter), f = (b.min - am) / (um - am);
      $('s-auf').textContent = auf.slice(11, 16); $('s-unter').textContent = unter.slice(11, 16);
      const dauer = um - am; $('s-dauer').textContent = `${Math.floor(dauer / 60)} h ${Math.round(dauer % 60)} min Tageslicht`;
      const ff = Math.max(0, Math.min(1, f)), x = 10 + ff * 180, y = 58 - Math.sin(ff * Math.PI) * 46;
      $('s-punkt').setAttribute('cx', x); $('s-punkt').setAttribute('cy', y);
      $('s-punkt').classList.toggle('unter', f < 0 || f > 1);
      $('s-weg').setAttribute('stroke-dasharray', `${ff * 230} 400`);
    }
  }

  // Borussia
  const bv = live.bvb;
  if (bv?.letztes) {
    const key = JSON.stringify(bv);
    if (key !== letzteBvb) {
      letzteBvb = key;
      const l = bv.letztes;
      $('b-kopf').textContent = `${bv.liga} · ${l.spieltag}`;
      $('b-datum').textContent = datum(l.datum);
      $('b-heim').textContent = l.heim.kurz; $('b-gast').textContent = l.gast.kurz;
      $('b-tore').innerHTML = `${l.tore[0]}<span>:</span>${l.tore[1]}`;
      $('b-heim').classList.toggle('wir', l.heim.id === 87); $('b-gast').classList.toggle('wir', l.gast.id === 87);
      const erg = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' }[l.ergebnis];
      $('b-erg').textContent = erg; $('b-erg').dataset.e = l.ergebnis;
      $('b-form').innerHTML = bv.form.map((f) => `<i data-e="${f}">${f}</i>`).join('');
      $('b-platz').textContent = bv.platz ? `Platz ${bv.platz.platz} · ${bv.platz.punkte} Pkt · ${bv.platz.tore}` : '';
      const n = bv.naechstes;
      $('b-next').innerHTML = n ? `<span>Nächstes Spiel</span> ${datum(n.datum, true)} · ${n.heim.kurz} – ${n.gast.kurz}${n.heimspiel ? ' <em>Heimspiel</em>' : ''}` : '';
    }
  }
  if (env.spielInfo) {
    const a = env.spielInfo.anstoss;
    $('b-live').hidden = false;
    $('b-live').textContent = a < 0 ? `Heimspiel heute – Anpfiff in ${Math.ceil(-a)} min` : a < 110 ? `Läuft gerade im Borussia-Park` : 'Abpfiff – die Fans ziehen ab';
  } else $('b-live').hidden = true;

  // Büro
  if (!avatare) {
    avatare = true;
    $('team').innerHTML = [...TEAM.map((p) => ({ n: p.name, c: p.shirt })), { n: HUND.name, c: HUND.fell, hund: true }]
      .map((p) => `<li data-n="${p.n}"><span class="av" style="--c:${p.c}">${p.hund ? pfote : p.n[0]}</span>${p.n}</li>`).join('');
  }
  $('buero-status').textContent = buero.text;
  for (const li of $('team').children) {
    const n = li.dataset.n;
    const da = buero.wer.includes(n) || (n === HUND.name && buero.wer.includes('Tino'));
    li.classList.toggle('da', da);
  }
  const d = buero.darts;
  $('darts').hidden = !d;
  if (d) {
    $('d-leg').textContent = `Leg ${d.leg}`;
    $('d-tab').innerHTML = d.spieler.map((s) => `<tr><td>${s.name}</td><td>${'●'.repeat(s.legs)}</td><td>${s.rest}</td></tr>`).join('');
  }

  // Ticker
  const news = live.news || [];
  const key = news.map((n) => n.titel).join('|');
  if (key && key !== letzteNews) {
    letzteNews = key;
    const html = news.slice(0, 12).map((n) => `<span class="t-item"><b>${esc(n.quelle)}</b>${n.dach ? `<em>${esc(n.dach)}</em>` : ''}${esc(n.titel)}</span>`).join('');
    $('ticker-band').innerHTML = html + html;
    const band = $('ticker-band');
    requestAnimationFrame(() => { band.style.animationDuration = `${Math.max(60, band.scrollWidth / 2 / 90)}s`; });
  }
  $('ticker').hidden = !news.length;

  // Pins über Büro und Stadion (nur in der Totalen)
  for (const [k, p] of Object.entries(pins)) {
    const el = $('pin-' + k);
    v.copy(p).project(kam);
    const sicht = shot === 'weit' || shot === 'umgebung';
    el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
    el.classList.toggle('an', sicht && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95);
  }
  document.body.classList.toggle('nacht', env.nacht > 0.55);
}

const pfote = '<svg viewBox="0 0 24 24"><circle cx="6" cy="9" r="2.3"/><circle cx="10" cy="5" r="2.3"/><circle cx="14.5" cy="5" r="2.3"/><circle cx="18.5" cy="9" r="2.3"/><path d="M12 11c3 0 6 4 6 6.5 0 2-2 2.5-3.2 2-1-.4-1.8-.6-2.8-.6s-1.8.2-2.8.6C8 20 6 19.5 6 17.5 6 15 9 11 12 11z"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hmin = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
const datum = (iso, mitZeit) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', ...(mitZeit ? { hour: '2-digit', minute: '2-digit' } : {}) }).replace(',', '').replace(/\.$/, '') + (mitZeit ? ' Uhr' : '');
const himmelsrichtung = (g) => ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(((g ?? 0) % 360) / 45) % 8];
function artVon(code) {
  if (code <= 1) return 'klar'; if (code === 2) return 'wolkig'; if (code === 3) return 'bedeckt';
  if (code <= 48) return 'nebel'; if (code <= 67 || (code >= 80 && code <= 82)) return 'regen';
  if (code <= 77 || code === 85 || code === 86) return 'schnee'; return 'gewitter';
}
