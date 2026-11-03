// Figuren im Spielzeug-Look: Menschen, Labrador, Model Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { namensSchild } from './texturen.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const kapsel = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
function schatten(m) { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; }

export function person(p) {
  const root = new THREE.Group();
  const koerper = new THREE.Group(); root.add(koerper);
  const haut = mat(p.haut), shirt = mat(p.shirt), hose = mat(p.hose), schuh = mat(p.schuhe);
  const huefte = new THREE.Group(); huefte.position.y = 0.92; koerper.add(huefte);
  const beine = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(0, 0, s * 0.11);
    const b = new THREE.Mesh(kapsel(0.085, 0.72), hose); b.position.y = -0.44; g.add(b);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.12), schuh); f.position.set(0.05, -0.87, 0); g.add(f);
    huefte.add(g); return g;
  });
  const rumpf = new THREE.Mesh(kapsel(0.2, 0.42), shirt); rumpf.position.y = 0.3; rumpf.scale.set(0.85, 1, 1.12); huefte.add(rumpf);
  const schulter = new THREE.Group(); schulter.position.y = 0.55; huefte.add(schulter);
  const arme = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(0, 0, s * 0.27);
    const o = new THREE.Mesh(kapsel(0.07, 0.42), shirt); o.position.y = -0.24; g.add(o);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), haut); h.position.y = -0.52; g.add(h);
    schulter.add(g); return g;
  });
  const kopf = new THREE.Group(); kopf.position.y = 0.92; huefte.add(kopf);
  kopf.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), haut));
  const nase = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), haut); nase.position.set(0.17, -0.01, 0); kopf.add(nase);
  const auge = mat('#1b1b1b'); for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), auge); a.position.set(0.155, 0.04, s * 0.06); kopf.add(a); }
  const haar = mat(p.haar, { roughness: 0.9 });
  if (p.frisur === 'kurz') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.182, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), haar); h.rotation.z = 0.25; h.position.x = -0.02; kopf.add(h); }
  if (p.frisur === 'zopf' || p.frisur === 'lang') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), haar); h.rotation.z = 0.35; h.position.x = -0.02; kopf.add(h);
    const z = new THREE.Mesh(kapsel(0.07, p.frisur === 'zopf' ? 0.28 : 0.35), haar); z.position.set(-0.2, p.frisur === 'zopf' ? -0.08 : -0.15, 0); z.rotation.z = -0.3; kopf.add(z);
    root.userData.zopf = z;
  }
  if (p.bart) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, -Math.PI / 2, Math.PI, Math.PI * 0.45, Math.PI * 0.5), mat(p.bart, { roughness: 1 })); b.position.set(0.04, -0.03, 0); kopf.add(b); }
  if (p.brille) {
    const bm = mat('#111', { metalness: 0.5, roughness: 0.3 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14), bm); r.position.set(0.168, 0.04, s * 0.062); r.rotation.y = Math.PI / 2; kopf.add(r); }
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.04), bm); st.position.set(0.175, 0.045, 0); kopf.add(st);
  }
  // Namensschild
  const schild = new THREE.Sprite(new THREE.SpriteMaterial({ map: namensSchild(p.name), depthTest: false, transparent: true }));
  schild.scale.set(1.6, 0.6, 1); schild.position.y = 2.55; schild.renderOrder = 10; root.add(schild);
  root.scale.setScalar(1.15);
  schatten(root);
  return { root, koerper, huefte, beine, arme, kopf, schild, phase: Math.random() * 6 };
}

/** Pose anwenden. pose: 'gehen' | 'stehen' | 'sitzen' | 'werfen' | 'tippen' | 'jubeln' */
export function posiere(f, pose, z, extra = 0) {
  const { beine, arme, huefte, koerper, kopf } = f;
  const t = z + f.phase;
  let by = 0.92;
  beine.forEach((b) => (b.rotation.z = 0)); arme.forEach((a) => { a.rotation.z = 0; a.rotation.x = 0; });
  huefte.rotation.set(0, 0, 0); kopf.rotation.set(0, 0, 0); koerper.position.y = 0;
  if (pose === 'gehen') {
    const w = Math.sin(t * 7.5);
    beine[0].rotation.z = w * 0.55; beine[1].rotation.z = -w * 0.55;
    arme[0].rotation.z = -w * 0.5; arme[1].rotation.z = w * 0.5;
    koerper.position.y = Math.abs(Math.cos(t * 7.5)) * 0.05;
  } else if (pose === 'sitzen' || pose === 'tippen') {
    by = 0.55;
    beine.forEach((b) => (b.rotation.z = Math.PI / 2 - 0.05));
    arme.forEach((a, i) => { a.rotation.z = 1.05; a.rotation.x = (i ? -1 : 1) * 0.12; });
    if (pose === 'tippen') { arme[0].rotation.z += Math.sin(t * 18) * 0.06; arme[1].rotation.z += Math.cos(t * 16) * 0.06; kopf.rotation.y = Math.sin(t * 0.4) * 0.15; }
  } else if (pose === 'werfen') {
    // extra: 0..1 Wurfphase
    const k = extra < 0.6 ? extra / 0.6 : 1 - (extra - 0.6) / 0.4;
    arme[1].rotation.z = 1.4 + k * 0.9 - (extra > 0.55 && extra < 0.7 ? 1.2 : 0);
    beine[0].rotation.z = 0.25; beine[1].rotation.z = -0.15; huefte.rotation.z = -0.06;
  } else if (pose === 'jubeln') {
    arme.forEach((a, i) => { a.rotation.x = (i ? 1 : -1) * 2.6; });
    koerper.position.y = Math.abs(Math.sin(t * 9)) * 0.18;
  } else { // stehen
    arme[0].rotation.z = Math.sin(t * 1.3) * 0.04; arme[1].rotation.z = -Math.sin(t * 1.3) * 0.04;
    kopf.rotation.y = Math.sin(t * 0.37) * 0.35;
  }
  huefte.position.y = by;
}

export function hund(h) {
  const root = new THREE.Group(); const k = new THREE.Group(); root.add(k);
  const fell = mat(h.fell, { roughness: 0.95 }), dunkel = mat(h.fellDunkel, { roughness: 0.95 });
  const rumpf = new THREE.Mesh(kapsel(0.17, 0.52), fell); rumpf.rotation.z = Math.PI / 2; rumpf.position.y = 0.48; k.add(rumpf);
  const kopfG = new THREE.Group(); kopfG.position.set(0.42, 0.66, 0); k.add(kopfG);
  kopfG.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fell));
  const schnauze = new THREE.Mesh(kapsel(0.075, 0.12), fell); schnauze.rotation.z = Math.PI / 2; schnauze.position.set(0.14, -0.04, 0); kopfG.add(schnauze);
  const nase = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#2a1d18')); nase.position.set(0.25, -0.02, 0); kopfG.add(nase);
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dunkel); o.scale.set(0.6, 1.3, 0.35); o.position.set(-0.02, -0.04, s * 0.13); kopfG.add(o);
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), mat('#111')); a.position.set(0.1, 0.04, s * 0.06); kopfG.add(a);
  }
  const hb = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 16), mat(h.halsband)); hb.position.set(0.32, 0.6, 0); hb.rotation.y = Math.PI / 2; hb.rotation.x = 0.4; k.add(hb);
  const beine = [[0.24, 0.1], [0.24, -0.1], [-0.24, 0.1], [-0.24, -0.1]].map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0.42, z);
    const b = new THREE.Mesh(kapsel(0.05, 0.3), fell); b.position.y = -0.2; g.add(b); k.add(g); return g;
  });
  const rute = new THREE.Group(); rute.position.set(-0.43, 0.55, 0); k.add(rute);
  const r = new THREE.Mesh(kapsel(0.035, 0.32), fell); r.position.y = 0.17; rute.add(r); rute.rotation.z = -0.9;
  const schild = new THREE.Sprite(new THREE.SpriteMaterial({ map: namensSchild(h.name, '#efcf41'), depthTest: false, transparent: true }));
  schild.scale.set(1.6, 0.6, 1); schild.position.y = 1.55; schild.renderOrder = 10; root.add(schild);
  root.scale.setScalar(1.25);
  schatten(root);
  return { root, k, kopfG, beine, rute, schild };
}

/** pose: 'laufen' | 'rennen' | 'liegen' | 'sitzen' | 'stehen' | 'schnueffeln' */
export function posiereHund(d, pose, z) {
  const { k, beine, rute, kopfG } = d;
  k.position.y = 0; k.rotation.z = 0; kopfG.rotation.set(0, 0, 0);
  rute.rotation.x = Math.sin(z * 16) * 0.6;
  beine.forEach((b) => (b.rotation.z = 0, b.visible = true));
  if (pose === 'laufen' || pose === 'rennen') {
    const f = pose === 'rennen' ? 14 : 9, a = pose === 'rennen' ? 0.8 : 0.5;
    beine.forEach((b, i) => (b.rotation.z = Math.sin(z * f + (i === 0 || i === 3 ? 0 : Math.PI)) * a));
    k.position.y = Math.abs(Math.sin(z * f)) * (pose === 'rennen' ? 0.08 : 0.03);
    rute.rotation.x = Math.sin(z * 18) * 0.7;
  } else if (pose === 'liegen') {
    k.position.y = -0.3; beine.forEach((b) => (b.rotation.z = Math.PI / 2 * (b.position.x > 0 ? -1 : 1)));
    kopfG.rotation.z = -0.2 + Math.sin(z * 0.6) * 0.04; rute.rotation.x = Math.sin(z * 3) * 0.25;
  } else if (pose === 'sitzen') {
    k.rotation.z = 0.45; k.position.y = -0.12; beine[2].rotation.z = beine[3].rotation.z = -1.2; kopfG.rotation.z = -0.35;
  } else if (pose === 'schnueffeln') {
    kopfG.rotation.z = -0.7; kopfG.position.y = 0.6; k.rotation.z = -0.1;
  }
  if (pose !== 'schnueffeln') kopfG.position.y = 0.66;
}

/** Elektrischer Kompakt-SUV im Spielzeug-Stil (bewusst ohne Markenzeichen) */
export function auto(farbe) {
  const g = new THREE.Group();
  const lack = new THREE.MeshPhysicalMaterial({ color: farbe, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glas = new THREE.MeshPhysicalMaterial({ color: '#0d1316', metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  const schwarz = mat('#151617', { roughness: 0.6 });
  const shape = new THREE.Shape();
  // Seitenprofil (x vorne, y oben), Länge 4,75 m
  shape.moveTo(-2.37, 0.38); shape.lineTo(2.3, 0.38); shape.quadraticCurveTo(2.42, 0.45, 2.4, 0.72);
  shape.quadraticCurveTo(2.35, 0.95, 1.4, 1.02); shape.quadraticCurveTo(0.6, 1.58, -0.5, 1.6);
  shape.quadraticCurveTo(-1.9, 1.58, -2.3, 1.12); shape.quadraticCurveTo(-2.42, 0.8, -2.37, 0.38);
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1.86, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 14 });
  body.translate(0, 0, -0.93);
  const k = new THREE.Mesh(body, lack); g.add(k);
  // Glasdach + Seitenscheiben
  const gs = new THREE.Shape();
  gs.moveTo(1.25, 1.05); gs.quadraticCurveTo(0.55, 1.55, -0.5, 1.57); gs.quadraticCurveTo(-1.75, 1.55, -2.12, 1.12); gs.lineTo(1.25, 1.05);
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 1.9, bevelEnabled: false, curveSegments: 12 }); gg.translate(0, 0.02, -0.95);
  g.add(new THREE.Mesh(gg, glas));
  for (const [x, z] of [[1.45, 0.86], [1.45, -0.86], [-1.45, 0.86], [-1.45, -0.86]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18).rotateX(Math.PI / 2), schwarz); r.position.set(x, 0.4, z); g.add(r);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 10).rotateX(Math.PI / 2), mat('#9ea4a8', { metalness: 0.8, roughness: 0.3 })); f.position.set(x, 0.4, z); g.add(f);
  }
  const licht = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#e9f4ff'), emissiveIntensity: 0.2 });
  const rueck = new THREE.MeshStandardMaterial({ color: '#7a0a10', emissive: new THREE.Color('#ff1a24'), emissiveIntensity: 0.3 });
  const vl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 1.5), licht); vl.position.set(2.41, 0.8, 0); g.add(vl);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.7), rueck); hl.position.set(-2.4, 1.0, 0); g.add(hl);
  schatten(g);
  g.scale.setScalar(1.05);
  return { root: g, licht, rueck };
}

/** Verkehr: eine InstancedMesh für viele einfache Autos */
export function autoFlotte(n) {
  const body = mergeGeometries([
    new THREE.BoxGeometry(4.3, 0.75, 1.8).translate(0, 0.65, 0),
    new THREE.BoxGeometry(2.4, 0.6, 1.6).translate(-0.2, 1.3, 0),
  ]);
  const m = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), n);
  const front = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.18, 1.5), new THREE.MeshBasicMaterial({ color: '#fff4d6', toneMapped: false }), n);
  const heck = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.16, 1.5), new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }), n);
  m.castShadow = true;
  const FARBEN = ['#f2f2f2', '#1d1d1f', '#8a9097', '#2d4a7a', '#bfc4c8', '#5b6e57', '#b22a2a', '#e8e1d0', '#3a3f45', '#244b55'];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) m.setColorAt(i, c.set(FARBEN[i % FARBEN.length]));
  return { m, front, heck };
}
