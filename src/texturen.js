// Canvas-Texturen: alles prozedural, keine Bilddateien nötig.
import * as THREE from 'three';

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Fassade: 8×8 Zellen à 3 m × 3,3 m. Rückgabe [Tagestextur, Nachtfenster] */
export function fensterTexturen(seed = 7) {
  const N = 8, CW = 64, CH = 70;
  const [c, g] = canvas(N * CW, N * CH);
  const [e, ge] = canvas(N * CW, N * CH);
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, c.width, c.height);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const X = x * CW, Y = y * CH;
    g.fillStyle = '#d9d4ca'; g.fillRect(X, Y + CH - 6, CW, 6);           // Geschossband
    g.fillStyle = '#3d5361'; g.fillRect(X + 9, Y + 16, CW - 18, CH - 30);  // Glas
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(X + 9, Y + 16, (CW - 18) * 0.35, CH - 30);
    g.fillStyle = '#c8c2b6'; g.fillRect(X + CW / 2 - 1, Y + 16, 2, CH - 30);
    const an = r();
    if (an < 0.42) {
      const warm = r() < 0.75;
      ge.fillStyle = warm ? `rgb(255,${190 + r() * 40 | 0},${110 + r() * 40 | 0})` : 'rgb(190,215,255)';
      ge.globalAlpha = 0.55 + r() * 0.45;
      ge.fillRect(X + 9, Y + 16, CW - 18, CH - 30);
      ge.globalAlpha = 1;
    }
  }
  const a = tex(c, { repeat: true }), b = tex(e, { repeat: true });
  a.repeat.set(1 / (3 * N), 1 / (3.3 * N)); b.repeat.copy(a.repeat);
  return [a, b];
}

/** Erdschichten für den Rand der Diorama-Scheibe */
export function erdTextur() {
  const [c, g] = canvas(64, 256);
  const lagen = [['#6f8f3e', 0, 10], ['#5b4532', 10, 40], ['#6d533b', 40, 92], ['#7e6448', 92, 150], ['#8c7457', 150, 205], ['#9a876c', 205, 256]];
  for (const [f, a, b] of lagen) { g.fillStyle = f; g.fillRect(0, a, 64, b - a); }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,220' : '30,20,10'},${Math.random() * 0.18})`;
    const y = 12 + Math.random() * 240; g.beginPath(); g.arc(Math.random() * 64, y, 1 + Math.random() * 3, 0, 7); g.fill();
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(40, 1);
  return t;
}

/** Rasen mit Mähstreifen und Linien. Spielfeld 105×68, Textur inkl. 4 m Auslauf */
export function rasenTextur() {
  const W = 1130, H = 760, s = W / 113;      // 1 m = 10 px
  const [c, g] = canvas(W, H);
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#4f9a3c' : '#5aa846'; g.fillRect(i * W / 14, 0, W / 14 + 1, H); }
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 2.4;
  const x0 = 4 * s, y0 = 4 * s, w = 105 * s, h = 68 * s;
  g.strokeRect(x0, y0, w, h);
  g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h); g.stroke();
  g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, 9.15 * s, 0, 7); g.stroke();
  for (const sx of [0, 1]) {
    const bx = sx ? x0 + w - 16.5 * s : x0, kx = sx ? x0 + w - 5.5 * s : x0;
    g.strokeRect(bx, y0 + h / 2 - 20.16 * s, 16.5 * s, 40.32 * s);
    g.strokeRect(kx, y0 + h / 2 - 9.16 * s, 5.5 * s, 18.32 * s);
    g.beginPath(); g.arc(sx ? x0 + w - 11 * s : x0 + 11 * s, y0 + h / 2, 9.15 * s, sx ? Math.PI * 0.7 : -Math.PI * 0.3, sx ? Math.PI * 1.3 : Math.PI * 0.3); g.stroke();
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, 3, 0, 7); g.fill();
  return tex(c);
}

/** Dartscheibe (Draufsicht) */
const ZAHLEN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export { ZAHLEN };
export function dartTextur() {
  const [c, g] = canvas(512, 512); const m = 256, R = 230;
  g.fillStyle = '#151515'; g.beginPath(); g.arc(m, m, 255, 0, 7); g.fill();
  const ringe = [[1, 0.953], [0.953, 0.63], [0.63, 0.582], [0.582, 0.094]];
  for (let i = 0; i < 20; i++) {
    const a0 = (i - 0.5) * Math.PI / 10 - Math.PI / 2, a1 = a0 + Math.PI / 10;
    ringe.forEach(([ro, ri], k) => {
      g.fillStyle = (k % 2 === 0) ? (i % 2 ? '#1f8a4c' : '#c62a2a') : (i % 2 ? '#f3e7c9' : '#141414');
      g.beginPath(); g.arc(m, m, R * ro, a0, a1); g.arc(m, m, R * ri, a1, a0, true); g.fill();
    });
    g.fillStyle = '#ddd'; g.font = 'bold 22px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const am = a0 + Math.PI / 20; g.fillText(ZAHLEN[i], m + Math.cos(am) * 243, m + Math.sin(am) * 243);
  }
  g.fillStyle = '#1f8a4c'; g.beginPath(); g.arc(m, m, R * 0.094, 0, 7); g.fill();
  g.fillStyle = '#c62a2a'; g.beginPath(); g.arc(m, m, R * 0.037, 0, 7); g.fill();
  return tex(c);
}

/** Weiche Lichtpfütze (Straßenlaternen, Scheinwerfer) */
export function lichtFleck() {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,190,120,.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c);
}
export function weichPunkt() {
  const [c, g] = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
export function schattenFleck() {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** Namensschild über einer Figur */
export function namensSchild(text, farbe = '#157e77') {
  const [c, g] = canvas(256, 96);
  g.font = '700 46px Inter, Arial'; const w = Math.min(240, g.measureText(text).width + 44);
  g.fillStyle = 'rgba(16,30,32,.82)'; rund(g, 128 - w / 2, 14, w, 60, 30); g.fill();
  g.fillStyle = farbe; g.beginPath(); g.arc(128 - w / 2 + 24, 44, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128 + 9, 46);
  g.fillStyle = 'rgba(16,30,32,.82)'; g.beginPath(); g.moveTo(118, 73); g.lineTo(138, 73); g.lineTo(128, 88); g.fill();
  return tex(c);
}
export function rund(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function bildLaden(src) {
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}
