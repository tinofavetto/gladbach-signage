// Bewegung in der Umgebung: Verkehr, Flugzeuge, Wildgänse, Fans am Spieltag, fallendes Laub.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { autoFlotte } from './figuren.js';
import { weichPunkt } from './texturen.js';

const V3 = THREE.Vector3;
const up = new V3(0, 1, 0);
const m40 = new THREE.Matrix4(), qq0 = new THREE.Quaternion();

function kette(strassen) {
  // Linien gleichen Namens zu langen Routen verbinden
  const gruppen = new Map();
  for (const s of strassen) {
    if (!['gross', 'mittel'].includes(s.klasse)) continue;
    const k = (s.n || '?') + s.klasse;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(s.P.map((p) => p.clone()));
  }
  const routen = [];
  for (const segs of gruppen.values()) {
    const frei = [...segs];
    while (frei.length) {
      const k = frei.shift();
      let ok = true;
      while (ok) {
        ok = false;
        for (let i = 0; i < frei.length; i++) {
          const s = frei[i];
          if (s[0].distanceTo(k.at(-1)) < 1) { k.push(...s.slice(1)); }
          else if (s.at(-1).distanceTo(k.at(-1)) < 1) { k.push(...[...s].reverse().slice(1)); }
          else if (s.at(-1).distanceTo(k[0]) < 1) { k.unshift(...s.slice(0, -1)); }
          else if (s[0].distanceTo(k[0]) < 1) { k.unshift(...[...s].reverse().slice(0, -1)); }
          else continue;
          frei.splice(i, 1); ok = true; break;
        }
      }
      let L = 0; for (let i = 1; i < k.length; i++) L += k[i - 1].distanceTo(k[i]);
      if (L > 80) routen.push({ P: k, L, w: segs.length });
    }
  }
  return routen;
}
function aufRoute(r, d, spur) {
  let rest = d;
  for (let i = 1; i < r.P.length; i++) {
    const a = r.P[i - 1], b = r.P[i], l = a.distanceTo(b);
    if (rest <= l || i === r.P.length - 1) {
      const f = Math.min(1, rest / l), dir = b.clone().sub(a).normalize();
      const p = a.clone().lerp(b, f).add(new THREE.Vector2(dir.y, -dir.x).multiplyScalar(spur));
      return { p: new V3(p.x, 0, -p.y), dir: new V3(dir.x, 0, -dir.y) };
    }
    rest -= l;
  }
}

export function baueLeben(scene, welt, stadion, q) {
  // ---------------- Verkehr
  const routen = kette(welt.strassen);
  const N = q === 'low' ? 24 : 46;
  const flotte = autoFlotte(N); scene.add(flotte.m, flotte.front, flotte.heck);
  const autos = Array.from({ length: N }, (_, i) => neu({}, true));
  function neu(a, mittendrin) {
    const r = routen[(Math.random() * routen.length) | 0];
    a.r = r; a.rueck = Math.random() < 0.5; a.v = 9 + Math.random() * 5; a.d = mittendrin ? Math.random() * r.L : 0; a.aktiv = true;
    a.r.gross = r.P.length > 1;
    return a;
  }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), s1 = new V3(1, 1, 1), s0 = new V3(0.001, 0.001, 0.001);

  // ---------------- Parkende Autos auf den Parkplätzen
  {
    const plaetze = [];
    const inP = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    for (const f of welt.flaechen) {
      if (f.k !== 'parking' || f.P.length < 3) continue;
      let best = 0, d = new THREE.Vector2(1, 0);
      for (let i = 0; i < f.P.length; i++) { const a = f.P[i], b = f.P[(i + 1) % f.P.length], l = a.distanceTo(b); if (l > best) { best = l; d = b.clone().sub(a).normalize(); } }
      const n = new THREE.Vector2(-d.y, d.x), o = f.P[0];
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const p of f.P) { const v = p.clone().sub(o), a = v.dot(d), b = v.dot(n); a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      for (let b = b0 + 3; b < b1 - 2; b += 6.2) for (let a = a0 + 2; a < a1 - 1.5; a += 2.7) {
        const p = o.clone().addScaledVector(d, a).addScaledVector(n, b);
        if (!inP(p.x, p.y, f.P) || welt.gebaeude.some((g) => inP(p.x, p.y, g.P))) continue;
        if (Math.random() < 0.5 && plaetze.length < 1400) plaetze.push([p, Math.atan2(n.x, n.y) + (Math.random() < 0.5 ? 0 : Math.PI)]);
      }
    }
    const pf = autoFlotte(Math.max(1, plaetze.length));
    plaetze.forEach(([p, w], i) => { qq0.setFromAxisAngle(up, w + Math.PI / 2); m40.compose(new V3(p.x, 0.32, -p.y), qq0, new V3(0.98, 0.98, 0.98)); pf.m.setMatrixAt(i, m40); });
    pf.m.receiveShadow = true; scene.add(pf.m);
  }

  // ---------------- Flugzeug mit Kondensstreifen
  const jet = new THREE.Group();
  const jm = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.4 });
  jet.add(new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 22, 4, 10).rotateZ(Math.PI / 2), jm));
  const fl = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 32), jm); fl.position.x = 1; jet.add(fl);
  const lw = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), jm); lw.position.set(-11, 2.5, 0); jet.add(lw);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b', toneMapped: false })); blink.position.y = -1.8; jet.add(blink);
  jet.visible = false; scene.add(jet);
  const SP = 140;
  const spur = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SP * 3), 3)),
    new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
  spur.frustumCulled = false; scene.add(spur);
  let jetStart = 20, jetDauer = 70, jetA = new V3(), jetB = new V3(), spurPunkte = [];

  // ---------------- Wildgänse (V-Formation)
  const gans = mergeGeometries([new THREE.ConeGeometry(0.35, 1.8, 5).rotateZ(-Math.PI / 2), new THREE.SphereGeometry(0.22, 6, 5).translate(1.0, 0.1, 0)]);
  const fluegelGeo = new THREE.PlaneGeometry(0.7, 1.9).translate(0, 0, 0.95).rotateX(-Math.PI / 2);
  const gm = new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 1, side: THREE.DoubleSide });
  const schwarm = new THREE.Group(); schwarm.visible = false; scene.add(schwarm);
  const gaense = [];
  for (let i = 0; i < 11; i++) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(gans, gm));
    const l = new THREE.Mesh(fluegelGeo, gm), r = new THREE.Mesh(fluegelGeo, gm); r.scale.z = -1;
    g.add(l, r); g.userData = { l, r, ph: Math.random() * 6 };
    const reihe = Math.ceil(i / 2), seite = i % 2 ? 1 : -1;
    g.position.set(-reihe * 4.5, Math.random(), seite * reihe * 3.6);
    g.scale.setScalar(2.2); schwarm.add(g); gaense.push(g);
  }
  let gStart = 35, gDauer = 60, gA = new V3(), gB = new V3();

  // ---------------- Fans am Spieltag
  const FN = q === 'low' ? 260 : 620;
  const fanGeo = mergeGeometries([new THREE.CapsuleGeometry(0.25, 1.0, 3, 6).translate(0, 0.75, 0), new THREE.SphereGeometry(0.2, 6, 5).translate(0, 1.6, 0)]);
  const fansM = new THREE.InstancedMesh(fanGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), FN);
  const pal = ['#1f8a4c', '#ffffff', '#111111', '#1f8a4c', '#1f8a4c', '#e9e9e9'].map((h) => new THREE.Color(h));
  const fans = [];
  const quellen = welt.strassen.filter((s) => s.klasse !== 'fuss' && s.P.length > 1).flatMap((s) => [s.P[0], s.P.at(-1)]).filter((p) => p.length() > welt.R * 0.55);
  for (let i = 0; i < FN; i++) {
    const s = quellen[(Math.random() * quellen.length) | 0] || new THREE.Vector2(300, 0);
    const z = stadion.eingaenge[(Math.random() * stadion.eingaenge.length) | 0];
    const start = new V3(s.x + (Math.random() - 0.5) * 8, 0.15, -s.y + (Math.random() - 0.5) * 8);
    const mitte = start.clone().lerp(z, 0.5).add(new V3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40));
    fans.push({ start, mitte, ziel: z.clone().setY(0.15), an: Math.random(), ab: Math.random(), ph: Math.random() * 6 });
    fansM.setColorAt(i, pal[(Math.random() * pal.length) | 0]);
  }
  fansM.castShadow = true; fansM.visible = false; scene.add(fansM);

  // ---------------- Laub im Herbst
  const LN = 260;
  const lp = new Float32Array(LN * 3), lc = new Float32Array(LN * 3);
  const lcol = ['#d08a2e', '#c4622d', '#e0b040', '#9a6b2e', '#b8452a'].map((h) => new THREE.Color(h));
  for (let i = 0; i < LN; i++) { lp.set([(Math.random() - 0.5) * 160, Math.random() * 30, (Math.random() - 0.5) * 160], i * 3); const c = lcol[i % 5]; lc.set([c.r, c.g, c.b], i * 3); }
  const lGeo = new THREE.BufferGeometry(); lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const laubMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { uZeit: { value: 0 }, uWind: { value: new THREE.Vector2() }, uPx: { value: 3 } },
    vertexShader: `uniform float uZeit; uniform vec2 uWind; uniform float uPx; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; float ph = position.x * 0.13 + position.z * 0.29;
        p.y = mod(p.y - uZeit * 1.6, 30.0);
        p.x += sin(uZeit * 1.3 + ph) * 2.5 + uWind.x * mod(uZeit * 3.0 + ph * 10.0, 40.0);
        p.z += cos(uZeit * 1.1 + ph) * 2.5 + uWind.y * mod(uZeit * 3.0 + ph * 10.0, 40.0);
        vC = color; vA = smoothstep(0.0, 3.0, p.y) * smoothstep(30.0, 24.0, p.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); gl_PointSize = uPx * (0.8 + fract(ph * 3.1)); }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; if (abs(d.x) + abs(d.y) > 0.5) discard; gl_FragColor = vec4(vC, vA); }',
  });
  const laub = new THREE.Points(lGeo, laubMat); laub.frustumCulled = false; laub.visible = !!welt.baeume.herbst; scene.add(laub);

  function update(z, dt, env) {
    const h = env.minute / 60;
    // Verkehr: Berufsverkehr dichter, nachts kaum
    const dichte = h < 5 ? 0.12 : h < 6.5 ? 0.35 : h < 9 ? 1 : h < 15.5 ? 0.6 : h < 18.5 ? 1 : h < 22 ? 0.45 : 0.18;
    const spiel = env.spiel ? 1 : 0;
    const aktiv = Math.round(N * Math.min(1, dichte + spiel * 0.4));
    autos.forEach((a, i) => {
      a.d += a.v * dt;
      if (a.d > a.r.L) neu(a, false);
      const d = a.rueck ? a.r.L - a.d : a.d;
      const { p, dir } = aufRoute(a.r, d, a.rueck ? -1.7 : 1.7);
      if (a.rueck) dir.negate();
      qq.setFromUnitVectors(new V3(1, 0, 0), dir);
      const ein = Math.min(1, a.d / 10, (a.r.L - a.d) / 10);
      const sicht = i < aktiv && ein > 0.05;
      const sc = sicht ? s1.clone().multiplyScalar(Math.max(0.2, ein)) : s0;
      p.y = 0.33;
      m4.compose(p, qq, sc); flotte.m.setMatrixAt(i, m4);
      const vorn = p.clone().addScaledVector(dir, 2.18).setY(0.75), hint = p.clone().addScaledVector(dir, -2.18).setY(0.8);
      const ls = sicht && env.nacht > 0.3 ? sc : s0;
      m4.compose(vorn, qq, ls); flotte.front.setMatrixAt(i, m4);
      m4.compose(hint, qq, ls); flotte.heck.setMatrixAt(i, m4);
    });
    flotte.m.instanceMatrix.needsUpdate = flotte.front.instanceMatrix.needsUpdate = flotte.heck.instanceMatrix.needsUpdate = true;

    // Flugzeug
    if (z > jetStart + jetDauer) {
      jetStart = z + 50 + Math.random() * 70; jetDauer = 55 + Math.random() * 20;
      const w = Math.random() * Math.PI * 2, R = welt.R * 1.9;
      jetA.set(Math.cos(w) * R, 300 + Math.random() * 80, Math.sin(w) * R);
      jetB.set(-Math.cos(w + 0.4) * R, jetA.y, -Math.sin(w + 0.4) * R);
      spurPunkte = [];
    }
    const jf = (z - jetStart) / jetDauer;
    jet.visible = jf >= 0 && jf <= 1;
    if (jet.visible) {
      jet.position.copy(jetA).lerp(jetB, jf);
      jet.quaternion.setFromUnitVectors(new V3(1, 0, 0), jetB.clone().sub(jetA).normalize());
      blink.visible = (z * 1.3 % 1) < 0.15;
      spurPunkte.push(jet.position.clone().add(jetB.clone().sub(jetA).normalize().multiplyScalar(-14)));
      if (spurPunkte.length > SP) spurPunkte.shift();
    }
    const arr = spur.geometry.attributes.position.array;
    for (let i = 0; i < SP; i++) { const p = spurPunkte[Math.max(0, Math.min(spurPunkte.length - 1, i))] || jet.position; arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }
    spur.geometry.attributes.position.needsUpdate = true;
    spur.visible = spurPunkte.length > 2 && env.nacht < 0.6 && env.truebe < 0.6;
    spur.material.opacity = 0.5 * (1 - env.truebe);

    // Gänse – nur tagsüber, im Herbst und Frühjahr häufiger
    if (z > gStart + gDauer) {
      gStart = z + (welt.baeume.herbst ? 40 : 110) + Math.random() * 60; gDauer = 50 + Math.random() * 15;
      const w = Math.random() * Math.PI * 2, R = welt.R * 1.5;
      gA.set(Math.cos(w) * R, 85 + Math.random() * 30, Math.sin(w) * R); gB.set(-Math.cos(w + 0.3) * R, gA.y, -Math.sin(w + 0.3) * R);
    }
    const gf = (z - gStart) / gDauer;
    schwarm.visible = gf >= 0 && gf <= 1 && env.nacht < 0.5;
    if (schwarm.visible) {
      schwarm.position.copy(gA).lerp(gB, gf);
      schwarm.quaternion.setFromUnitVectors(new V3(1, 0, 0), gB.clone().sub(gA).normalize());
      for (const g of gaense) { const f = Math.sin(z * 6 + g.userData.ph) * 0.6; g.userData.l.rotation.x = f; g.userData.r.rotation.x = -f; }
    }

    // Fans
    fansM.visible = !!env.spielInfo;
    if (fansM.visible) {
      const { anstoss } = env.spielInfo;      // Minuten relativ zum Anstoß (negativ = vorher)
      const t = anstoss;
      fans.forEach((f, i) => {
        let s = -1;
        const anT = -150 + f.an * 140, abT = 108 + f.ab * 45, dauer = 14;
        if (t >= anT && t < anT + dauer) s = (t - anT) / dauer;
        else if (t >= abT && t < abT + dauer) s = 1 - (t - abT) / dauer;
        if (s < 0) { m4.compose(new V3(0, -50, 0), qq.identity(), s0); fansM.setMatrixAt(i, m4); return; }
        const a = f.start.clone().lerp(f.mitte, s), b = f.mitte.clone().lerp(f.ziel, s), p = a.lerp(b, s);
        p.y = 0.15 + Math.abs(Math.sin(z * 8 + f.ph)) * 0.12;
        m4.compose(p, qq.identity(), s1); fansM.setMatrixAt(i, m4);
      });
      fansM.instanceMatrix.needsUpdate = true;
    }

    // Laub
    laub.visible = !!welt.baeume.herbst && env.pxScale > 6;
    if (laub.visible) {
      laubMat.uniforms.uZeit.value = z; laubMat.uniforms.uPx.value = Math.min(9, env.pxScale * 0.35);
      laubMat.uniforms.uWind.value.set(env.windVektor.x * env.wind * 0.08, env.windVektor.y * env.wind * 0.08);
      laub.position.set(env.ziel.x, 0, env.ziel.z);
    }
  }
  return { update };
}
