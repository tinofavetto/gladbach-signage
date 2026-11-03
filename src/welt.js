// Die statische Welt aus OpenStreetMap: Scheibe, Flächen, Straßen, Gebäude, Bäume, Stadion.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fensterTexturen, erdTextur, rasenTextur, lichtFleck } from './texturen.js';

export const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);   // OSM (Ost, Nord) → three
const C = (h) => new THREE.Color(h);

export function polyPts(p) { const a = []; for (let i = 0; i < p.length; i += 2) a.push(new THREE.Vector2(p[i], p[i + 1])); return a; }
function signedArea(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a.x * b.y - b.x * a.y; } return s / 2; }
export function centroid(P) { const c = new THREE.Vector2(); P.forEach((p) => c.add(p)); return c.divideScalar(P.length); }
function inPoly(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function faerben(geo, col) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
export function flaeche(P, h) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(P));
  g.rotateX(-Math.PI / 2); g.translate(0, h, 0);
  return g;
}
/** Wände eines Prismas mit Welt-UVs (u = Umfang in m, v = Höhe in m) */
export function waende(P, y0, y1) {
  if (signedArea(P) < 0) P = [...P].reverse();
  const pos = [], nor = [], uv = [];
  let u = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const L = a.distanceTo(b); if (L < 0.01) continue;
    const dx = b.x - a.x, dy = b.y - a.y, nx = dy / L, nz = dx / L;
    const A0 = [a.x, y0, -a.y], B0 = [b.x, y0, -b.y], B1 = [b.x, y1, -b.y], A1 = [a.x, y1, -a.y];
    for (const v of [A0, B0, B1, A0, B1, A1]) { pos.push(...v); nor.push(nx, 0, nz); }
    uv.push(u, y0, u + L, y0, u + L, y1, u, y0, u + L, y1, u, y1);
    u += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** Band entlang einer Linie (Straßen) */
function band(pts, w, h) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    let n = new THREE.Vector2(-d.y, d.x), k = w / 2;
    if (i > 0 && i < pts.length - 1) {
      const d1 = new THREE.Vector2(p.x - a.x, p.y - a.y).normalize(), n1 = new THREE.Vector2(-d1.y, d1.x);
      const cos = Math.max(0.35, n.dot(n1)); k = w / 2 / cos;
    }
    pos.push(p.x + n.x * k, h, -(p.y + n.y * k), p.x - n.x * k, h, -(p.y - n.y * k));
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g.toNonIndexed();
}

const FARBE = {
  boden: '#a7b07f', urban: '#cfc8b8', parking: '#a3a29c', grass: '#8fb35a', meadow: '#a6b863', forest: '#6e9446',
  scrub: '#86a455', farm: '#c9b56e', water: '#4b9fc4', pitch: '#62a344', dirt: '#b39a75',
};
const HOEHE = { urban: 0.03, farm: 0.05, meadow: 0.07, grass: 0.09, scrub: 0.1, forest: 0.11, dirt: 0.12, parking: 0.14, pitch: 0.15, water: 0.16 };

export function baueWelt(scene, OSM, q) {
  const R = OSM.radius;
  const welt = { R, materialien: {}, nacht: [], update: [] };
  const M = welt.materialien;

  // ---------------- Scheibe
  const erd = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.985, 34, 160, 1, true),
    new THREE.MeshStandardMaterial({ map: erdTextur(), roughness: 1 }));
  erd.position.y = -17; scene.add(erd);
  const boden = new THREE.Mesh(new THREE.CircleGeometry(R, 160).rotateX(-Math.PI / 2),
    M.boden = new THREE.MeshStandardMaterial({ color: FARBE.boden, roughness: 1 }));
  boden.receiveShadow = true; scene.add(boden);
  const unten = new THREE.Mesh(new THREE.CircleGeometry(R * 0.985, 160).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4a3a2b', roughness: 1 }));
  unten.position.y = -34; scene.add(unten);

  // ---------------- Flächen
  const flaechenGeo = [];
  const flaechen = [];
  for (const a of OSM.areas) {
    const P = polyPts(a.p);
    if (P.length < 3) continue;
    const col = C(FARBE[a.k] || FARBE.urban).offsetHSL(0, 0, (Math.random() - 0.5) * 0.03);
    flaechenGeo.push(faerben(flaeche(P, HOEHE[a.k] ?? 0.05), col));
    flaechen.push({ k: a.k, P });
  }
  const wasserGeo = [];
  const flMesh = new THREE.Mesh(mergeGeometries(flaechenGeo.filter((g, i) => flaechen[i].k !== 'water')),
    M.flaeche = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  flMesh.receiveShadow = true; scene.add(flMesh);
  flaechen.forEach((f, i) => { if (f.k === 'water') wasserGeo.push(flaechenGeo[i]); });
  if (wasserGeo.length) {
    M.wasser = new THREE.MeshStandardMaterial({ color: FARBE.water, roughness: 0.15, metalness: 0.1 });
    const w = new THREE.Mesh(mergeGeometries(wasserGeo), M.wasser); w.receiveShadow = true; scene.add(w);
  }
  welt.flaechen = flaechen;

  // ---------------- Straßen
  const KL = {
    gross: { k: ['primary', 'secondary', 'tertiary', 'trunk', 'motorway'], c: '#4a4d54', h: 0.32 },
    mittel: { k: ['unclassified', 'residential', 'living_street'], c: '#55585f', h: 0.3 },
    service: { k: ['service'], c: '#6a6c70', h: 0.26 },
    fuss: { k: ['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'track'], c: '#ddd2b9', h: 0.22 },
  };
  welt.strassen = [];
  for (const [name, kl] of Object.entries(KL)) {
    const geos = [];
    for (const r of OSM.roads) {
      if (!kl.k.includes(r.k)) continue;
      const P = polyPts(r.p);
      geos.push(band(P, r.w, kl.h));
      welt.strassen.push({ k: r.k, n: r.n, P, w: r.w, klasse: name });
    }
    if (!geos.length) continue;
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: kl.c, roughness: name === 'fuss' ? 1 : 0.9 }));
    m.receiveShadow = true; scene.add(m);
    if (name === 'gross' || name === 'mittel') (M.asphalt ||= []).push(m.material);
  }
  // Mittelstreifen auf großen Straßen
  {
    const geos = [];
    for (const s of welt.strassen) {
      if (s.klasse !== 'gross') continue;
      for (let i = 0; i < s.P.length - 1; i++) {
        const a = s.P[i], b = s.P[i + 1], L = a.distanceTo(b);
        for (let d = 2; d < L - 3; d += 9) {
          const p0 = a.clone().lerp(b, d / L), p1 = a.clone().lerp(b, Math.min(1, (d + 3.5) / L));
          geos.push(band([p0, p1], 0.22, 0.34));
        }
      }
    }
    if (geos.length) scene.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: '#e9e6dc' })));
  }

  // ---------------- Gebäude
  const [fTag, fNacht] = fensterTexturen(11);
  M.fassade = new THREE.MeshStandardMaterial({ vertexColors: true, map: fTag, emissiveMap: fNacht, emissive: C('#ffd59a'), emissiveIntensity: 0, roughness: 0.82 });
  M.wand = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  M.dach = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const WANDF = { office: '#eef0f0', commercial: '#f1ebe1', apartments: '#efe4d2', hotel: '#f3f0ea', retail: '#e8e2d7', military: '#d8cdb8', yes: '#ece6da' };
  const DACHF = ['#8d8f91', '#a19b92', '#7d8288', '#b4ada2', '#6f7479', '#9aa0a3'];
  const gF = [], gW = [], gD = [], aufbauten = [];
  welt.gebaeude = [];
  for (const b of OSM.buildings) {
    let P = polyPts(b.p); if (P.length < 3) continue;
    const h = b.h, klein = h < 5.5 || ['garage', 'garages', 'shed', 'guardhouse', 'kiosk', 'toilets'].includes(b.k);
    const wf = C(WANDF[b.k] || WANDF.yes).offsetHSL(0, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.06);
    if (b.n === 'Borussia-8-Grad') wf.set('#e4ece8');
    (klein ? gW : gF).push(faerben(waende(P, 0, h), wf));
    const df = C(DACHF[(Math.random() * DACHF.length) | 0]);
    gD.push(faerben(flaeche(P, h), df));
    // Attika
    if (!klein) gW.push(faerben(waende(P, h, h + 0.6), wf.clone().multiplyScalar(0.92)));
    const fl = Math.abs(signedArea(P));
    if (!klein && fl > 300) {
      const c = centroid(P); const n = Math.min(6, 1 + (fl / 500) | 0);
      for (let i = 0; i < n * 3 && aufbauten.length < 400; i++) {
        const x = c.x + (Math.random() - 0.5) * Math.sqrt(fl) * 0.6, y = c.y + (Math.random() - 0.5) * Math.sqrt(fl) * 0.6;
        if (inPoly(x, y, P)) aufbauten.push([x, y, h]);
        if (aufbauten.length % n === 0) break;
      }
    }
    welt.gebaeude.push({ P, h, k: b.k, n: b.n });
  }
  const gm = (arr, mat) => { if (!arr.length) return; const m = new THREE.Mesh(mergeGeometries(arr), mat); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  gm(gF, M.fassade); gm(gW, M.wand); gm(gD, M.dach);
  if (aufbauten.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#c9ccce', roughness: 0.6, metalness: 0.3 }), aufbauten.length);
    const m4 = new THREE.Matrix4();
    aufbauten.forEach(([x, y, h], i) => { const s = 1.4 + Math.random() * 2; m4.compose(W(x, y, h + 0.55), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3), new THREE.Vector3(s, 1.1, s * 0.7)); im.setMatrixAt(i, m4); });
    im.castShadow = true; scene.add(im);
  }

  // ---------------- Bäume (Herbst/Winter je nach Monat)
  welt.baeume = baueBaeume(scene, OSM, welt, q);

  // ---------------- Straßenlaternen
  welt.laternen = baueLaternen(scene, welt);

  return welt;
}

// ======================================================================= Bäume
function baueBaeume(scene, OSM, welt, q) {
  const punkte = [];
  const frei = (x, y) => Math.hypot(x, y) < welt.R - 5 && !welt.gebaeude.some((b) => inPoly(x, y, b.P)) &&
    !welt.strassen.some((s) => s.klasse !== 'fuss' && s.P.some((p, i) => i && distSeg(x, y, s.P[i - 1], p) < s.w / 2 + 2));
  for (const [x, y] of OSM.trees) punkte.push([x, y, 1]);
  for (const r of OSM.treerows) {
    const P = polyPts(r);
    for (let i = 1; i < P.length; i++) {
      const L = P[i - 1].distanceTo(P[i]);
      for (let d = 0; d < L; d += 8) { const p = P[i - 1].clone().lerp(P[i], d / L); punkte.push([p.x, p.y, 1]); }
    }
  }
  // Wald und Gebüsch auffüllen
  const dichte = q === 'low' ? 0.55 : 1;
  for (const f of welt.flaechen) {
    if (!['forest', 'scrub', 'grass', 'meadow'].includes(f.k)) continue;
    const abst = f.k === 'forest' ? 7 : f.k === 'scrub' ? 9 : f.k === 'grass' ? 34 : 45;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of f.P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (let x = minX; x < maxX; x += abst / dichte) for (let y = minY; y < maxY; y += abst / dichte) {
      const jx = x + (Math.random() - 0.5) * abst * 0.9, jy = y + (Math.random() - 0.5) * abst * 0.9;
      if (f.k === 'grass' && Math.random() < 0.55) continue;
      if (inPoly(jx, jy, f.P) && frei(jx, jy)) punkte.push([jx, jy, f.k === 'scrub' ? 0.55 : 1]);
    }
  }
  const N = punkte.length;
  const stamm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 5).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: '#6b5240', roughness: 1 }), N);
  const kroneGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(1, 1).translate(0, 0, 0),
    new THREE.IcosahedronGeometry(0.72, 0).translate(0.45, 0.45, 0.2),
    new THREE.IcosahedronGeometry(0.66, 0).translate(-0.4, 0.3, -0.3),
  ]);
  const kroneMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const wind = { uZeit: { value: 0 }, uWind: { value: 0.3 } };
  kroneMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, wind);
    s.vertexShader = 'uniform float uZeit; uniform float uWind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
      float sw = (sin(uZeit * 1.6 + ph) * 0.6 + sin(uZeit * 3.7 + ph * 2.0) * 0.25) * uWind;
      transformed.x += sw * (position.y + 1.0) * 0.22; transformed.z += sw * (position.y + 1.0) * 0.12;`);
  };
  const krone = new THREE.InstancedMesh(kroneGeo, kroneMat, N);
  const monat = new Date().getMonth() + 1;
  const herbst = ['#d08a2e', '#c4622d', '#e0b040', '#9a6b2e', '#b8452a', '#7f9a3e', '#5d8a3a'];
  const sommer = ['#5f9440', '#4f8636', '#6ea24a', '#47783a', '#7aa84f'];
  const winter = ['#8a7a66', '#7d6f5e', '#3f6b3e'];
  const palette = monat >= 10 && monat <= 11 ? herbst : monat === 12 || monat <= 2 ? winter : monat === 9 ? [...sommer, '#c79a3a'] : sommer;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), col = new THREE.Color();
  punkte.forEach(([x, y, g], i) => {
    const h = (4 + Math.random() * 4) * g, r = (2.2 + Math.random() * 1.8) * g;
    q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.3);
    m4.compose(W(x, y, 0), q4, new THREE.Vector3(1.2 * g, h * 0.65, 1.2 * g)); stamm.setMatrixAt(i, m4);
    const winterLaub = palette === winter;
    const s = winterLaub && Math.random() < 0.7 ? r * 0.75 : r;
    m4.compose(W(x, y, h * 0.62 + s * 0.7), q4, new THREE.Vector3(s, s * (0.95 + Math.random() * 0.3), s)); krone.setMatrixAt(i, m4);
    krone.setColorAt(i, col.set(palette[(Math.random() * palette.length) | 0]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06));
  });
  stamm.castShadow = krone.castShadow = true; krone.receiveShadow = true;
  scene.add(stamm, krone);
  return { wind, krone, kroneMat, anzahl: N, herbst: palette === herbst, winter: palette === winter, punkte };
}
function distSeg(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}

// ======================================================================= Laternen
function baueLaternen(scene, welt) {
  const pos = [];
  for (const s of welt.strassen) {
    if (!['gross', 'mittel'].includes(s.klasse)) continue;
    let acc = 14;
    for (let i = 1; i < s.P.length; i++) {
      const a = s.P[i - 1], b = s.P[i], L = a.distanceTo(b);
      const d = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize(), n = new THREE.Vector2(-d.y, d.x);
      while (acc < L) {
        const p = a.clone().lerp(b, acc / L).addScaledVector(n, s.w / 2 + 1.2);
        if (Math.hypot(p.x, p.y) < welt.R - 4 && !pos.some((o) => Math.hypot(o[0] - p.x, o[1] - p.y) < 18)) pos.push([p.x, p.y, -n.x, -n.y]);
        acc += 32;
      }
      acc -= L;
    }
  }
  const N = pos.length;
  const mast = new THREE.InstancedMesh(mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.13, 7, 5).translate(0, 3.5, 0),
    new THREE.BoxGeometry(0.12, 0.12, 1.4).translate(0, 7, 0.6),
  ]), new THREE.MeshStandardMaterial({ color: '#3c4148', roughness: 0.6, metalness: 0.4 }), N);
  const kopfMat = new THREE.MeshStandardMaterial({ color: '#d7d9da', emissive: C('#ffd08a'), emissiveIntensity: 0 });
  const kopf = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.8), kopfMat, N);
  const fleckMat = new THREE.MeshBasicMaterial({ map: lichtFleck(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fleck = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fleckMat, N);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  pos.forEach(([x, y, nx, ny], i) => {
    const ang = Math.atan2(nx, -ny);
    q4.setFromAxisAngle(up, ang);
    m4.compose(W(x, y, 0), q4, new THREE.Vector3(1, 1, 1)); mast.setMatrixAt(i, m4);
    const k = W(x, y, 6.92).add(new THREE.Vector3(nx * 1.2, 0, -ny * 1.2));
    m4.compose(k, q4, new THREE.Vector3(1, 1, 1)); kopf.setMatrixAt(i, m4);
    m4.compose(W(x + nx * 1.6, y + ny * 1.6, 0.4), new THREE.Quaternion(), new THREE.Vector3(16, 1, 16)); fleck.setMatrixAt(i, m4);
  });
  mast.castShadow = true;
  scene.add(mast, kopf, fleck);
  return { kopfMat, fleckMat, anzahl: N };
}
