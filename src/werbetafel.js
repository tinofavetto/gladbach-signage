// LED-Werbetafel an der Straße: RP-Schlagzeilen, Borussia-Ergebnis, Wetter – im Wechsel.
import * as THREE from 'three';
import { canvas, rund } from './texturen.js';

export function baueTafel(scene, pos, blickRichtung) {
  const g = new THREE.Group(); g.position.copy(pos);
  g.rotation.y = Math.atan2(blickRichtung.x, blickRichtung.z);
  scene.add(g);
  const stahl = new THREE.MeshStandardMaterial({ color: '#2b3236', metalness: 0.6, roughness: 0.35 });
  for (const x of [-4.2, 4.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), stahl); b.position.set(x, 3.5, -0.4); b.castShadow = true; g.add(b); }
  const rahmen = new THREE.Mesh(new THREE.BoxGeometry(14.6, 7.6, 0.7), stahl); rahmen.position.set(0, 9.8, -0.45); rahmen.castShadow = true; g.add(rahmen);
  const [c, x] = canvas(1280, 640);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const schirm = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  schirm.position.set(0, 9.8, -0.08); g.add(schirm);
  const glow = new THREE.PointLight('#bfe8ff', 0, 30, 2); glow.position.set(0, 9, 4); g.add(glow);

  let folien = [], idx = 0, seit = -99, fade = 1;

  function zeichne(f) {
    x.fillStyle = '#0b1416'; x.fillRect(0, 0, 1280, 640);
    if (f.art === 'news') {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1280, 92);
      x.fillStyle = '#0b1416'; x.font = '800 54px "Big Shoulders Display", Inter, Arial'; x.textBaseline = 'middle';
      x.fillText('RP ONLINE', 48, 50);
      x.fillStyle = '#e8604c'; x.font = '700 30px Inter, Arial'; x.fillText(f.quelle.toUpperCase(), 330, 50);
      x.fillStyle = '#5b6b6e'; x.textAlign = 'right'; x.fillText(f.alter, 1232, 50); x.textAlign = 'left';
      if (f.dach) { x.fillStyle = '#42b8b4'; x.font = '700 40px Inter, Arial'; x.fillText(f.dach, 48, 160); }
      x.fillStyle = '#ffffff'; x.font = '800 78px "Big Shoulders Display", Inter, Arial';
      umbruch(f.titel, 48, f.dach ? 252 : 200, 1184, 86, 4);
    } else if (f.art === 'spiel') {
      x.fillStyle = '#103a24'; x.fillRect(0, 0, 1280, 640);
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.05)'; x.fillRect(i * 80, 0, 80, 640); }
      x.fillStyle = '#9fe0b8'; x.font = '700 38px Inter, Arial'; x.textBaseline = 'middle'; x.textAlign = 'center';
      x.fillText(f.kopf.toUpperCase(), 640, 80);
      x.fillStyle = '#fff'; x.font = '800 230px "Big Shoulders Display", Inter, Arial';
      x.fillText(f.tore, 640, 300);
      x.font = '800 64px "Big Shoulders Display", Inter, Arial';
      x.textAlign = 'right'; x.fillText(f.heim.toUpperCase(), 450, 300);
      x.textAlign = 'left'; x.fillText(f.gast.toUpperCase(), 830, 300);
      x.textAlign = 'center'; x.fillStyle = '#d4f2df'; x.font = '600 38px Inter, Arial'; x.fillText(f.fuss, 640, 520);
      x.textAlign = 'left';
    } else if (f.art === 'wetter') {
      const gr = x.createLinearGradient(0, 0, 1280, 640); gr.addColorStop(0, '#185556'); gr.addColorStop(1, '#182643');
      x.fillStyle = gr; x.fillRect(0, 0, 1280, 640);
      x.fillStyle = '#42b8b4'; x.font = '700 40px Inter, Arial'; x.textBaseline = 'middle'; x.fillText('WETTER AM BORUSSIA-PARK', 60, 90);
      x.fillStyle = '#fff'; x.font = '800 260px "Big Shoulders Display", Inter, Arial'; x.fillText(f.temp, 60, 330);
      x.font = '700 64px "Big Shoulders Display", Inter, Arial'; x.fillText(f.text.toUpperCase(), 600, 290);
      x.fillStyle = '#cfe6e6'; x.font = '500 38px Inter, Arial'; x.fillText(f.detail, 600, 370);
      x.fillStyle = '#efcf41'; x.font = '600 36px Inter, Arial'; x.fillText(f.sonne, 60, 540);
    }
    tex.needsUpdate = true;
  }
  function umbruch(text, x0, y, maxW, lh, maxZ) {
    const worte = text.split(' '); let zeile = '', n = 0;
    for (const w of worte) {
      const t = zeile ? zeile + ' ' + w : w;
      if (x.measureText(t).width > maxW && zeile) {
        x.fillText(n === maxZ - 1 ? zeile + ' …' : zeile, x0, y); zeile = w; y += lh; n++;
        if (n >= maxZ) return;
      } else zeile = t;
    }
    x.fillText(zeile, x0, y);
  }

  return {
    setze(f) { folien = f; },
    update(z, nacht) {
      if (!folien.length) return;
      if (z - seit > 9) { seit = z; idx = (idx + 1) % folien.length; zeichne(folien[idx]); }
      const k = Math.min(1, (z - seit) * 3);
      schirm.material.color.setScalar((0.82 + nacht * 0.4) * (0.35 + 0.65 * k));
      glow.intensity = nacht * 25;
    },
  };
}
