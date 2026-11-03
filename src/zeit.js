// Uhr, Testparameter und Himmelsmechanik (Sonne/Mond nach SunCalc, V. Agafonkin, BSD).
import { ORT } from './config.js';

const P = new URLSearchParams(location.search);
const speed = Number(P.get('speed') || 1);
const start = Date.now();
let offset = 0;
export const PARAM = P;
export function jetzt() {
  return new Date(start + offset + (Date.now() - start) * speed);
}

const fmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: ORT.zeitzone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23',
});
const WT = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 };

/** Ortszeit Gladbach, unabhängig von der Zeitzone des Abspielgeräts */
export function berlin(d) {
  const o = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  const h = +o.hour, mi = +o.minute, s = +o.second;
  return {
    jahr: +o.year, monat: +o.month, tag: +o.day, wt: WT[o.weekday.replace('.', '')] ?? 1,
    h, mi, sek: s, min: h * 60 + mi + s / 60 + (d.getMilliseconds() / 60000),
    iso: `${o.year}-${o.month}-${o.day}`,
  };
}
export const istWerktag = (b) => b.wt >= 1 && b.wt <= 5;
export const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// ---- Sonne & Mond -------------------------------------------------------
const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
const toDays = (d) => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const az = (H, phi, d) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
const alt = (H, phi, d) => Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
const solarM = (d) => rad * (357.5291 + 0.98560028 * d);
const eclLon = (M) => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;

function sunCoords(d) { const L = eclLon(solarM(d)); return { dec: dec(L, 0), ra: ra(L, 0) }; }

/** azimuth: 0 = Süden, positiv nach Westen (SunCalc-Konvention) */
export function sonne(date, lat = ORT.lat, lon = ORT.lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date), c = sunCoords(d), H = sidereal(d, lw) - c.ra;
  return { azimuth: az(H, phi, c.dec), altitude: alt(H, phi, c.dec) };
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F), dt = 385001 - 20905 * Math.cos(M);
  return { ra: ra(l, b), dec: dec(l, b), dist: dt };
}
export function mond(date, lat = ORT.lat, lon = ORT.lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
  const s = sunCoords(d), sdist = 149598000;
  const phiA = Math.acos(Math.sin(s.dec) * Math.sin(c.dec) + Math.cos(s.dec) * Math.cos(c.dec) * Math.cos(s.ra - c.ra));
  const inc = Math.atan2(sdist * Math.sin(phiA), c.dist - sdist * Math.cos(phiA));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - c.ra), Math.sin(s.dec) * Math.cos(c.dec) - Math.cos(s.dec) * Math.sin(c.dec) * Math.cos(s.ra - c.ra));
  return {
    azimuth: az(H, phi, c.dec), altitude: alt(H, phi, c.dec),
    fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
  };
}

/** deterministischer Zufall (gleicher Tag → gleiche Darts-Würfe) */
export function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Testparameter erst hier auswerten (fmt muss initialisiert sein)
if (P.get('t')) {
  // ?t=12:05  oder  ?t=2026-11-21T14:30  → Szene springt dorthin und läuft ab da weiter
  const v = P.get('t');
  let ziel;
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const b = berlin(new Date());
    const [h, m] = v.split(':').map(Number);
    ziel = Date.now() + ((h * 60 + m) - b.min) * 60000;
  } else ziel = new Date(v).getTime();
  offset = ziel - Date.now();
}

