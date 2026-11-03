// ista-Borussia-Park: Umriss und Spielfeld aus OSM, Ränge, Dach, Lauftext-Fassade, Flutlicht, Fans.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rasenTextur, canvas, weichPunkt } from './texturen.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function baueStadion(scene, OSM) {
  // --- Spielfeld-Rahmen
  const p = []; for (let i = 0; i < 8; i += 2) p.push(new THREE.Vector2(OSM.pitch[i], OSM.pitch[i + 1]));
  const e0 = p[0].distanceTo(p[1]), e1 = p[1].distanceTo(p[2]);
  const lang = e0 > e1 ? [p[0], p[1]] : [p[1], p[2]];
  const A = lang[1].clone().sub(lang[0]).normalize();
  const Cc = p.reduce((s, v) => s.add(v), new THREE.Vector2()).divideScalar(4);
  const phi = Math.atan2(A.y, A.x);
  const grp = new THREE.Group(); grp.position.set(Cc.x, 0, -Cc.y); grp.rotation.y = phi; scene.add(grp);
  const toLocal = (x, y) => { const dx = x - Cc.x, dy = y - Cc.y; return new THREE.Vector2(dx * A.x + dy * A.y, dx * A.y - dy * A.x); };

  const umriss = []; for (let i = 0; i < OSM.stadium.length; i += 2) umriss.push(toLocal(OSM.stadium[i], OSM.stadium[i + 1]));
  const strahl = (dx, dz) => {   // weitester Schnitt eines Strahls aus der Mitte mit dem Umriss
    let best = 0;
    for (let i = 0; i < umriss.length; i++) {
      const a = umriss[i], b = umriss[(i + 1) % umriss.length];
      const ex = b.x - a.x, ez = b.y - a.y, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = (a.x * ez - a.y * ex) / den, u = (a.x * dz - a.y * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    return best;
  };

  const N = 120, HL = 52.5 + 9, HB = 34 + 8, EXP = 5.5;
  const innen = [], aussen = [], ang = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const r = 1 / Math.pow(Math.pow(Math.abs(c) / HL, EXP) + Math.pow(Math.abs(s) / HB, EXP), 1 / EXP);
    let ro = strahl(c, s) - 3; if (ro < r + 18) ro = r + 18;
    innen.push(r); aussen.push(Math.min(ro, r + 46)); ang.push(t);
  }
  // Außenkontur glätten
  const glatt = aussen.map((_, i) => (aussen[(i - 2 + N) % N] + aussen[(i - 1 + N) % N] * 2 + aussen[i] * 3 + aussen[(i + 1) % N] * 2 + aussen[(i + 2) % N]) / 9);
  const pt = (i, r, h) => { const k = i % N; return new THREE.Vector3(Math.cos(ang[k]) * r, h, Math.sin(ang[k]) * r); };
  const rad = (i, t) => lerp(innen[i % N], glatt[i % N] - 2, t);

  // --- Ränge (Stufen)
  const K = 16, HMAX = 24;
  const pos = [], col = [];
  const cc = new THREE.Color();
  const quad = (a, b, c, d, f) => { pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()); for (let j = 0; j < 6; j++) col.push(f.r, f.g, f.b); };
  const hoehe = (t) => 1.2 + HMAX * Math.pow(t, 1.08);
  const sitzplaetze = [];
  for (let k = 0; k < K; k++) {
    const t0 = k / K, t1 = (k + 1) / K;
    for (let i = 0; i < N; i++) {
      const sektor = Math.floor(i / (N / 24));
      const unterrang = k < 7;
      let f = unterrang ? (sektor % 6 === 0 ? '#f0f0ee' : '#1c7a46') : (sektor % 2 ? '#14171a' : '#1a6b3e');
      if (k === 7) f = '#d9dcd9';
      cc.set(f).offsetHSL(0, 0, ((k % 2) - 0.5) * 0.03);
      const h0 = hoehe(t0), h1 = hoehe(t1);
      quad(pt(i, rad(i, t0), h0), pt(i + 1, rad(i + 1, t0), h0), pt(i + 1, rad(i + 1, t0), h1), pt(i, rad(i, t0), h1), new THREE.Color('#7b807d'));
      quad(pt(i, rad(i, t0), h1), pt(i + 1, rad(i + 1, t0), h1), pt(i + 1, rad(i + 1, t1), h1), pt(i, rad(i, t1), h1), cc);
      if (k < 9 && i % 1 === 0) for (let j = 0; j < 3; j++) sitzplaetze.push([i + j / 3, (t0 + t1) / 2, h1]);
    }
  }
  // Rückwand / Fassade
  const HF = 27;
  for (let i = 0; i < N; i++) {
    const r0 = glatt[i % N] - 2, r1 = glatt[(i + 1) % N] - 2;
    quad(pt(i, r0, hoehe(1)), pt(i + 1, r1, hoehe(1)), pt(i + 1, r1, HF), pt(i, r0, HF), new THREE.Color('#cfd3d1'));
  }
  // Innenraum-Boden um das Feld
  const geoR = new THREE.BufferGeometry();
  geoR.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geoR.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geoR.computeVertexNormals();
  const raenge = new THREE.Mesh(geoR, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  raenge.castShadow = raenge.receiveShadow = true; grp.add(raenge);

  const vorfeld = new THREE.Mesh(new THREE.PlaneGeometry(HL * 2 + 4, HB * 2 + 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3f7f38', roughness: 1 }));
  vorfeld.position.y = 0.2; vorfeld.receiveShadow = true; grp.add(vorfeld);
  const rasenMat = new THREE.MeshStandardMaterial({ map: rasenTextur(), roughness: 0.95, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  rasenMat.emissiveMap = rasenMat.map;
  const rasen = new THREE.Mesh(new THREE.PlaneGeometry(113, 76).rotateX(-Math.PI / 2), rasenMat);
  rasen.position.y = 0.25; rasen.receiveShadow = true; grp.add(rasen);

  // Tore
  const torMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const g = mergeGeometries([
      new THREE.BoxGeometry(0.15, 2.44, 0.15).translate(0, 1.22, -3.66), new THREE.BoxGeometry(0.15, 2.44, 0.15).translate(0, 1.22, 3.66),
      new THREE.BoxGeometry(0.15, 0.15, 7.47).translate(0, 2.44, 0),
    ]);
    const tor = new THREE.Mesh(g, torMat); tor.position.set(sx * 52.5, 0.25, 0); tor.castShadow = true; grp.add(tor);
    const netz = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 7.3), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, wireframe: true }));
    netz.position.set(sx * 53.6, 1.45, 0); grp.add(netz);
  }

  // --- Dach
  const tIn = 0.36, dpos = [];
  const dq = (a, b, c, d) => dpos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
  for (let i = 0; i < N; i++) {
    const ri0 = rad(i, tIn), ri1 = rad(i + 1, tIn), ro0 = glatt[i % N] + 3, ro1 = glatt[(i + 1) % N] + 3;
    dq(pt(i, ri0, 31.2), pt(i + 1, ri1, 31.2), pt(i + 1, ro1, 33.4), pt(i, ro0, 33.4));
    dq(pt(i, ri0, 30), pt(i + 1, ri1, 30), pt(i + 1, ri1, 31.2), pt(i, ri0, 31.2));
    dq(pt(i, ro0, 30.5), pt(i + 1, ro1, 30.5), pt(i + 1, ro1, 33.4), pt(i, ro0, 33.4));
  }
  const dachGeo = new THREE.BufferGeometry(); dachGeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3)); dachGeo.computeVertexNormals();
  const dachMat = new THREE.MeshStandardMaterial({ color: '#eef1ef', roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, emissive: new THREE.Color('#9fb8c8'), emissiveIntensity: 0 });
  const dach = new THREE.Mesh(dachGeo, dachMat);
  dach.castShadow = dach.receiveShadow = true; grp.add(dach);
  // Dachträger (Rippen) für Struktur
  const rippen = [];
  for (let i = 0; i < N; i += 4) {
    const a = pt(i, rad(i, tIn), 31.6), b = pt(i, glatt[i % N] + 3, 33.8);
    const L = a.distanceTo(b);
    const g = new THREE.BoxGeometry(0.6, 0.7, L); g.lookAt(b.clone().sub(a)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    rippen.push(g);
  }
  const rip = new THREE.Mesh(mergeGeometries(rippen), new THREE.MeshStandardMaterial({ color: '#c3c9c7', roughness: 0.5, metalness: 0.3 }));
  rip.castShadow = true; grp.add(rip);
  // Stützen außen
  const stuetzen = [];
  for (let i = 0; i < N; i += 3) { const a = pt(i, glatt[i % N] + 1.5, 0); stuetzen.push(new THREE.CylinderGeometry(0.45, 0.45, 31, 6).translate(a.x, 15.5, a.z)); }
  grp.add(Object.assign(new THREE.Mesh(mergeGeometries(stuetzen), new THREE.MeshStandardMaterial({ color: '#d5d9d7', roughness: 0.6 })), { castShadow: true }));

  // Flutlicht-Kante unter dem Dach
  const lichtPts = []; for (let i = 0; i <= N; i++) lichtPts.push(pt(i, rad(i, tIn) + 0.6, 29.8));
  const flutMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff6e0'), emissiveIntensity: 0 });
  const flut = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lichtPts, true), 240, 0.5, 5, true), flutMat);
  grp.add(flut);
  const spot = new THREE.SpotLight('#fff3dc', 0, 300, 0.75, 0.6, 2);
  spot.position.set(0, 120, 0); spot.target.position.set(0, 0, 0); grp.add(spot, spot.target);

  // --- Lauftext-Fassade (Medienband)
  const [bc, bg] = canvas(4096, 80);
  const bandTex = new THREE.CanvasTexture(bc); bandTex.colorSpace = THREE.SRGBColorSpace; bandTex.wrapS = THREE.RepeatWrapping; bandTex.anisotropy = 8;
  const bpos = [], buv = []; let u = 0;
  for (let i = 0; i < N; i++) {
    const a0 = pt(i, glatt[i % N] - 1.85, 0), a1 = pt(i + 1, glatt[(i + 1) % N] - 1.85, 0);
    const L = a0.distanceTo(a1);
    const y0 = 18.5, y1 = 22.5;
    bpos.push(a0.x, y0, a0.z, a1.x, y0, a1.z, a1.x, y1, a1.z, a0.x, y0, a0.z, a1.x, y1, a1.z, a0.x, y1, a0.z);
    buv.push(u, 0, u + L, 0, u + L, 1, u, 0, u + L, 1, u, 1); u += L;
  }
  const bandGeo = new THREE.BufferGeometry(); bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bandGeo.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2)); bandGeo.computeVertexNormals();
  bandTex.repeat.set(-1 / 230, 1);
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex, side: THREE.DoubleSide, toneMapped: false });
  const bandMesh = new THREE.Mesh(bandGeo, bandMat); grp.add(bandMesh);
  // dunkles Glasband unten (Umlauf)
  const gpos = [];
  for (let i = 0; i < N; i++) {
    const a0 = pt(i, glatt[i % N] - 1.9, 0), a1 = pt(i + 1, glatt[(i + 1) % N] - 1.9, 0);
    gpos.push(a0.x, 0, a0.z, a1.x, 0, a1.z, a1.x, 8, a1.z, a0.x, 0, a0.z, a1.x, 8, a1.z, a0.x, 8, a0.z);
  }
  const glasGeo = new THREE.BufferGeometry(); glasGeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); glasGeo.computeVertexNormals();
  const glasMat = new THREE.MeshStandardMaterial({ color: '#2f4a4c', roughness: 0.2, metalness: 0.4, emissive: new THREE.Color('#ffd7a0'), emissiveIntensity: 0, side: THREE.DoubleSide });
  grp.add(new THREE.Mesh(glasGeo, glasMat));

  function bandText(text) {
    bg.fillStyle = '#071510'; bg.fillRect(0, 0, 4096, 80);
    bg.font = '800 50px "Big Shoulders Display", Inter, Arial'; bg.textBaseline = 'middle';
    let x = 20; const teile = text.split('·').map((s) => s.trim()).filter(Boolean);
    let k = 0;
    while (x < 4096) {
      const t = teile[k % teile.length]; k++;
      bg.fillStyle = k % 3 === 1 ? '#ffffff' : k % 3 === 2 ? '#3fd07d' : '#e8e8e8';
      bg.fillText(t.toUpperCase(), x, 43); x += bg.measureText(t.toUpperCase()).width + 40;
      bg.fillStyle = '#3fd07d'; bg.beginPath(); bg.arc(x - 20, 41, 6, 0, 7); bg.fill();
      x += 22;
    }
    bandTex.needsUpdate = true;
  }
  bandText('Borussia-Park · Mönchengladbach');

  // --- Fahnen am Eingang (zeigen zur Kamera / nach Südosten)
  const fahnen = [];
  const [fc, fg] = canvas(128, 64);
  ['#111', '#fff', '#1f8a4c', '#fff', '#111'].forEach((f, i) => { fg.fillStyle = f; fg.fillRect(0, i * 64 / 5, 128, 64 / 5 + 1); });
  const fTex = new THREE.CanvasTexture(fc); fTex.colorSpace = THREE.SRGBColorSpace;
  const fMat = new THREE.MeshStandardMaterial({ map: fTex, side: THREE.DoubleSide, roughness: 0.8 });
  const iF = Math.round(N * 0.83);
  for (let j = 0; j < 6; j++) {
    const k = iF + j * 2, r = glatt[k % N] + 9;
    const basis = pt(k, r, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 12, 6), new THREE.MeshStandardMaterial({ color: '#cfd4d6', metalness: 0.6, roughness: 0.3 }));
    mast.position.set(basis.x, 6, basis.z); mast.castShadow = true; grp.add(mast);
    const geo = new THREE.PlaneGeometry(3.6, 1.8, 12, 3); geo.translate(1.8, 0, 0);
    const f = new THREE.Mesh(geo, fMat); f.position.set(basis.x, 10.9, basis.z); f.castShadow = true; grp.add(f);
    fahnen.push({ f, basis: geo.attributes.position.array.slice(), ph: j * 0.7 });
  }

  // --- Fans auf den Rängen (nur bei Heimspiel) mit La-Ola
  const fanPos = [], fanCol = [], fanAng = [];
  const pal = ['#1f8a4c', '#ffffff', '#111111', '#1f8a4c', '#2bb162', '#dddddd'].map((h) => new THREE.Color(h));
  for (const [ii, t, h] of sitzplaetze) {
    const i = Math.floor(ii), f = ii - i;
    const r = lerp(rad(i, t), rad(i + 1, t), f), a = lerp(ang[i % N], i + 1 === N ? Math.PI * 2 : ang[(i + 1) % N], f);
    fanPos.push(Math.cos(a) * r, h + 0.5, Math.sin(a) * r); fanAng.push(a);
    const c = pal[(Math.random() * pal.length) | 0]; fanCol.push(c.r, c.g, c.b);
  }
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(fanPos, 3));
  fanGeo.setAttribute('color', new THREE.Float32BufferAttribute(fanCol, 3));
  fanGeo.setAttribute('winkel', new THREE.Float32BufferAttribute(fanAng, 1));
  const fanMat = new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 }, uPx: { value: 3 }, uHell: { value: 1 } },
    vertexColors: true,
    vertexShader: `attribute float winkel; uniform float uZeit; uniform float uPx; varying vec3 vC;
      void main(){ vec3 p = position; float w = pow(max(0.0, sin(winkel - uZeit*0.9)), 10.0);
        p.y += w * 1.4 + sin(uZeit*7.0 + winkel*40.0)*0.08; vC = color * (0.75 + w*0.6);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); gl_PointSize = uPx; }`,
    fragmentShader: 'uniform float uHell; varying vec3 vC; void main(){ gl_FragColor = vec4(vC*uHell,1.0); }',
  });
  const fans = new THREE.Points(fanGeo, fanMat); fans.visible = false; grp.add(fans);
  // Blitzlichter
  const blitzGeo = new THREE.BufferGeometry(); const bp = new Float32Array(60 * 3); blitzGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const blitz = new THREE.Points(blitzGeo, new THREE.PointsMaterial({ map: weichPunkt(), size: 3, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  blitz.visible = false; grp.add(blitz);

  // --- Spieler und Ball (nur während des Spiels)
  const spielerGeo = mergeGeometries([new THREE.CapsuleGeometry(0.32, 1.1, 3, 6).translate(0, 0.9, 0), new THREE.SphereGeometry(0.24, 8, 6).translate(0, 1.85, 0)]);
  const spielerM = new THREE.InstancedMesh(spielerGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 23);
  const FORM = [[-50, 0], [-36, -22], [-38, -7], [-38, 7], [-36, 22], [-20, -14], [-22, 0], [-20, 14], [-6, -24], [-4, 0], [-6, 24]];
  const kits = [new THREE.Color('#f4f4f4'), new THREE.Color('#d8323a')];
  for (let i = 0; i < 22; i++) spielerM.setColorAt(i, i === 0 ? new THREE.Color('#e9d84a') : i === 11 ? new THREE.Color('#2e6ad1') : kits[i < 11 ? 0 : 1]);
  spielerM.setColorAt(22, new THREE.Color('#111'));
  spielerM.castShadow = true; spielerM.visible = false; grp.add(spielerM);
  const ballM = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.4 }));
  ballM.visible = false; grp.add(ballM);
  const spPos = Array.from({ length: 23 }, () => new THREE.Vector3());
  const mS = new THREE.Matrix4(), qS = new THREE.Quaternion(), eins = new THREE.Vector3(1, 1, 1);

  // --- Mähroboter
  const robo = new THREE.Group();
  robo.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.8), new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.4 })), { castShadow: true }));
  const roboLicht = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#33ff88' })); roboLicht.position.y = 0.25; robo.add(roboLicht);
  robo.position.y = 0.42; robo.visible = false; grp.add(robo);

  const zentrum = new THREE.Vector3(Cc.x, 0, -Cc.y);
  // Eingänge (Weltkoordinaten) für Fans
  const eingaenge = [];
  for (let i = 0; i < N; i += 10) eingaenge.push(grp.localToWorld(pt(i, glatt[i % N] + 4, 0)));
  grp.updateMatrixWorld(true);
  for (let i = 0, k = 0; i < N; i += 10, k++) eingaenge[k] = grp.localToWorld(pt(i, glatt[i % N] + 4, 0));
  // Rundweg für den Hundespaziergang (Welt)
  const runde = [];
  for (let i = 0; i < N; i += 2) runde.push(grp.localToWorld(pt(i, glatt[i % N] + 44, 0)));

  return {
    zentrum, gruppe: grp, eingaenge, runde, radius: Math.max(...glatt),
    bandText,
    update(dt, z, env) {
      bandTex.offset.x = (z * 0.012) % 1;
      // Fahnen
      const wind = 0.4 + Math.min(1.6, (env.wind || 10) / 18);
      for (const fl of fahnen) {
        const a = fl.f.geometry.attributes.position, b = fl.basis;
        for (let i = 0; i < a.count; i++) {
          const x = b[i * 3], k = x / 3.6;
          a.setZ(i, Math.sin(z * 4 * wind + x * 1.6 + fl.ph) * 0.35 * k * wind);
          a.setY(i, b[i * 3 + 1] - k * k * (1.4 - Math.min(1.2, wind * 0.6)));
        }
        a.needsUpdate = true; fl.f.geometry.computeVertexNormals();
        fl.f.rotation.y = -(env.windRichtung || 240) * Math.PI / 180 + Math.PI / 2 - phi + Math.PI;
      }
      // Licht
      const spiel = env.spiel;     // 'vor' | 'laeuft' | 'nach' | null
      const nacht = env.nacht;
      const flutAn = spiel === 'laeuft' || (spiel && nacht > 0.3) ? 1 : 0;
      flutMat.emissiveIntensity = lerp(flutMat.emissiveIntensity, flutAn ? 2.5 : nacht * 0.3, 0.05);
      dachMat.emissiveIntensity = nacht * (0.12 + flutAn * 0.25);
      spot.intensity = lerp(spot.intensity, flutAn * nacht * 45000, 0.05);
      rasenMat.emissiveIntensity = lerp(rasenMat.emissiveIntensity, flutAn * nacht * 0.3, 0.05);
      glasMat.emissiveIntensity = nacht * 0.9;
      bandMat.color.setScalar(0.75 + 0.25 * nacht);
      fans.visible = spiel === 'laeuft' || spiel === 'vor';
      fanMat.uniforms.uZeit.value = z; fanMat.uniforms.uPx.value = Math.max(1.5, env.pxScale * 1.1); fanMat.uniforms.uHell.value = 0.5 + 0.3 * (1 - nacht) + flutAn * 0.12;
      blitz.visible = spiel === 'laeuft';
      if (blitz.visible) {
        for (let i = 0; i < 60; i++) {
          if (Math.random() < 0.08) { const j = (Math.random() * fanPos.length / 3) | 0; bp[i * 3] = fanPos[j * 3]; bp[i * 3 + 1] = fanPos[j * 3 + 1] + 0.5; bp[i * 3 + 2] = fanPos[j * 3 + 2]; }
          else if (Math.random() < 0.3) bp[i * 3 + 1] = -100;
        }
        blitzGeo.attributes.position.needsUpdate = true;
      }
      // Spieler: Ball wandert, Mannschaften verschieben mit
      spielerM.visible = ballM.visible = spiel === 'laeuft' && env.spielInfo && (env.spielInfo.anstoss < 47 || env.spielInfo.anstoss > 62);
      if (spielerM.visible) {
        const bx = Math.sin(z * 0.23) * 38 + Math.sin(z * 0.71) * 12, bz = Math.sin(z * 0.31 + 1) * 22 + Math.sin(z * 0.9) * 8;
        ballM.position.set(bx, 0.6 + Math.abs(Math.sin(z * 2.1)) * 1.2, bz);
        for (let i = 0; i < 23; i++) {
          let ziel;
          if (i === 22) ziel = new THREE.Vector3(bx - 6, 0.25, bz + 5);     // Schiri
          else {
            const t = i < 11 ? 1 : -1, [fx, fz] = FORM[i % 11];
            ziel = new THREE.Vector3(t * fx + bx * 0.45, 0.25, fz * 0.9 + bz * 0.25);
            if (i % 11 > 7 && i % 11 !== 0) ziel.lerp(new THREE.Vector3(bx, 0.25, bz), 0.35);
          }
          spPos[i].lerp(ziel, Math.min(1, dt * 0.9));
          spPos[i].y = 0.25;
          mS.compose(spPos[i], qS, eins); spielerM.setMatrixAt(i, mS);
        }
        spielerM.instanceMatrix.needsUpdate = true;
      }
      // Mähroboter: Bahnen ziehen, werktags 9–12 Uhr ohne Spiel
      robo.visible = env.maehen;
      if (robo.visible) {
        const bahn = 3.2, nb = Math.floor(68 / bahn), dauer = 30, T = (z / dauer) % nb, b = Math.floor(T), f = T - b;
        const x = (b % 2 ? 1 - f : f) * 100 - 50, y = -32 + b * bahn;
        robo.position.x = x; robo.position.z = y; robo.rotation.y = b % 2 ? Math.PI : 0;
        roboLicht.visible = (z * 2 | 0) % 2 === 0;
      }
    },
  };
}
