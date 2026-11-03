// Himmel, Licht und Wetter: Sonnenstand in Echtzeit, Mond mit Phase, Sterne, Wolken, Regen, Schnee, Gewitter, Nebel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, weichPunkt } from './texturen.js';
import { sonne, mond } from './zeit.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.clone().lerp(b, t);
const C = (h) => new THREE.Color(h);

// Himmelsfarben (oben, Horizont) je Sonnenhöhe in Grad
const STUFEN = [
  [-18, C('#05070f'), C('#0b1222')],
  [-8, C('#0b1430'), C('#2a2a4a')],
  [-3, C('#24315e'), C('#c0607a')],
  [1, C('#40609a'), C('#ff9a62')],
  [6, C('#5f8cc4'), C('#ffd2a0')],
  [15, C('#6aa3dc'), C('#cfe3f0')],
  [40, C('#4f93d8'), C('#d6ecf7')],
];
function himmelsFarbe(alt) {
  for (let i = 1; i < STUFEN.length; i++) {
    if (alt <= STUFEN[i][0]) {
      const [a0, o0, h0] = STUFEN[i - 1], [a1, o1, h1] = STUFEN[i];
      const t = sm(a0, a1, alt); return [mix(o0, o1, t), mix(h0, h1, t)];
    }
  }
  return [STUFEN.at(-1)[1].clone(), STUFEN.at(-1)[2].clone()];
}

export function baueHimmel(scene, R, q) {
  const [hc, hg] = canvas(16, 512);
  const [sc, sg] = canvas(1024, 576);
  const hTex = new THREE.CanvasTexture(sc); hTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = hTex;
  const sterne = Array.from({ length: 420 }, () => [Math.random(), Math.random() * 0.75, Math.random() * 1.4 + 0.3, Math.random() * 6]);

  // Licht
  const sonneL = new THREE.DirectionalLight('#fff3e0', 3);
  sonneL.castShadow = true;
  const S = q === 'low' ? 2048 : 4096;
  sonneL.shadow.mapSize.set(S, S);
  sonneL.shadow.bias = -0.0004; sonneL.shadow.normalBias = 0.6;
  sonneL.shadow.camera.near = 10; sonneL.shadow.camera.far = 2400;
  scene.add(sonneL, sonneL.target);
  const mondL = new THREE.DirectionalLight('#9fb6ff', 0);
  scene.add(mondL, mondL.target);
  const hemi = new THREE.HemisphereLight('#cfe6ff', '#6b6248', 1.2);
  scene.add(hemi);
  const blitzL = new THREE.AmbientLight('#dfe8ff', 0); scene.add(blitzL);

  // Wolken
  const wolkenMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.94 });
  const wolken = [];
  const wolkenGrp = new THREE.Group(); scene.add(wolkenGrp);
  for (let i = 0; i < 22; i++) {
    const n = 5 + (Math.random() * 6 | 0), teile = [];
    for (let k = 0; k < n; k++) {
      const s = 10 + Math.random() * 16;
      const b = new THREE.IcosahedronGeometry(s, 1);
      b.scale(1, 0.62, 1); b.translate((k - n / 2) * 11 + Math.random() * 6, Math.random() * 6, (Math.random() - 0.5) * 22);
      teile.push(b);
    }
    const w = new THREE.Mesh(mergeGeometries(teile), wolkenMat); w.castShadow = true;
    w.position.set((Math.random() - 0.5) * R * 2.6, 150 + Math.random() * 60, (Math.random() - 0.5) * R * 2.6);
    w.userData.v = 0.6 + Math.random() * 0.8;
    wolkenGrp.add(w); wolken.push(w);
  }

  // Niederschlag (GPU-animiert)
  const FL = { w: R * 2.2, h: 260 };
  const regenN = q === 'low' ? 5000 : 12000;
  const rp = new Float32Array(regenN * 2 * 3), rs = new Float32Array(regenN * 2), ro = new Float32Array(regenN * 2);
  for (let i = 0; i < regenN; i++) {
    const x = (Math.random() - 0.5) * FL.w, y = Math.random() * FL.h, z = (Math.random() - 0.5) * FL.w, sp = 0.8 + Math.random() * 0.4;
    for (let k = 0; k < 2; k++) { rp.set([x, y, z], (i * 2 + k) * 3); rs[i * 2 + k] = sp; ro[i * 2 + k] = k; }
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rGeo.setAttribute('speed', new THREE.BufferAttribute(rs, 1)); rGeo.setAttribute('ende', new THREE.BufferAttribute(ro, 1));
  const regenMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uZeit: { value: 0 }, uWind: { value: new THREE.Vector2() }, uH: { value: FL.h }, uDichte: { value: 0 }, uFarbe: { value: new THREE.Color('#b9cde0') } },
    vertexShader: `attribute float speed; attribute float ende; uniform float uZeit; uniform vec2 uWind; uniform float uH; uniform float uDichte; varying float vA;
      void main(){ vec3 p = position; float fall = 95.0 * speed;
        p.y = mod(p.y - uZeit * fall, uH);
        vec3 dir = normalize(vec3(uWind.x, -fall, uWind.y));
        p += vec3(uWind.x, 0.0, uWind.y) * (p.y / fall) ;
        p -= dir * ende * 3.0;
        vA = step(fract(position.x * 12.9898 + position.z * 78.233), uDichte) * (0.1 + 0.2 * ende);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform vec3 uFarbe; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uFarbe, vA); }',
  });
  const regen = new THREE.LineSegments(rGeo, regenMat); regen.frustumCulled = false; regen.visible = false; scene.add(regen);

  const schneeN = q === 'low' ? 3000 : 7000;
  const sp = new Float32Array(schneeN * 3);
  for (let i = 0; i < schneeN; i++) sp.set([(Math.random() - 0.5) * FL.w, Math.random() * FL.h, (Math.random() - 0.5) * FL.w], i * 3);
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const schneeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uZeit: { value: 0 }, uWind: { value: new THREE.Vector2() }, uH: { value: FL.h }, uDichte: { value: 0 }, uPx: { value: 3 }, uMap: { value: weichPunkt() } },
    vertexShader: `uniform float uZeit; uniform vec2 uWind; uniform float uH; uniform float uDichte; uniform float uPx; varying float vA;
      void main(){ vec3 p = position; float ph = position.x * 0.37 + position.z * 0.21;
        p.y = mod(p.y - uZeit * 9.0, uH);
        p.x += sin(uZeit * 0.8 + ph) * 3.0 + uWind.x * p.y * 0.08; p.z += cos(uZeit * 0.6 + ph) * 3.0 + uWind.y * p.y * 0.08;
        vA = step(fract(position.x * 12.9898 + position.z * 78.233), uDichte);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); gl_PointSize = uPx * (0.7 + fract(ph) * 0.8); }`,
    fragmentShader: 'uniform sampler2D uMap; varying float vA; void main(){ if (vA < 0.01) discard; vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(1.0, 1.0, 1.0, c.a * 0.95); }',
  });
  const schnee = new THREE.Points(sGeo, schneeMat); schnee.frustumCulled = false; schnee.visible = false; scene.add(schnee);

  // Blitz
  const blitzGeo = new THREE.BufferGeometry();
  const blitz = new THREE.Line(blitzGeo, new THREE.LineBasicMaterial({ color: '#f4f7ff', toneMapped: false })); blitz.visible = false; scene.add(blitz);
  let naechsterBlitz = 5, blitzBis = 0;

  scene.fog = new THREE.Fog('#c9d6e0', 1e5, 2e5);

  let letzteHimmelZeichnung = 0;
  const zustand = { nacht: 0, sonnenHoehe: 0, daemmerung: 0, mondHoehe: 0 };

  function malHimmel(oben, horizont, nacht, mondInfo, wolkig, zeit, kamAz) {
    const W = 1024, H = 576;
    const gr = sg.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#' + oben.getHexString()); gr.addColorStop(0.62, '#' + mix(oben, horizont, 0.7).getHexString()); gr.addColorStop(1, '#' + horizont.getHexString());
    sg.fillStyle = gr; sg.fillRect(0, 0, W, H);
    const sichtbar = nacht * (1 - wolkig * 0.85);
    if (sichtbar > 0.02) {
      for (const [x, y, r, ph] of sterne) {
        const a = sichtbar * (0.55 + 0.45 * Math.sin(zeit * 1.7 + ph * 9)) * (1 - y * 0.7);
        sg.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; sg.beginPath(); sg.arc(x * W, y * H, r, 0, 7); sg.fill();
      }
    }
    // Mond (Position aus Azimut relativ zur Blickrichtung der Kamera)
    if (mondInfo.altitude > -0.05) {
      const rel = ((mondInfo.azimuth - kamAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const mx = W / 2 + Math.sin(rel) * W * 0.42, my = H * (0.48 - Math.sin(mondInfo.altitude) * 0.6);
      const r = 20, hell = Math.max(0.25, 1 - wolkig * 0.7) * (0.35 + 0.65 * nacht);
      const glow = sg.createRadialGradient(mx, my, r, mx, my, r * 5);
      glow.addColorStop(0, `rgba(220,230,255,${0.28 * hell})`); glow.addColorStop(1, 'rgba(220,230,255,0)');
      sg.fillStyle = glow; sg.fillRect(mx - r * 5, my - r * 5, r * 10, r * 10);
      sg.save(); sg.beginPath(); sg.arc(mx, my, r, 0, 7); sg.clip();
      sg.fillStyle = `rgba(40,48,70,${0.9 * hell})`; sg.fillRect(mx - r, my - r, r * 2, r * 2);
      // beleuchteter Teil nach Phase
      const ph = mondInfo.phase, k = Math.cos(ph * Math.PI * 2);
      sg.fillStyle = `rgba(244,240,226,${hell})`;
      sg.beginPath();
      if (ph < 0.5) { sg.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); sg.ellipse(mx, my, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0); }
      else { sg.arc(mx, my, r, Math.PI / 2, -Math.PI / 2); sg.ellipse(mx, my, Math.abs(k) * r, r, 0, -Math.PI / 2, Math.PI / 2, k > 0); }
      sg.fill(); sg.restore();
    }
    hTex.needsUpdate = true;
  }

  function update(datum, z, dt, w, kam) {
    const s = sonne(datum), m = mond(datum);
    const alt = s.altitude * 180 / Math.PI;
    const wolkig = Math.min(1, (w?.wolken ?? 30) / 100);
    const art = w?.art || 'klar';
    const nass = ['regen', 'starkregen', 'gewitter', 'niesel'].includes(art);
    const truebe = Math.max(wolkig * 0.55, nass ? 0.7 : 0, art === 'nebel' ? 0.8 : 0, art === 'schnee' ? 0.6 : 0);
    const nacht = 1 - sm(-7, 2, alt);
    zustand.nacht = nacht; zustand.sonnenHoehe = alt; zustand.mondHoehe = m.altitude;
    zustand.daemmerung = sm(-6, 1, alt) * (1 - sm(4, 14, alt));

    let [oben, horizont] = himmelsFarbe(alt);
    const grau = mix(C('#7f8a95'), C('#20242c'), nacht);
    oben = mix(oben, grau, truebe * 0.85); horizont = mix(horizont, grau.clone().offsetHSL(0, 0, 0.08), truebe * 0.8);
    if (z - letzteHimmelZeichnung > 0.5) { malHimmel(oben, horizont, nacht, m, wolkig, z, kam.azimut); letzteHimmelZeichnung = z; }

    // Sonne
    const ziel = kam.ziel;
    const richtung = (az, al) => new THREE.Vector3(-Math.sin(az) * Math.cos(al), Math.sin(al), Math.cos(az) * Math.cos(al));
    const sd = richtung(s.azimuth, Math.max(s.altitude, 0.035));
    sonneL.position.copy(ziel).addScaledVector(sd, 900); sonneL.target.position.copy(ziel);
    const tag = sm(-3, 6, alt);
    const warm = 1 - sm(3, 25, alt);
    sonneL.color.copy(mix(C('#fff6ea'), C('#ff9b52'), warm));
    sonneL.intensity = tag * (3.4 - truebe * 2.6);
    // Schattenkamera folgt dem Bildausschnitt
    const sc = sonneL.shadow.camera, span = kam.spannweite * 0.75;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
    sonneL.castShadow = sonneL.intensity > 0.05;
    // Mond
    const md = richtung(m.azimuth, Math.max(m.altitude, 0.2));
    mondL.position.copy(ziel).addScaledVector(md, 900); mondL.target.position.copy(ziel);
    mondL.intensity = nacht * (0.35 + 0.55 * m.fraction) * (1 - wolkig * 0.6) * (m.altitude > 0 ? 1 : 0.3);
    // Himmelslicht
    hemi.color.copy(mix(mix(C('#d9ecff'), C('#ffd2b0'), zustand.daemmerung), C('#5a6fae'), nacht));
    hemi.groundColor.copy(mix(C('#7d7356'), C('#2a2a38'), nacht));
    hemi.intensity = 0.95 + (1 - nacht) * 0.5 + truebe * 0.35 * (1 - nacht);

    // Wolken
    const windMs = (w?.wind ?? 10) / 3.6;
    const wr = ((w?.windRichtung ?? 240) + 180) * Math.PI / 180;    // wohin der Wind weht
    const wv = new THREE.Vector2(Math.sin(wr), -Math.cos(wr)); // Ost, Süd(three z)
    const nW = art === 'nebel' ? 0 : Math.round(2 + wolkig * 18);
    wolkenMat.color.copy(mix(mix(C('#ffffff'), C('#9aa3ad'), truebe * 0.8), C('#2b3140'), nacht * 0.85));
    if (zustand.daemmerung > 0.05 && truebe < 0.5) wolkenMat.color.lerp(C('#ffc6a0'), zustand.daemmerung * 0.35 * (1 - truebe * 2));
    wolken.forEach((c, i) => {
      c.visible = i < nW;
      c.position.x += wv.x * (2 + windMs * 1.2) * c.userData.v * dt;
      c.position.z += wv.y * (2 + windMs * 1.2) * c.userData.v * dt;
      const lim = R * 1.4;
      if (c.position.x > lim) c.position.x -= lim * 2; if (c.position.x < -lim) c.position.x += lim * 2;
      if (c.position.z > lim) c.position.z -= lim * 2; if (c.position.z < -lim) c.position.z += lim * 2;
      c.position.y = (nass || art === 'bedeckt' ? 120 : 160) + (i % 5) * 12;
    });

    // Regen / Schnee
    const regenDichte = { niesel: 0.25, regen: 0.6, starkregen: 1, gewitter: 1 }[art] || 0;
    regen.visible = regenDichte > 0; regenMat.uniforms.uDichte.value = regenDichte; regenMat.uniforms.uZeit.value = z;
    regenMat.uniforms.uWind.value.set(wv.x * windMs * 2, wv.y * windMs * 2);
    regenMat.uniforms.uFarbe.value.copy(mix(C('#c4d4e4'), C('#7f93b8'), nacht));
    regen.position.set(ziel.x, 0, ziel.z);
    schnee.visible = art === 'schnee'; schneeMat.uniforms.uDichte.value = 0.8; schneeMat.uniforms.uZeit.value = z;
    schneeMat.uniforms.uWind.value.set(wv.x * windMs, wv.y * windMs); schneeMat.uniforms.uPx.value = kam.pxScale * 3.2;
    schnee.position.set(ziel.x, 0, ziel.z);

    // Gewitter
    blitzL.intensity = 0; blitz.visible = false;
    if (art === 'gewitter') {
      if (z > naechsterBlitz) {
        naechsterBlitz = z + 4 + Math.random() * 10; blitzBis = z + 0.22;
        const pts = []; let p = new THREE.Vector3(ziel.x + (Math.random() - 0.5) * 600, 240, ziel.z + (Math.random() - 0.5) * 600);
        while (p.y > 0) { pts.push(p.clone()); p.add(new THREE.Vector3((Math.random() - 0.5) * 30, -18 - Math.random() * 14, (Math.random() - 0.5) * 30)); }
        pts.push(p.setY(0)); blitzGeo.setFromPoints(pts);
      }
      if (z < blitzBis) { const f = Math.random() > 0.3 ? 1 : 0.3; blitzL.intensity = 6 * f; blitz.visible = true; }
    }

    // Nebel / Dunst – Abstände relativ zur Kamera
    const d = kam.abstand;
    const nebel = art === 'nebel' ? 1 : nass ? 0.45 : art === 'schnee' ? 0.55 : truebe * 0.25;
    scene.fog.color.copy(mix(horizont, C('#c9d2d8'), 0.4).lerp(C('#0d1220'), nacht * 0.7));
    const sw = Math.min(R, kam.spannweite);
    scene.fog.near = d + sw * (0.3 - nebel * 1.1);
    scene.fog.far = d + sw * (2.6 - nebel * 2.0);

    zustand.wind = windMs; zustand.windVektor = wv; zustand.truebe = truebe; zustand.nass = nass; zustand.art = art;
    return zustand;
  }

  return { update, zustand, sonneL };
}
