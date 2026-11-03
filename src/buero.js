// ESYON-Büro Helmut-Grashoff-Str. 20: Gebäude, Innenleben, Tagesablauf, Mittagsdarts, Gassirunde, Model Y.
import * as THREE from 'three';
import { polyPts, waende, flaeche } from './welt.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fensterTexturen, dartTextur, ZAHLEN, canvas, rund, bildLaden } from './texturen.js';
import { person, posiere, hund, posiereHund, auto } from './figuren.js';
import { TEAM, HUND, AUTO, ABLAUF } from './config.js';
import { hm, rng } from './zeit.js';

const V3 = THREE.Vector3;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const box = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = x.receiveShadow = true; return x; };

export function baueBuero(scene, OSM, welt, kameraRichtung) {
  // ------------------------------------------------ Rahmen aus dem OSM-Umriss
  const P = polyPts(OSM.office);
  const kanten = P.map((p, i) => [p, P[(i + 1) % P.length]]).sort((a, b) => b[0].distanceTo(b[1]) - a[0].distanceTo(a[1]));
  const u = kanten[0][1].clone().sub(kanten[0][0]).normalize();
  const c = P.reduce((s, p) => s.add(p), new THREE.Vector2()).divideScalar(P.length);
  const L = kanten[0][0].distanceTo(kanten[0][1]);
  const B = Math.min(kanten[2][0].distanceTo(kanten[2][1]), 14);
  const vz = new THREE.Vector2(u.y, -u.x);         // lokale z-Achse in OSM-Koordinaten
  // Straße: Helmut-Grashoff-Straße
  const strasse = welt.strassen.filter((s) => s.n === 'Helmut-Grashoff-Straße');
  let q = null, qd = 1e9;
  for (const s of strasse) for (const p of s.P) { const d = p.distanceTo(c); if (d < qd) { qd = d; q = p; } }
  if (!q) q = c.clone().add(vz.clone().multiplyScalar(30));
  const ex = Math.sign(q.clone().sub(c).dot(u)) || 1;
  const sz = Math.sign(q.clone().sub(c).dot(vz)) || 1;
  /** Zonen-Koordinaten: a = Abstand von der ESYON-Stirnwand nach innen, b = quer (+ zur Straße) */
  const O = (a, b) => c.clone().add(u.clone().multiplyScalar(ex * (L / 2 - a))).add(vz.clone().multiplyScalar(sz * b));
  const Wp = (a, b, y = 0) => { const p = O(a, b); return new V3(p.x, y, -p.y); };
  const richtung = (da, db) => { const d = u.clone().multiplyScalar(-ex * da).add(vz.clone().multiplyScalar(sz * db)); return new V3(d.x, 0, -d.y).normalize(); };
  const winkel = (dir) => Math.atan2(-dir.z, dir.x);
  const ZL = 18, H1 = 4.2, H2 = 8.6, FL = H1 + 0.12;

  const g = new THREE.Group(); scene.add(g);

  // ------------------------------------------------ Gebäude
  const [fTag, fNacht] = fensterTexturen(29);
  const fassade = new THREE.MeshStandardMaterial({ color: '#f3f4f2', map: fTag, emissiveMap: fNacht, emissive: new THREE.Color('#ffd59a'), emissiveIntensity: 0, roughness: 0.8 });
  const weiss = mat('#f1f2ef', { roughness: 0.85 });
  const ecken = (a0, a1) => [O(a0, -B / 2), O(a1, -B / 2), O(a1, B / 2), O(a0, B / 2)];
  const add = (geo, m, schatten = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = schatten; x.receiveShadow = true; g.add(x); return x; };
  add(waende(ecken(0, L), 0, H1), fassade);
  add(flaeche(ecken(0, L), H1), weiss);
  add(waende(ecken(ZL, L), H1, H2), fassade);
  add(flaeche(ecken(ZL, L), H2), mat('#8f9496', { roughness: 0.95 }));
  add(waende(ecken(ZL, L), H2, H2 + 0.6), weiss);
  // ESYON-Etage: Boden, Glas, Pfosten, Dach (blendet in Nahaufnahmen aus)
  add(flaeche(ecken(0.15, ZL), FL), mat('#c9a77c', { roughness: 0.75 }));
  const glas = new THREE.MeshPhysicalMaterial({ color: '#bfe3e6', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  add(waende(ecken(0, ZL), H1, H2), glas, false);
  const pfostenM = mat('#d9dfdd', { metalness: 0.3, roughness: 0.45 });
  for (let a = 0; a <= ZL; a += 1.8) for (const b of [-B / 2, B / 2]) { const p = box(0.12, H2 - H1, 0.12, pfostenM); p.position.copy(Wp(a, b, (H1 + H2) / 2)); g.add(p); }
  for (let b = -B / 2; b <= B / 2; b += 1.75) { const p = box(0.12, H2 - H1, 0.12, pfostenM); p.position.copy(Wp(0, b, (H1 + H2) / 2)); g.add(p); }
  for (const y of [H1 + 0.9, H2 - 0.1]) for (const [a0, b0, a1, b1] of [[0, -B / 2, ZL, -B / 2], [0, B / 2, ZL, B / 2], [0, -B / 2, 0, B / 2]]) {
    const p0 = Wp(a0, b0, y), p1 = Wp(a1, b1, y), len = p0.distanceTo(p1);
    const r = box(0.1, 0.08, len, pfostenM); r.position.copy(p0.clone().add(p1).multiplyScalar(0.5)); r.lookAt(p1.x, y, p1.z); g.add(r);
  }
  const dachMat = mat('#9aa0a2', { transparent: true, opacity: 1, roughness: 0.9 });
  const dachGrp = new THREE.Group(); g.add(dachGrp);
  const dach = new THREE.Mesh(flaeche(ecken(0, ZL), H2), dachMat); dach.castShadow = true; dachGrp.add(dach);
  const attika = new THREE.Mesh(waende(ecken(0, ZL), H2, H2 + 0.6), new THREE.MeshStandardMaterial({ color: '#f1f2ef', transparent: true })); attika.castShadow = true; dachGrp.add(attika);
  // Trennwand mit Logo
  const tw = box(0.25, H2 - H1, B - 0.3, weiss); tw.position.copy(Wp(ZL, 0, (H1 + H2) / 2)); tw.rotation.y = winkel(richtung(1, 0)); g.add(tw);

  // Logo-Schilder (Dach + Innenwand)
  const logoSchild = (breite, hoehe, hinter) => {
    const [cv, cg] = canvas(1024, 256);
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
    bildLaden('assets/ESY-Logo-1c-white.svg').then((img) => {
      cg.fillStyle = hinter; rund(cg, 0, 0, 1024, 256, 40); cg.fill();
      if (img) cg.drawImage(img, 90, 38, 844, 180);
      else { cg.fillStyle = '#fff'; cg.font = '800 150px Inter, Arial'; cg.textAlign = 'center'; cg.fillText('ESYON', 512, 185); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      m.map = t; m.emissiveMap = t; m.needsUpdate = true;
    });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(breite, hoehe), m);
    return me;
  };
  // Dachschild zeigt zur Kamera-Seite
  const zurKamera = richtung(0, 1).dot(kameraRichtung) > 0 ? 1 : -1;
  const dachSchild = logoSchild(15, 3.75, '#157e77');
  dachSchild.position.copy(Wp(ZL + 14, zurKamera * 1.5, H2 + 0.6 + 2.2));
  dachSchild.rotation.y = winkel(richtung(0, zurKamera)) + Math.PI / 2;
  dachSchild.castShadow = true; g.add(dachSchild);
  const traeger = box(14, 0.25, 0.25, pfostenM); traeger.position.copy(Wp(ZL + 14, zurKamera * 1.3, H2 + 0.7)); traeger.rotation.y = dachSchild.rotation.y; g.add(traeger);
  const wandSchild = logoSchild(5, 1.25, '#1b3336');
  wandSchild.position.copy(Wp(ZL - 0.14, 0, FL + 2.4)); wandSchild.rotation.y = winkel(richtung(-1, 0)) + Math.PI / 2; g.add(wandSchild);
  // Logo auch auf der Glasfront zur Kamera (Folie)
  const folie = logoSchild(4.2, 1.05, '#157e77');
  folie.position.copy(Wp(ZL / 2, zurKamera * (B / 2 + 0.06), H1 - 0.9)); folie.rotation.y = winkel(richtung(0, zurKamera)) + Math.PI / 2; g.add(folie);

  // ------------------------------------------------ Außentreppe an der Stirnseite
  const stufenM = mat('#59656a', { metalness: 0.4, roughness: 0.5 });
  const TA = -1.3, TB0 = -5.2, TB1 = 5.4, nSt = 22;
  for (let i = 0; i < nSt; i++) {
    const f = i / nSt; const st = box(1.4, 0.08, (TB1 - TB0) / nSt + 0.05, stufenM);
    st.position.copy(Wp(TA, TB0 + (TB1 - TB0) * f, H1 - (H1 * f))); st.rotation.y = winkel(richtung(0, 1)) + Math.PI / 2; g.add(st);
  }
  const podest = box(1.6, 0.12, 2.2, stufenM); podest.position.copy(Wp(TA, -B / 2 + 0.6, H1)); podest.rotation.y = winkel(richtung(0, 1)) + Math.PI / 2; g.add(podest);
  const gel0 = Wp(TA - 0.7, TB0, H1 + 1), gel1 = Wp(TA - 0.7, TB1, 1);
  const gel = box(0.06, 0.06, gel0.distanceTo(gel1), pfostenM); gel.position.copy(gel0.clone().add(gel1).multiplyScalar(0.5)); gel.lookAt(gel1); g.add(gel);

  // ------------------------------------------------ Einrichtung
  const holz = mat('#e7dcc9', { roughness: 0.6 }), dunkel = mat('#2b2f33', { roughness: 0.5 });
  const moebel = new THREE.Group(); g.add(moebel);
  const setze = (m, a, b, y, dreh = 0) => { m.position.copy(Wp(a, b, y)); m.rotation.y = winkel(richtung(1, 0)) + dreh; moebel.add(m); return m; };
  const plaetze = {};
  const tischA = { steffi: 15, ben: 12, tino: 9 };
  for (const [id, a] of Object.entries(tischA)) {
    setze(box(1.7, 0.06, 0.85, holz), a, -5.75, FL + 0.74);
    for (const s of [-0.75, 0.75]) setze(box(0.06, 0.74, 0.75, dunkel), a + s, -5.75, FL + 0.37);
    const mon = setze(box(0.65, 0.4, 0.04, dunkel), a, -6.0, FL + 1.05);
    const bild = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: new THREE.Color('#5ab7ff'), emissiveIntensity: 0.6 }));
    bild.position.set(0, 0, 0.025); mon.add(bild); mon.userData.bild = bild;
    setze(box(0.5, 0.08, 0.5, dunkel), a, -4.75, FL + 0.48);
    setze(box(0.5, 0.55, 0.08, dunkel), a, -4.48, FL + 0.8);
    plaetze[id] = { sitz: Wp(a, -4.72, FL), blick: richtung(0, -1), mon };
  }
  // Besprechungstisch, Sofa, Hundekorb, Küche, Pflanzen
  const rt = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24), holz); rt.castShadow = true; rt.position.copy(Wp(12.5, 2.4, FL + 0.74)); g.add(rt);
  const rtf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 0.74, 10), dunkel); rtf.position.copy(Wp(12.5, 2.4, FL + 0.37)); g.add(rtf);
  for (let k = 0; k < 4; k++) { const st = box(0.42, 0.45, 0.42, mat(['#157e77', '#42b8b4', '#efcf41', '#e8604c'][k])); st.position.copy(Wp(12.5 + Math.cos(k * 1.57) * 1.25, 2.4 + Math.sin(k * 1.57) * 1.25, FL + 0.22)); g.add(st); }
  setze(box(2.4, 0.42, 0.9, mat('#1b3336')), 8.5, 6.1, FL + 0.21); setze(box(2.4, 0.5, 0.22, mat('#1b3336')), 8.5, 6.55, FL + 0.6);
  const korb = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.68, 0.22, 20), mat('#7a5a3a')); korb.position.copy(Wp(6.2, -5.3, FL + 0.11)); g.add(korb);
  const kissen = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 20), mat('#cfe6e6')); kissen.position.copy(Wp(6.2, -5.3, FL + 0.2)); g.add(kissen);
  setze(box(1.4, 0.92, 2.6, mat('#f4f4f2')), 17.1, 5.2, FL + 0.46);
  const kaffee = setze(box(0.4, 0.45, 0.35, mat('#222', { metalness: 0.6 })), 17.2, 4.5, FL + 1.15);
  for (const [a, b] of [[0.6, -6.4], [17.4, -6.4], [0.6, 6.3], [10.3, 6.3]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 10), mat('#d8d2c4')); t.position.copy(Wp(a, b, FL + 0.2)); g.add(t);
    const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat('#3f7d3a', { flatShading: true })); bl.position.copy(Wp(a, b, FL + 0.75)); bl.castShadow = true; g.add(bl);
  }
  // Dartscheibe + Wertungstafel
  const DB = 3.4, BH = FL + 1.73;
  const scheibe = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshStandardMaterial({ map: dartTextur(), roughness: 0.8 }));
  scheibe.position.copy(Wp(0.16, DB, BH)); scheibe.rotation.y = winkel(richtung(1, 0)) + Math.PI / 2; g.add(scheibe);
  const kab = box(0.06, 0.95, 0.95, mat('#3a2a1e')); kab.position.copy(Wp(0.1, DB, BH)); kab.rotation.y = winkel(richtung(1, 0)); g.add(kab);
  const linie = box(0.05, 0.02, 0.7, mat('#efcf41')); linie.position.copy(Wp(2.53, DB, FL + 0.01)); linie.rotation.y = winkel(richtung(1, 0)); g.add(linie);
  const [tc, tg] = canvas(512, 384);
  const tafelTex = new THREE.CanvasTexture(tc); tafelTex.colorSpace = THREE.SRGBColorSpace;
  const tafel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), new THREE.MeshStandardMaterial({ map: tafelTex, roughness: 0.6, emissive: new THREE.Color('#fff'), emissiveMap: tafelTex, emissiveIntensity: 0.15 }));
  tafel.position.copy(Wp(0.16, 0.9, FL + 1.65)); tafel.rotation.y = scheibe.rotation.y; g.add(tafel);
  const brettNormal = richtung(1, 0);
  setzeDartsGeometrie(Wp(2.75, DB, FL), richtung(-1, 0));
  // Brett-Punkt aus (Radius 0..1, Winkel) – Winkel 0 = oben (20)
  const brettPunkt = (r, w) => {
    const rechts = richtung(0, 1);
    return Wp(0.19, DB, BH).add(rechts.clone().multiplyScalar(Math.sin(w) * r * 0.31)).add(new V3(0, Math.cos(w) * r * 0.31, 0));
  };

  // Innenlicht
  const innenLicht = new THREE.PointLight('#ffe2b8', 0, 26, 1.6); innenLicht.position.copy(Wp(9, 0, H2 - 0.6)); g.add(innenLicht);
  const deckenM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff4e0'), emissiveIntensity: 0, transparent: true });
  for (let a = 3; a < ZL; a += 4.5) for (const b of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.6), deckenM); p.position.copy(Wp(a, b, H2 - 0.05)); p.rotation.y = winkel(richtung(1, 0)); dachGrp.add(p); }

  // ------------------------------------------------ Kleinteile zusammenführen (weniger Draw-Calls)
  {
    g.updateMatrixWorld(true);
    const nachMat = new Map();
    for (const grp of [g, moebel]) for (const o of [...grp.children]) {
      if (!o.isMesh || o.material.transparent || o.material.map || o === dach || o.userData.bild || o.children.length) continue;
      if (!nachMat.has(o.material)) nachMat.set(o.material, []);
      nachMat.get(o.material).push(o);
    }
    for (const [m, liste] of nachMat) {
      if (liste.length < 3) continue;
      const geos = liste.map((o) => { o.updateMatrixWorld(true); const gg = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); return gg.index ? gg.toNonIndexed() : gg; });
      let merged; try { merged = mergeGeometries(geos); } catch { merged = null; }
      if (!merged) continue;
      liste.forEach((o) => o.parent.remove(o));
      const mm = new THREE.Mesh(merged, m); mm.castShadow = mm.receiveShadow = true; scene.add(mm);
    }
  }

  // ------------------------------------------------ Figuren
  const leute = TEAM.map((p) => ({ cfg: p, f: person(p) }));
  leute.forEach((l) => { scene.add(l.f.root); l.f.root.visible = false; });
  const hilde = hund(HUND); scene.add(hilde.root); hilde.root.visible = false;
  const tesla = auto(AUTO.farbe); scene.add(tesla.root); tesla.root.visible = false;
  const leine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3(), new V3()]), new THREE.LineBasicMaterial({ color: HUND.halsband }));
  scene.add(leine); leine.visible = false;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#d8ff3a', { roughness: 0.6 })); scene.add(ball); ball.visible = false;
  const pfeile = [0, 1, 2].map(() => {
    const d = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6).rotateZ(Math.PI / 2), mat('#c0c4c8', { metalness: 0.8 })); d.add(s);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.004), mat('#e8604c')); fl.position.x = -0.09; d.add(fl);
    d.scale.setScalar(1.6); scene.add(d); d.visible = false; return d;
  });
  const [pc, pg] = canvas(256, 128);
  const popTex = new THREE.CanvasTexture(pc); popTex.colorSpace = THREE.SRGBColorSpace;
  const popup = new THREE.Sprite(new THREE.SpriteMaterial({ map: popTex, depthTest: false, transparent: true })); popup.scale.set(2.2, 1.1, 1); popup.renderOrder = 12; scene.add(popup); popup.visible = false;
  let popText = '';
  const zeigePopup = (t, farbe) => {
    if (t === popText) return; popText = t;
    pg.clearRect(0, 0, 256, 128); pg.font = '800 70px "Big Shoulders Display", Inter, Arial'; pg.textAlign = 'center'; pg.textBaseline = 'middle';
    pg.lineWidth = 10; pg.strokeStyle = '#102022'; pg.strokeText(t, 128, 66); pg.fillStyle = farbe; pg.fillText(t, 128, 66); popTex.needsUpdate = true;
  };

  // ------------------------------------------------ Wege
  const tuerInnen = Wp(0.7, -5.9, FL), podestP = Wp(TA, -5.9, FL), treppeOben = Wp(TA, TB0, FL), treppeUnten = Wp(TA, TB1, 0), G = Wp(TA - 1.6, B / 2 + 2.4, 0);
  const gang = (a) => Wp(a, -3.3, FL);
  const nachDraussen = (a) => [gang(a), gang(1.3), tuerInnen, podestP, treppeOben, treppeUnten, G];
  const autoPlatz = Wp(6.5, B / 2 + 5.2, 0);
  const autoTuer = Wp(5.9, B / 2 + 3.9, 0);
  // Straßenroute (Weltkoordinaten), beide Enden
  const route = strassenRoute(strasse, q);
  const vonStrasse = (seite, versatz) => route[seite].map((p) => { return new V3(p.x, 0, -p.y); });

  // ------------------------------------------------ Tagesplan
  let planTag = '', plaene = null, darts = null, gassi = null;
  function baueTag(datum, werktag) {
    planTag = datum + werktag;
    plaene = {}; darts = null; gassi = null;
    if (!werktag) return;
    const r = rng(datum);
    const d0 = hm(ABLAUF.darts[0]), d1 = hm(ABLAUF.darts[1]), g0 = hm(ABLAUF.gassi[0]), g1 = hm(ABLAUF.gassi[1]);
    darts = dartsSpiel(datum, d0 + 0.5, d1 - 0.5);
    gassi = gassiRunde(G, welt.stadion.runde, g0 + 0.5, g1 - 0.6);
    const warte = [Wp(4.4, 5.7, FL), Wp(4.9, 1.2, FL), Wp(6.0, 3.4, FL)];
    leute.forEach((l, i) => {
      const p = l.cfg, pl = new Plan();
      const sitz = plaetze[p.id] || plaetze.tino;
      const kommt = hm(p.kommt) + (r() - 0.5) * 6, geht = hm(p.geht) + (r() - 0.5) * 8;
      const a = { tino: 9, ben: 12, steffi: 15 }[p.id] ?? 9;
      const reinWeg = [...nachDraussen(a)].reverse().concat([sitz.sitz]);
      let t;
      if (p.mitAuto) {
        pl.auto = { an: [kommt - 1.1, kommt], ab: [geht + 0.9, geht + 2] };
        t = pl.gehe(kommt, [autoTuer, ...reinWeg]);
      } else {
        const start = vonStrasse(i % 2 ? 0 : 1);
        t = pl.gehe(kommt - 3, [...start, G, ...reinWeg.slice(1)]);
      }
      // Arbeiten mit Kaffeerunden, Darts, Gassi
      const kaffeeZeiten = ABLAUF.kaffee.map((k) => hm(k) + i * 4.5 + r() * 3);
      const kp = Wp(16.1, 3.6 + i * 0.7, FL);
      const kaffeeRunde = (kz) => {
        pl.bleib(t, kz, sitz.sitz, sitz.blick, 'tippen');
        t = pl.gehe(kz, [gang(a), kp]);
        t = pl.bleib(t, t + 3.2, kp, richtung(-1, 0), 'stehen');
        t = pl.gehe(t, [gang(a), sitz.sitz]);
      };
      for (const kz of kaffeeZeiten) if (kz > t + 1 && kz < d0 - 6) kaffeeRunde(kz);
      if (t < d0) { pl.bleib(t, d0, sitz.sitz, sitz.blick, 'tippen'); t = d0; }
      t = pl.gehe(t, [gang(a), warte[i]]);
      pl.darts(t, d1, i, warte[i]);
      t = pl.gehe(d1, [warte[i], gang(1.3), tuerInnen, podestP, treppeOben, treppeUnten, G]);
      pl.gassi(Math.max(t, g0 + 0.5), g1 - 0.6, i);
      t = pl.gehe(g1 - 0.6, [G, treppeUnten, treppeOben, podestP, tuerInnen, gang(1.3), gang(a), sitz.sitz]);
      for (const kz of kaffeeZeiten) if (kz > t + 1 && kz < geht - 6) kaffeeRunde(kz);
      if (t < geht) pl.bleib(t, geht, sitz.sitz, sitz.blick, 'tippen');
      if (p.mitAuto) pl.gehe(geht, [...nachDraussen(a), autoTuer]);
      else { const ziel = vonStrasse(i % 2 ? 0 : 1).reverse(); pl.gehe(geht, [...nachDraussen(a), ...ziel]); }
      pl.fertig();
      plaene[p.id] = pl;
    });
    // Hilde: kommt mit Tino, liegt im Korb, besucht Schreibtische, schaut Darts, Gassi
    const tino = plaene.tino; const hp = new Plan();
    if (tino) {
      const korbP = Wp(6.2, -5.3, FL + 0.18);
      const ank = tino.beine[0].t0;
      let t = hp.gehe(ank + 0.05, [autoTuer.clone().add(new V3(0.6, 0, 0.6)), ...[...nachDraussen(9)].reverse(), korbP], 1.45);
      let nxt = t + 25 + r() * 20;
      while (nxt < d0 - 6) {
        hp.bleib(t, nxt, korbP, richtung(1, 0.3), 'liegen');
        const wen = ['tino', 'ben', 'steffi'][(r() * 3) | 0], pz = plaetze[wen].sitz.clone().add(richtung(1, 0).multiplyScalar(0.8)).setY(FL);
        t = hp.gehe(nxt, [gang(tischA[wen]), pz], 1.2);
        t = hp.bleib(t, t + 3 + r() * 3, pz, richtung(-1, -0.3), 'sitzen');
        t = hp.gehe(t, [gang(tischA[wen]), korbP], 1.2);
        nxt = t + 30 + r() * 30;
      }
      hp.bleib(t, d0 + 0.6, korbP, richtung(1, 0.3), 'liegen');
      const zuschauen = Wp(5.6, 3.0, FL);
      t = hp.gehe(d0 + 0.6, [korbP, zuschauen], 1.2);
      hp.bleib(t, d1, zuschauen, richtung(-1, 0.1), 'sitzen');
      t = hp.gehe(d1, [zuschauen, gang(1.3), tuerInnen, podestP, treppeOben, treppeUnten, G], 1.3);
      hp.gassi(Math.max(t, g0 + 0.5), g1 - 0.6, 'hund');
      t = hp.gehe(g1 - 0.6, [G, treppeUnten, treppeOben, podestP, tuerInnen, gang(1.3), korbP], 1.3);
      const geht = tino.beine.at(-1).t0;
      if (t < geht) hp.bleib(t, geht + 0.1, korbP, richtung(1, 0.3), 'liegen');
      hp.gehe(geht + 0.1, [korbP, ...nachDraussen(9), autoTuer.clone().add(new V3(0.6, 0, 0.6))], 1.4);
      hp.fertig();
      plaene.hilde = hp;
    }
  }

  // Straßenweg des Autos
  const autoWeg = (() => {
    const pts = route[0].map((p) => new V3(p.x, 0, -p.y));
    const ende = pts.at(-1);
    const r = [...pts];
    r.push(ende.clone().lerp(autoPlatz, 0.5), autoPlatz.clone().add(richtung(-1, 0).multiplyScalar(4)), autoPlatz);
    return pfad(r);
  })();

  // ------------------------------------------------ Status für das HUD
  let status = { text: '', wer: [], darts: null };

  function update(z, minute, env) {
    const tag = env.datum + env.werktag;
    if (tag !== planTag) baueTag(env.datum, env.werktag);
    const nah = env.nah;   // 0..1 Kamera ganz nah am Büro
    dachMat.opacity = 1 - nah * 0.92; attika.material.opacity = dachMat.opacity; deckenM.opacity = dachMat.opacity;
    dachMat.depthWrite = dachMat.opacity > 0.5; dach.castShadow = dachMat.opacity > 0.5;
    fassade.emissiveIntensity = env.nacht * 1.1;

    let anwesend = 0, wer = [];
    leute.forEach((l) => {
      const pl = plaene?.[l.cfg.id];
      const zst = pl ? pl.at(minute, { darts, gassi }) : null;
      l.f.root.visible = !!zst;
      if (!zst) return;
      l.f.root.position.copy(zst.pos);
      l.f.root.rotation.y = winkel(zst.blick);
      posiere(l.f, zst.pose, z, zst.extra);
      l.f.schild.visible = env.schilder;
      if (zst.drinnen) anwesend++;
      wer.push(l.cfg.name);
      const mon = plaetze[l.cfg.id]?.mon; if (mon) mon.userData.bild.material.emissiveIntensity = zst.pose === 'tippen' ? 0.9 : 0.15;
    });
    // Hilde
    const hz = plaene?.hilde ? plaene.hilde.at(minute, { darts, gassi }) : null;
    hilde.root.visible = !!hz; leine.visible = false; ball.visible = false;
    if (hz) {
      hilde.root.position.copy(hz.pos); hilde.root.rotation.y = winkel(hz.blick);
      posiereHund(hilde, hz.pose === 'gehen' ? 'laufen' : hz.pose, z);
      hilde.schild.visible = env.schilder;
      if (hz.ball) { ball.visible = true; ball.position.copy(hz.ball); }
      if (hz.leine && leute[0].f.root.visible) {
        const hand = leute[0].f.root.position.clone().add(new V3(0, 0.95, 0)), hals = hilde.root.position.clone().add(new V3(0, 0.8, 0));
        const mitte = hand.clone().lerp(hals, 0.5); mitte.y -= 0.35;
        leine.geometry.setFromPoints([hand, mitte, hals]); leine.visible = true;
      }
    }
    // Model Y
    const ap = plaene?.tino?.auto;
    tesla.root.visible = false;
    if (ap) {
      let s = null, rueck = false;
      if (minute >= ap.an[0] && minute < ap.an[1]) s = ease((minute - ap.an[0]) / (ap.an[1] - ap.an[0]));
      else if (minute >= ap.an[1] && minute < ap.ab[0]) s = 1;
      else if (minute >= ap.ab[0] && minute < ap.ab[1]) { s = 1 - ease((minute - ap.ab[0]) / (ap.ab[1] - ap.ab[0])); rueck = true; }
      if (s !== null) {
        tesla.root.visible = true;
        const { p, d } = autoWeg.at(s);
        tesla.root.position.copy(p); tesla.root.position.y = 0.32;
        tesla.root.rotation.y = winkel(d) + (rueck && s < 0.985 ? Math.PI : 0);
        const faehrt = s > 0 && s < 1;
        tesla.licht.emissiveIntensity = faehrt || env.nacht > 0.4 && s < 1 ? 4 : 0.15;
        tesla.rueck.emissiveIntensity = faehrt ? 3 : 0.3;
        // Ankunftsblinken beim Abschließen
        if (s === 1 && minute - ap.an[1] < 0.08 && !rueck) tesla.licht.emissiveIntensity = (z * 6 | 0) % 2 ? 3 : 0.1;
      }
    }
    // Darts-Pfeile
    pfeile.forEach((d) => (d.visible = false)); popup.visible = false;
    let dz = null;
    if (darts && minute >= darts.t0 && minute < darts.t1) {
      dz = darts.at(minute);
      const werfer = leute[dz.werfer]?.f.root;
      dz.pfeile.forEach((pf, k) => {
        if (pf.f < 0) return;
        const d = pfeile[k]; d.visible = true;
        const ziel = brettPunkt(pf.r, pf.w).add(brettNormal.clone().multiplyScalar(0.06));
        if (pf.f >= 1 || !werfer) { d.position.copy(ziel); }
        else {
          const hand = werfer.position.clone().add(new V3(0, 1.85, 0)).add(richtung(0, 1).multiplyScalar(0.3));
          d.position.copy(hand.lerp(ziel, pf.f)); d.position.y += Math.sin(pf.f * Math.PI) * 0.35;
        }
        d.rotation.y = winkel(brettNormal.clone().negate());
      });
      if (dz.anzeige) {
        popup.visible = env.schilder;
        popup.position.copy(Wp(0.6, DB, BH + 1.1));
        zeigePopup(dz.anzeige.text, dz.anzeige.farbe);
      }
      malTafel(dz);
    }
    // Licht im Büro
    const jemand = anwesend > 0 || (hz && hz.drinnen);
    const hell = jemand ? Math.max(0.35, env.nacht) : 0;
    innenLicht.intensity = THREE.MathUtils.lerp(innenLicht.intensity, hell * 60, 0.08);
    deckenM.emissiveIntensity = jemand ? 0.6 + env.nacht * 1.6 : 0;

    status = {
      wer, anwesend, darts: dz && dz.stand,
      text: statusText(minute, env, { wer, darts, gassi, plaene }),
    };
  }

  let tafelStand = '';
  function malTafel(dz) {
    const key = JSON.stringify(dz.stand); if (key === tafelStand) return; tafelStand = key;
    tg.fillStyle = '#1d2b22'; tg.fillRect(0, 0, 512, 384);
    tg.strokeStyle = '#8a6a48'; tg.lineWidth = 16; tg.strokeRect(0, 0, 512, 384);
    tg.fillStyle = '#e9efe6'; tg.font = '700 40px "Big Shoulders Display", Inter, Arial'; tg.textAlign = 'left';
    tg.fillText(`501 · LEG ${dz.stand.leg}`, 30, 62);
    dz.stand.spieler.forEach((s, i) => {
      tg.fillStyle = i === dz.werfer ? '#efcf41' : '#e9efe6'; tg.font = '700 58px "Big Shoulders Display", Inter, Arial';
      tg.fillText(s.name, 30, 140 + i * 82); tg.textAlign = 'right'; tg.fillText(String(s.rest), 380, 140 + i * 82);
      tg.font = '600 34px Inter, Arial'; tg.fillStyle = '#9fd3c7'; tg.fillText('●'.repeat(s.legs) || '–', 486, 136 + i * 82); tg.textAlign = 'left';
    });
    tafelTex.needsUpdate = true;
  }

  return {
    zentrum: Wp(ZL / 2, 0, 4), zentrumGanz: Wp(L / 2, 0, 4), gruppe: g, update,
    dartsZiel: Wp(2.2, DB - 0.6, FL + 1.1), dartsNormal: richtung(1, 0), querZurStrasse: richtung(0, 1), get status() { return status; },
    get personen() { return leute.filter((l) => l.f.root.visible).map((l) => l.f.root.position).concat(hilde.root.visible ? [hilde.root.position] : []); },
    autoPlatz,
  };
}

// =================================================================== Plan-Logik
const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function pfad(pts) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const l = pts[i - 1].distanceTo(pts[i]); seg.push(l); L += l; }
  return {
    L, pts,
    at(s) {
      let d = Math.max(0, Math.min(1, s)) * L;
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) {
          const f = seg[i] ? Math.min(1, d / seg[i]) : 1;
          const p = pts[i].clone().lerp(pts[i + 1], f);
          const dir = pts[i + 1].clone().sub(pts[i]); dir.y = 0;
          return { p, d: dir.lengthSq() > 1e-6 ? dir.normalize() : new V3(1, 0, 0) };
        }
        d -= seg[i];
      }
    },
  };
}

class Plan {
  constructor() { this.beine = []; }
  gehe(t0, pts, tempo = 1.3) {
    const pf = pfad(pts.filter(Boolean));
    const dauer = Math.max(0.05, pf.L / tempo / 60);
    this.beine.push({ t0, t1: t0 + dauer, art: 'gehen', pf });
    return t0 + dauer;
  }
  bleib(t0, t1, pos, blick, pose) { if (t1 > t0) this.beine.push({ t0, t1, art: 'bleib', pos, blick, pose }); return t1; }
  darts(t0, t1, i, warte) { this.beine.push({ t0, t1, art: 'darts', i, warte }); return t1; }
  gassi(t0, t1, wer) { this.beine.push({ t0, t1, art: 'gassi', wer }); return t1; }
  fertig() { this.beine.sort((a, b) => a.t0 - b.t0); }
  at(m, ctx) {
    const b = this.beine;
    if (!b.length || m < b[0].t0 || m >= b.at(-1).t1) return null;
    // letztes Bein, das schon begonnen hat
    let leg = b[0];
    for (const x of b) { if (x.t0 <= m) leg = x; else break; }
    if (m >= leg.t1) {
      // Lücke: am Endpunkt des Beins warten
      if (leg.art === 'gehen') { const e = leg.pf.at(1); return { pos: e.p, blick: e.d, pose: 'stehen', drinnen: e.p.y > 2 }; }
      if (leg.art === 'bleib') return { pos: leg.pos, blick: leg.blick, pose: leg.pose, drinnen: leg.pos.y > 2 };
    }
    if (leg.art === 'gehen') {
      const { p, d } = leg.pf.at((m - leg.t0) / (leg.t1 - leg.t0));
      return { pos: p, blick: d, pose: 'gehen', drinnen: p.y > 2 };
    }
    if (leg.art === 'bleib') return { pos: leg.pos, blick: leg.blick, pose: leg.pose, drinnen: leg.pos.y > 2 };
    if (leg.art === 'darts') return ctx.darts.position(m, leg.i, leg.warte);
    if (leg.art === 'gassi') return ctx.gassi.position(m, leg.wer);
  }
}

// =================================================================== Mittagsdarts (501, deterministisch pro Tag)
function dartsSpiel(datum, t0, t1) {
  const r = rng('darts' + datum);
  const NAMEN = TEAM.map((p) => p.name);
  const SKILL = [0.62, 0.55, 0.58];
  const ZUG = 0.42;                   // Minuten pro Aufnahme (≈ 25 s)
  const n = Math.floor((t1 - t0) / ZUG);
  const zuege = [];
  let rest = [501, 501, 501], legs = [0, 0, 0], leg = 1, starter = 0, idx = 0;
  for (let j = 0; j < n; j++) {
    const w = (starter + idx) % 3;
    const vorher = [...rest];
    const pfeile = []; let summe = 0, bust = false, check = false;
    for (let k = 0; k < 3; k++) {
      const sk = SKILL[w];
      // Ziel: T20, beim Auschecken das passende Feld
      let zielNr = 20, ring = 'S';
      const x = r();
      if (rest[w] - summe <= 40 && (rest[w] - summe) % 2 === 0) { zielNr = (rest[w] - summe) / 2; ring = 'D'; }
      let nr = zielNr, wert;
      const streu = r();
      if (zielNr === 25 || zielNr > 20) { nr = 20; ring = 'S'; }
      if (streu > sk) { const i = ZAHLEN.indexOf(nr); nr = ZAHLEN[(i + (r() < 0.5 ? 1 : 19)) % 20]; }
      if (ring === 'D') ring = x < 0.32 ? 'D' : x < 0.85 ? 'S' : 'M';
      else ring = x < 0.12 + sk * 0.12 ? 'T' : x < 0.86 ? 'S' : x < 0.9 ? 'D' : x < 0.94 ? 'B' : x < 0.96 ? 'BB' : 'M';
      wert = ring === 'T' ? nr * 3 : ring === 'D' ? nr * 2 : ring === 'S' ? nr : ring === 'B' ? 25 : ring === 'BB' ? 50 : 0;
      const wi = ZAHLEN.indexOf(nr) * Math.PI / 10 + (r() - 0.5) * 0.22;
      const rr = { T: 0.605, D: 0.975, S: r() < 0.5 ? 0.35 + r() * 0.2 : 0.7 + r() * 0.2, B: 0.07, BB: 0.02, M: 1.05 + r() * 0.15 }[ring];
      pfeile.push({ r: rr, w: ring === 'B' || ring === 'BB' ? r() * 6.28 : wi, wert, ring });
      summe += wert;
      const neu = rest[w] - summe;
      if (neu < 0 || neu === 1 || (neu === 0 && ring !== 'D' && ring !== 'BB')) { bust = true; break; }
      if (neu === 0) { check = true; break; }
    }
    if (!bust) rest[w] -= summe;
    zuege.push({ w, pfeile, summe, bust, check, vorher, nachher: [...rest], legs: [...legs], leg });
    idx++;
    if (check) { legs[w]++; leg++; rest = [501, 501, 501]; starter = (starter + 1) % 3; idx = 0; zuege.at(-1).legsNach = [...legs]; }
  }
  return {
    t0, t1,
    at(m) {
      const j = Math.min(zuege.length - 1, Math.floor((m - t0) / ZUG));
      if (j < 0) return { werfer: 0, pfeile: [], stand: stand(zuege[0], false), anzeige: null };
      const z = zuege[j], f = (m - t0) / ZUG - j;
      const pf = z.pfeile.map((p, k) => { const s = 0.22 + k * 0.15; return { ...p, f: f < s ? -1 : Math.min(1, (f - s) / 0.05) }; });
      let anzeige = null;
      if (f > 0.22 + (z.pfeile.length - 1) * 0.15 + 0.06) {
        anzeige = z.check ? { text: 'CHECK!', farbe: '#efcf41' } : z.bust ? { text: 'BUST', farbe: '#e8604c' } :
          z.summe === 180 ? { text: '180!!!', farbe: '#efcf41' } : { text: String(z.summe), farbe: z.summe >= 100 ? '#42b8b4' : '#ffffff' };
      }
      return { werfer: z.w, pfeile: f < 0.95 ? pf : [], stand: stand(z, f > 0.7), anzeige, zug: z };
    },
    position(m, i, warte) {
      const j = Math.min(zuege.length - 1, Math.max(0, Math.floor((m - t0) / ZUG)));
      const z = zuege[j], f = (m - t0) / ZUG - j;
      const linie = warte.clone(); // wird unten gesetzt
      if (m < t0 || z.w !== i) {
        // Jubeln beim Check eines anderen? Nur der Werfer jubelt
        return { pos: warte, blick: dartsBlick, pose: 'stehen', drinnen: true };
      }
      const L = dartsLinie;
      const hin = Math.min(1, f / 0.12), zur = f > 0.85 ? Math.min(1, (f - 0.85) / 0.12) : 0;
      const pos = warte.clone().lerp(L, hin).lerp(warte, zur);
      let pose = hin < 1 || zur > 0 ? 'gehen' : 'werfen', extra = 0;
      for (let k = 0; k < 3; k++) { const s = 0.22 + k * 0.15; if (f > s - 0.1 && f < s + 0.02) extra = (f - (s - 0.1)) / 0.12; }
      if (z.check && f > 0.6 && f < 0.85) pose = 'jubeln';
      if (z.summe >= 100 && f > 0.65 && f < 0.85) pose = 'jubeln';
      return { pos, blick: pose === 'gehen' ? (zur > 0 ? warte.clone().sub(L).normalize() : L.clone().sub(warte).normalize()) : dartsBlick, pose, extra, drinnen: true };
    },
  };
  function stand(z, nachher) {
    const rest = nachher ? z.nachher : z.vorher;
    const legs = nachher && z.legsNach ? z.legsNach : z.legs;
    return { leg: z.leg, spieler: NAMEN.map((n, i) => ({ name: n, rest: nachher && z.check ? 0 : rest[i], legs: legs[i] })) };
  }
}
let dartsLinie = new V3(), dartsBlick = new V3(1, 0, 0);

// =================================================================== Gassirunde
function gassiRunde(G, runde, t0, t1) {
  // Einstieg: nächster Punkt der Runde; dann einmal herum
  let k = 0, kd = 1e9; runde.forEach((p, i) => { const d = p.distanceTo(G); if (d < kd) { kd = d; k = i; } });
  const ring = [...runde.slice(k), ...runde.slice(0, k + 1)];
  const half = Math.floor(ring.length / 2);
  const hin = pfad([G, ...ring.slice(0, half + 1)]), zurueck = pfad([...ring.slice(half), G]);
  const tempo = 1.25 / 60 * 1000;   // m pro Minute → 75 m/min
  const dHin = hin.L / 75, dZur = zurueck.L / 75;
  const s0 = t0 + dHin, s1 = t1 - dZur;    // Spielphase dazwischen
  const spielOrt = ring[half];
  const versatz = { 0: 1.3, 1: -0.2, 2: -1.5 };
  const lag = { 0: 0, 1: 1.6, 2: 0.8 };
  return {
    position(m, wer) {
      const istHund = wer === 'hund';
      if (m < s0 || m >= s1) {
        const pf = m < s0 ? hin : zurueck, ta = m < s0 ? t0 : s1, tb = m < s0 ? s0 : t1;
        const s = (m - ta) / (tb - ta) - (istHund ? -0.012 : lag[wer] / pf.L);
        const { p, d } = pf.at(Math.max(0, Math.min(1, s)));
        const seite = new V3(-d.z, 0, d.x);
        let pos = p.clone().addScaledVector(seite, istHund ? Math.sin(m * 40) * 0.8 + 0.6 : versatz[wer]);
        if (istHund && Math.sin(m * 9) > 0.85) return { pos, blick: d, pose: 'schnueffeln', drinnen: false, leine: true };
        return { pos, blick: d, pose: 'gehen', drinnen: false, leine: istHund };
      }
      // Spielphase: Tino wirft den Ball, Hilde holt ihn
      const spieler = { 0: new V3(0, 0, 0), 1: new V3(2.2, 0, 1.4), 2: new V3(-1.8, 0, 2.0) };
      if (!istHund) {
        const pos = spielOrt.clone().add(spieler[wer]);
        const zyk = ((m - s0) * 60 / 14) % 1;
        const pose = wer === 0 && zyk < 0.08 ? 'werfen' : 'stehen';
        return { pos, blick: new V3(1, 0, -0.4).normalize(), pose, extra: zyk / 0.08, drinnen: false };
      }
      const n = Math.floor((m - s0) * 60 / 14), zyk = ((m - s0) * 60 / 14) % 1;
      const r = rng('ball' + n); const w = r() * 2.4 - 0.4, weit = 14 + r() * 12;
      const ziel = spielOrt.clone().add(new V3(Math.cos(w) * weit, 0, -Math.sin(w) * weit));
      const start = spielOrt.clone().add(new V3(0.8, 0, 0.3));
      let pos, blick, pose = 'rennen', ball = null;
      if (zyk < 0.08) { pos = start; blick = ziel.clone().sub(start).normalize(); pose = 'sitzen'; }
      else if (zyk < 0.45) { const f = (zyk - 0.08) / 0.37; pos = start.clone().lerp(ziel, f); blick = ziel.clone().sub(start).normalize(); ball = start.clone().lerp(ziel, Math.min(1, f * 1.5)); ball.y = 0.15 + Math.sin(Math.min(1, f * 1.5) * Math.PI) * 6; }
      else if (zyk < 0.52) { pos = ziel; blick = start.clone().sub(ziel).normalize(); pose = 'schnueffeln'; ball = ziel.clone().setY(0.15); }
      else if (zyk < 0.88) { const f = (zyk - 0.52) / 0.36; pos = ziel.clone().lerp(start, f); blick = start.clone().sub(ziel).normalize(); ball = pos.clone().add(blick.clone().multiplyScalar(0.75)).setY(0.62); }
      else { pos = start; blick = new V3(-1, 0, 0); pose = 'sitzen'; ball = start.clone().add(new V3(-0.7, 0.35, 0)); }
      return { pos, blick, pose, ball, drinnen: false };
    },
  };
}

// =================================================================== Straße zum Büro
function strassenRoute(strasse, q) {
  // längste zusammenhängende Linie über q; beide Enden liefern Anfahrtswege bis q
  const segs = strasse.map((s) => s.P);
  let best = null;
  for (const P of segs) { const i = P.findIndex((p) => p === q); if (i >= 0) best = { P, i }; }
  if (!best) return [[q], [q]];
  // an beiden Enden weitere Segmente anhängen
  const kette = [...best.P];
  let qi = best.i;
  const frei = segs.filter((s) => s !== best.P);
  for (let n = 0; n < 6; n++) {
    let ok = false;
    for (const s of frei) {
      const a = s[0], b = s.at(-1);
      if (a.distanceTo(kette.at(-1)) < 1) { kette.push(...s.slice(1)); frei.splice(frei.indexOf(s), 1); ok = true; break; }
      if (b.distanceTo(kette.at(-1)) < 1) { kette.push(...[...s].reverse().slice(1)); frei.splice(frei.indexOf(s), 1); ok = true; break; }
      if (b.distanceTo(kette[0]) < 1) { kette.unshift(...s.slice(0, -1)); qi += s.length - 1; frei.splice(frei.indexOf(s), 1); ok = true; break; }
      if (a.distanceTo(kette[0]) < 1) { kette.unshift(...[...s].reverse().slice(0, -1)); qi += s.length - 1; frei.splice(frei.indexOf(s), 1); ok = true; break; }
    }
    if (!ok) break;
  }
  // Rechtsverkehr: 1,7 m nach rechts versetzt
  const versetzt = (pts) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = b.clone().sub(a).normalize(); return p.clone().add(new THREE.Vector2(d.y, -d.x).multiplyScalar(1.7));
  });
  const vonAnfang = versetzt(kette.slice(0, qi + 1));
  const vonEnde = versetzt([...kette.slice(qi)].reverse());
  return [vonAnfang.length > 1 ? vonAnfang : vonEnde, vonEnde.length > 1 ? vonEnde : vonAnfang];
}

function statusText(m, env, { darts, gassi }) {
  if (!env.werktag) return env.spieltag ? 'Heimspiel-Tag am Borussia-Park' : 'Wochenende – das Büro ist leer';
  if (darts && m >= darts.t0 - 0.5 && m < darts.t1 + 0.5) return 'Mittagsdarts – 501, Double-Out';
  if (m >= hm(ABLAUF.gassi[0]) && m < hm(ABLAUF.gassi[1])) return 'Gassirunde mit Hilde ums Stadion';
  const h = m / 60;
  if (h < 7.6) return 'Noch ruhig im Büro';
  if (h < 8.6) return 'Ankommen, Kaffee, Posteingang';
  if (h < 12) return 'Konzentriertes Arbeiten';
  if (h < 17) return 'Nachmittag im Projektgeschäft';
  if (h < 18.2) return 'Feierabend in Sicht';
  return 'Feierabend';
}

export function setzeDartsGeometrie(linie, blick) { dartsLinie = linie; dartsBlick = blick; }
