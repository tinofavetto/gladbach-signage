// Gladbach-Signage: isometrische Live-Szene ESYON-Büro + Borussia-Park.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

import { OSM } from '../data/osm-scene.js';
import { baueWelt } from './welt.js';
import { baueStadion } from './stadion.js';
import { baueBuero } from './buero.js';
import { baueHimmel } from './himmel.js';
import { baueLeben } from './leben.js';
import { baueTafel } from './werbetafel.js';
import { jetzt, berlin, istWerktag, PARAM } from './zeit.js';
import { wetter, borussia, nachrichten } from './daten.js';
import { hud } from './hud.js';

const Q = PARAM.get('q') || 'hoch';
const DEBUG = PARAM.has('debug');

// ------------------------------------------------------------ Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q === 'low' ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('szene').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', () => setTimeout(() => location.reload(), 3000));

renderer.info.autoReset = false;
const scene = new THREE.Scene();
const kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);

// ------------------------------------------------------------ Welt
const ELEV = 33 * Math.PI / 180, AZ0 = Math.PI / 4;
const kameraRichtung = new THREE.Vector3(Math.sin(AZ0), 0, Math.cos(AZ0));
const welt = baueWelt(scene, OSM, Q);
const stadion = baueStadion(scene, OSM); welt.stadion = stadion;
const buero = baueBuero(scene, OSM, welt, kameraRichtung);
const himmel = baueHimmel(scene, welt.R, Q);
const leben = baueLeben(scene, welt, stadion, Q);
const tafelPos = buero.zentrumGanz.clone().add(new THREE.Vector3(-kameraRichtung.z, 0, kameraRichtung.x).multiplyScalar(-34)).add(kameraRichtung.clone().multiplyScalar(26)).setY(0);
const tafel = baueTafel(scene, tafelPos, kameraRichtung);

// Schatten-Fleck unter der schwebenden Scheibe
// (Hintergrund ist ein Himmel; die Scheibe bekommt einen weichen Rand-Glanz)

// ------------------------------------------------------------ Post-Processing
let composer = null, bloom = null, tiltH = null, tiltV = null;
if (Q !== 'low') {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, kam));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.55, 0.86);
  composer.addPass(bloom);
  tiltH = new ShaderPass(HorizontalTiltShiftShader); tiltV = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(tiltH); composer.addPass(tiltV);
  composer.addPass(new ShaderPass(KornShader()));
  composer.addPass(new OutputPass());
}
function KornShader() {
  return {
    uniforms: { tDiffuse: { value: null }, uZeit: { value: 0 }, uVig: { value: 0.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uZeit; uniform float uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uZeit) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVig * 2.2;
        c.rgb *= v; c.rgb += (h(vUv * 1000.0) - 0.5) * 0.018; gl_FragColor = c; }`,
  };
}
function groesse() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  if (composer) {
    composer.setSize(w, h);
    tiltH.uniforms.h.value = 1.6 / w; tiltV.uniforms.v.value = 1.6 / h;
    tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
  }
}
addEventListener('resize', groesse); groesse();

// ------------------------------------------------------------ Kameraregie
const SHOTS = {
  weit: () => ({ ziel: new THREE.Vector3(0, -12, 0), span: welt.R * 0.7, az: AZ0, el: ELEV }),
  stadion: () => ({ ziel: stadion.zentrum.clone().setY(8), span: 92, az: AZ0 - 0.25, el: 0.62 }),
  buero: () => ({ ziel: buero.zentrum.clone(), span: 15, az: AZ0 + 0.15, el: 0.72 }),
  darts: () => {
    // Kamera steht auf der Raumseite der Dartscheibe, leicht seitlich, damit Scheibe, Linie und Tafel im Bild sind
    const n = buero.dartsNormal; let az = Math.atan2(n.x, n.z);
    const d = ((az - AZ0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    az = AZ0 + THREE.MathUtils.clamp(d, -1.1, 1.1);
    return { ziel: buero.dartsZiel.clone(), span: 6.5, az, el: 0.5 };
  },
  gassi: () => {
    const p = buero.personen; const z = new THREE.Vector3();
    p.forEach((v) => z.add(v)); if (p.length) z.divideScalar(p.length); else z.copy(stadion.zentrum);
    return { ziel: z.setY(1), span: 12, az: AZ0 - 0.1, el: 0.8 };
  },
  tafel: () => ({ ziel: tafelPos.clone().setY(8), span: 13, az: AZ0, el: 0.4 }),
  umgebung: () => ({ ziel: new THREE.Vector3(80, 0, -40), span: 150, az: AZ0 + 0.6, el: 0.55 }),
};
const regie = { shot: 'weit', seit: 0, von: null, nach: null, uebergang: 1, liste: [], li: 0 };
function drehbuch(env) {
  if (PARAM.get('shot')) return [[PARAM.get('shot'), 999]];
  if (env.dartsLaeuft) return [['weit', 14], ['darts', 26], ['buero', 16], ['tafel', 9]];
  if (env.gassiLaeuft) return [['weit', 14], ['gassi', 30], ['umgebung', 12]];
  if (env.spiel) return [['weit', 18], ['stadion', 26], ['umgebung', 12]];
  if (env.anwesend) return [['weit', 30], ['buero', 20], ['weit', 18], ['stadion', 16], ['tafel', 10], ['umgebung', 14]];
  return [['weit', 36], ['stadion', 16], ['tafel', 10], ['umgebung', 16]];
}
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
let aktuellerShot = null;
function kameraUpdate(z, dt, env) {
  const liste = drehbuch(env);
  const key = liste.map((x) => x[0]).join();
  if (key !== regie.key) { regie.key = key; regie.liste = liste; regie.li = 0; wechsel(liste[0][0], z); }
  if (z - regie.seit > regie.liste[regie.li][1]) { regie.li = (regie.li + 1) % regie.liste.length; wechsel(regie.liste[regie.li][0], z); }
  const ziel = SHOTS[regie.shot]();
  const t = easeIO(Math.min(1, (z - regie.seit) / 5.5));
  const v = regie.von || ziel;
  // Interpolation (Spannweite logarithmisch, damit Zoom gleichmäßig wirkt)
  const span = Math.exp(THREE.MathUtils.lerp(Math.log(v.span), Math.log(ziel.span), t));
  const zp = v.ziel.clone().lerp(ziel.ziel, t);
  const drift = Math.sin(z * 0.021) * 0.22 + Math.sin(z * 0.0071) * 0.12;
  const az = THREE.MathUtils.lerp(v.az, ziel.az, t) + drift;
  const el = THREE.MathUtils.lerp(v.el, ziel.el, t) + Math.sin(z * 0.013) * 0.02;
  aktuellerShot = { ziel: zp, span, az, el };
  const D = 2200;
  kam.position.set(zp.x + Math.sin(az) * Math.cos(el) * D, zp.y + Math.sin(el) * D, zp.z + Math.cos(az) * Math.cos(el) * D);
  kam.lookAt(zp);
  const asp = innerWidth / innerHeight;
  kam.left = -span * asp; kam.right = span * asp; kam.top = span; kam.bottom = -span;
  kam.near = D - welt.R * 2.5; kam.far = D + welt.R * 2.5;
  kam.updateProjectionMatrix();
  return { ziel: zp, spannweite: span * asp, abstand: D, azimut: az, pxScale: innerHeight * renderer.getPixelRatio() / (2 * span) };
}
function wechsel(shot, z) {
  regie.von = aktuellerShot ? { ...aktuellerShot, ziel: aktuellerShot.ziel.clone() } : null;
  regie.shot = shot; regie.seit = z;
}

// ------------------------------------------------------------ Live-Daten
const live = { wetter: null, bvb: null, news: [], fehler: {} };
async function lade(name, fn, ms) {
  try { live[name] = await fn(); live.fehler[name] = null; }
  catch (e) { live.fehler[name] = String(e.message || e); }
  aktualisiereInhalte();
  setTimeout(() => lade(name, fn, ms), ms);
}
lade('wetter', wetter, 10 * 60e3);
lade('bvb', borussia, 15 * 60e3);
lade('news', nachrichten, 12 * 60e3);

function spielStatus(now) {
  const anstossTest = PARAM.get('anstoss');
  if (anstossTest !== null) return { anstoss: Number(anstossTest) + (Date.now() - t0Echt) / 60000 * Number(PARAM.get('speed') || 1) };
  for (const k of live.bvb?.heimspiele || []) {
    const min = (now - new Date(k).getTime()) / 60000;
    if (min > -180 && min < 175) return { anstoss: min };
  }
  return null;
}
const t0Echt = Date.now();

function aktualisiereInhalte() {
  const f = [];
  const b = live.bvb, w = live.wetter;
  const news = (live.news || []).slice(0, 6);
  news.forEach((n, i) => {
    f.push({ art: 'news', ...n, alter: alter(n.zeit) });
    if (i === 1 && b?.letztes) f.push(spielFolie(b));
    if (i === 3 && w) f.push(wetterFolie(w));
  });
  if (!news.length) { if (b?.letztes) f.push(spielFolie(b)); if (w) f.push(wetterFolie(w)); }
  tafel.setze(f);
  if (b?.letztes) {
    const l = b.letztes, n = b.naechstes;
    const naechstes = n ? ` · Nächstes Spiel: ${datumKurz(n.datum)} ${n.heim.name} – ${n.gast.name}` : '';
    stadion.bandText(`Borussia · ${l.heim.name} ${l.tore[0]}:${l.tore[1]} ${l.gast.name} · ${l.spieltag}${naechstes}${b.platz ? ` · Platz ${b.platz.platz} · ${b.platz.punkte} Punkte` : ''} · ESYON grüßt die Fohlen`);
  }
}
function spielFolie(b) {
  const l = b.letztes;
  return { art: 'spiel', kopf: `${b.liga} · ${l.spieltag} · ${datumKurz(l.datum)}`, heim: l.heim.kurz, gast: l.gast.kurz, tore: `${l.tore[0]}:${l.tore[1]}`,
    fuss: b.naechstes ? `Nächstes Spiel ${datumKurz(b.naechstes.datum)} · ${b.naechstes.heim.kurz} – ${b.naechstes.gast.kurz}` : '' };
}
function wetterFolie(w) {
  const auf = w.aufgang?.[0]?.slice(11, 16), unter = w.untergang?.[0]?.slice(11, 16);
  return { art: 'wetter', temp: `${Math.round(w.temp)}°`, text: w.text, detail: `Wind ${Math.round(w.wind)} km/h · gefühlt ${Math.round(w.gefuehlt)}°`, sonne: `Sonnenaufgang ${auf} · Sonnenuntergang ${unter}` };
}
const datumKurz = (iso) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
function alter(z) {
  const m = (jetzt() - new Date(z)) / 60000;
  if (!isFinite(m)) return '';
  if (m < 60) return `vor ${Math.max(1, Math.round(m))} Min.`;
  if (m < 60 * 24) return `vor ${Math.round(m / 60)} Std.`;
  return new Date(z).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ------------------------------------------------------------ Schleife
const uhr = new THREE.Clock();
let z = 0, letzteHud = -1, fpsZ = 0, fpsN = 0, fps = 60;
const fpsZiel = Number(PARAM.get('fps') || 0);
let akku = 0;
const env = { nacht: 0 };
let schnee = PARAM.get('wetter') === 'schnee' ? 0.6 : 0;

renderer.setAnimationLoop(() => {
  const dtEcht = Math.min(0.1, uhr.getDelta());
  if (fpsZiel) { akku += dtEcht; if (akku < 1 / fpsZiel) return; }
  const dt = fpsZiel ? Math.min(0.1, akku) : dtEcht; akku = 0;
  z += dt;
  renderer.info.reset();
  const now = jetzt(), b = berlin(now);
  const minute = b.min;
  const werktag = istWerktag(b) && !PARAM.has('wochenende');
  const spielInfo = spielStatus(now.getTime());
  const spiel = spielInfo ? (spielInfo.anstoss < 0 ? 'vor' : spielInfo.anstoss < 110 ? 'laeuft' : 'nach') : null;

  env.minute = minute; env.werktag = werktag; env.datum = b.iso; env.spiel = spiel; env.spielInfo = spielInfo;
  env.spieltag = !!spielInfo;
  const bs = buero.status;
  env.dartsLaeuft = werktag && minute >= 720 && minute < 760 && bs.anwesend > 0;
  env.gassiLaeuft = werktag && minute >= 760 && minute < 800 && bs.wer.length > 0;
  env.anwesend = bs.wer.length > 0;

  const k = kameraUpdate(z, dt, env);
  const h = himmel.update(now, z, dt, live.wetter, k);
  Object.assign(env, { nacht: h.nacht, wind: (live.wetter?.wind ?? 10), windRichtung: live.wetter?.windRichtung, windVektor: h.windVektor, truebe: h.truebe, pxScale: k.pxScale, ziel: k.ziel });
  const nahBuero = THREE.MathUtils.smoothstep(40, 20, k.spannweite / (innerWidth / innerHeight)) * (k.ziel.distanceTo(buero.zentrum) < 45 ? 1 : 0);
  env.nah = nahBuero;
  env.schilder = k.spannweite / (innerWidth / innerHeight) < 32;
  env.maehen = werktag && minute > 540 && minute < 720 && !spiel && !h.nass;

  welt.materialien.fassade.emissiveIntensity = h.nacht * 1.4;
  welt.laternen.kopfMat.emissiveIntensity = h.nacht * 3.5;
  welt.laternen.fleckMat.opacity = h.nacht * 0.7;
  welt.baeume.wind.uZeit.value = z; welt.baeume.wind.uWind.value = 0.15 + Math.min(1.4, env.wind / 25);
  if (welt.materialien.asphalt) for (const m of welt.materialien.asphalt) m.roughness = h.nass ? 0.35 : 0.9;
  if (welt.materialien.wasser) welt.materialien.wasser.color.setHSL(0.55, 0.45, 0.42 - h.nacht * 0.3);
  renderer.toneMappingExposure = 1.0 + h.nacht * 0.35;
  // Schneedecke wächst langsam bei Schneefall und taut danach wieder ab
  schnee = THREE.MathUtils.clamp(schnee + (h.art === 'schnee' ? dt / 90 : -dt / 400), 0, 0.85);
  for (const m of [welt.materialien.boden, welt.materialien.flaeche, welt.materialien.dach, welt.baeume.kroneMat]) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = schnee * (0.42 - h.nacht * 0.25); }

  stadion.update(dt, z, env);
  buero.update(z, minute, env);
  leben.update(z, dt, env);
  tafel.update(z, h.nacht);

  if (bloom) {
    bloom.strength = 0.18 + h.nacht * 0.75;
    bloom.threshold = 0.9 - h.nacht * 0.25;
    const tilt = THREE.MathUtils.clamp(k.spannweite / 400, 0.4, 1.4);
    tiltH.uniforms.h.value = 1.6 * tilt / innerWidth; tiltV.uniforms.v.value = 1.6 * tilt / innerHeight;
    composer.passes[4].uniforms.uZeit.value = z % 10;
    composer.render(dt);
  } else renderer.render(scene, kam);

  // HUD (4× pro Sekunde reicht)
  if (z - letzteHud > 0.25) {
    letzteHud = z;
    hud({ now, b, live, buero: bs, env, kam, pins: { buero: buero.zentrumGanz, stadion: stadion.zentrum.clone().setY(36) }, shot: regie.shot, fps });
  }
  fpsN++; if (z - fpsZ > 1) { fps = Math.round(fpsN / (z - fpsZ)); fpsZ = z; fpsN = 0; if (DEBUG) document.title = `${fps} fps · ${regie.shot} · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`; }
});

// Täglich um 4:00 neu laden (Speicher frisch, neue Version von GitHub)
setInterval(() => { const b = berlin(new Date()); if (b.h === 4 && b.mi === 0 && performance.now() > 120e3) location.reload(); }, 30e3);
