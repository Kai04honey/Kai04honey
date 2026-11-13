// Vice Beach test world: an original Miami-style street (pastel Art Deco hotels, palms, beach promenade, ocean)
// built from primitives + painted canvas textures, lit by the skill's two-tone shading and drawn with its ink pass.
// Layout (metres): z runs down the street (camera looks toward -z), y up.
//   x  4.5 ..     hotel facades (facing -x)      x -1 .. 4  east sidewalk (Toid's table)
//   x -8 .. -1    road                           x -12 .. -8 beach promenade with palms
//   x < -12       sand,  x < -45 ocean
import * as THREE from "three";
import { ctex, rep, rng, jit } from "../bridge/paint";
import { twoTone, TONE, CHAR, untone } from "../bridge/shade";
import { LIGHTS, LightPreset } from "../bridge/lights";
import { NOINK } from "../bridge/ink";
import { cardShade, blobMaterial, CARD_K } from "../bridge/cardshade";
import { Pen, bodyFront, Outfit, Expr, INK } from "../bridge/toon";

export type Light = "day" | "golden";
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lam = (color: THREE.ColorRepresentation, map?: THREE.Texture) => twoTone(new THREE.MeshLambertMaterial({ color, map: map ?? null }));
const box = (w: number, h: number, d: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };

// ---------------- reflections ----------------
/** painted equirect environment (sky gradient, clouds, pastel skyline, warm ground) that glass, car paint and the
 *  crystal ball reflect. One per light so sunset windows reflect a sunset. */
let ENV: THREE.Texture;
const envTex = (light: Light) => {
  const t = ctex("vice-env-" + light, 2048, 1024, (g, r) => {
    const sky = light === "day" ? ["#1f5fb8", "#3a8fdc", "#6fbbe8", "#a9dcef"] : ["#4a3a8a", "#c060a0", "#ff8f8a", "#ffd08a"];
    const gr = g.createLinearGradient(0, 0, 0, 512);
    sky.forEach((c, i) => gr.addColorStop([0, 0.45, 0.8, 1][i], c));
    g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);
    g.fillStyle = light === "day" ? "rgba(255,255,255,0.95)" : "rgba(255,214,190,0.9)";
    for (let i = 0; i < 14; i++) { const x = r() * 2048, y = 110 + r() * 150; g.beginPath(); g.ellipse(x, y, 60 + r() * 120, 14 + r() * 22, 0, 0, 7); g.fill(); }
    // pastel skyline band just above the horizon (reflected hotels across the street)
    const pal = light === "day" ? ["#ffb3c7", "#a8e6cf", "#ffd3a5", "#b8c8ff", "#f9f1d0"] : ["#d47a9a", "#8a9ec0", "#e8a070", "#9a88c8", "#e0b890"];
    for (let x = 0; x < 2048;) { const w = 60 + r() * 140, h = 8 + r() * 26; g.fillStyle = pal[Math.floor(r() * pal.length)]; g.fillRect(x, 512 - h, w, h); x += w + 4; }
    const gd = g.createLinearGradient(0, 512, 0, 1024);
    gd.addColorStop(0, light === "day" ? "#e8cdbb" : "#c08a78"); gd.addColorStop(1, light === "day" ? "#6a6070" : "#3a2a48");
    g.fillStyle = gd; g.fillRect(0, 512, 2048, 512);
  });
  t.mapping = THREE.EquirectangularReflectionMapping; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};
/** two-tone shaded Phong with a sharp sun highlight and an environment reflection (glass, car paint, chrome) */
const gloss = (color: THREE.ColorRepresentation, refl: number, shininess = 90, spec = 0.7, extra: THREE.MeshPhongMaterialParameters = {}) =>
  twoTone(new THREE.MeshPhongMaterial({ color, envMap: ENV, reflectivity: refl, combine: THREE.MixOperation, shininess, specular: new THREE.Color(spec, spec, spec), ...extra }));

// ---------------- painted textures ----------------
const asphalt = () => ctex("vice-asphalt", 1024, 1024, (g, r) => {
  g.fillStyle = "#5d5a63"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? "rgba(40,36,48,0.18)" : "rgba(140,135,150,0.14)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 5, 2 + r() * 5); }
  // centre double yellow line (u = 0.5) and dashed white lane lines
  g.fillStyle = "#f2c94c"; g.fillRect(500, 0, 9, 1024); g.fillRect(515, 0, 9, 1024);
  g.fillStyle = "#f4f1ea"; for (let y = 0; y < 1024; y += 256) { g.fillRect(250, y, 8, 140); g.fillRect(766, y, 8, 140); }
});
const pavement = () => ctex("vice-pave", 1024, 1024, (g, r) => {
  const cols = ["#f1d9c9", "#ecd2c0", "#f5e0d2", "#e8cdbb"];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = jit(r, cols[(x + y) % 4], 0.03, 3, 0.1); g.fillRect(x * 256, y * 256, 256, 256); }
  g.strokeStyle = "rgba(120,90,90,0.45)"; g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * 256); g.lineTo(1024, i * 256); g.stroke(); }
});
const sand = () => ctex("vice-sand", 1024, 1024, (g, r) => {
  g.fillStyle = "#f3d9a4"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? "rgba(214,176,118,0.35)" : "rgba(255,240,205,0.4)"; g.beginPath(); g.arc(r() * 1024, r() * 1024, 1 + r() * 3, 0, 7); g.fill(); }
});
const bark = () => ctex("vice-bark", 256, 512, (g) => {
  g.fillStyle = "#b98a5a"; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) { g.fillStyle = "#8f6640"; g.fillRect(0, y, 256, 7); g.fillStyle = "#cfa274"; g.fillRect(0, y + 9, 256, 5); }
});
/** Art Deco facade wall: stucco, fine scoring lines, a door on the ground floor, soft shadows under the ledges.
 *  Windows and shopfront glass are real geometry (reflective glass + trim) placed by hotel(). */
const decoFacade = (key: string, wall: string, trim: string, floors: number) => ctex("vice-fac-" + key, 2048, 2048, (g, r) => {
  g.fillStyle = wall; g.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,60,90,0.06)"; g.fillRect(r() * 2048, r() * 2048, 2 + r() * 4, 2 + r() * 4); }
  const fh = 2048 / floors;
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    g.fillStyle = "rgba(80,50,80,0.10)"; g.fillRect(0, y0 + fh * 0.97, 2048, 6);
    if (f === floors - 1) { g.fillStyle = trim; g.fillRect(904, y0 + fh * 0.18, 240, fh * 0.82); g.fillStyle = "#2b4f68"; g.fillRect(932, y0 + fh * 0.28, 184, fh * 0.72); }
    const grd = g.createLinearGradient(0, y0 + fh * 0.12, 0, y0 + fh * 0.32);
    grd.addColorStop(0, "rgba(70,40,80,0.30)"); grd.addColorStop(1, "rgba(70,40,80,0)");
    g.fillStyle = grd; g.fillRect(0, y0 + fh * 0.12, 2048, fh * 0.2);
  }
});
const stripes = (key: string, a: string, b: string, n = 12) => ctex("vice-stripe-" + key, 512, 64, (g) => {
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 512) / n, 0, 512 / n + 1, 64); }
});
const signTex = (key: string, text: string, bg: string, fg: string, w = 1024, h = 256, font = "900 150px Arial Black, Arial, sans-serif") => {
  const t = ctex("vice-sign-" + key, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 6);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};

// ---------------- props ----------------
/** curved palm: tapered trunk along a gentle arc + drooping frond strips + coconuts */
const palm = (h: number, lean: THREE.Vector3, seed: number) => {
  const g = new THREE.Group(), r = rng(seed);
  const top = V(lean.x, h, lean.z);
  const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(lean.x * 0.15, h * 0.55, lean.z * 0.15), top);
  const trunk = new THREE.TubeGeometry(curve, 24, 0.17, 10, false);
  // taper: scale radius by height
  const p = trunk.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h, c = curve.getPoint(Math.min(1, Math.max(0, t)));
    const k = 1.25 - 0.55 * t;
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, p.getY(i), c.z + (p.getZ(i) - c.z) * k);
  }
  trunk.computeVertexNormals();
  const tm = new THREE.Mesh(trunk, lam("#ffffff", rep(bark(), 1, h / 1.2)));
  tm.castShadow = tm.receiveShadow = true; g.add(tm);
  const frondMat = lam("#3f9e4a"); frondMat.side = THREE.DoubleSide;
  const darkMat = lam("#2d7c3c"); darkMat.side = THREE.DoubleSide;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, len = 2.6 + r() * 0.9, droop = 0.9 + r() * 0.8, segs = 10;
    const pos: number[] = [], idx: number[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, w = 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.05;
      const x = t * len, y = 0.5 * t - droop * t * t * 1.4;
      pos.push(x, y + 0.08, -w, x, y - 0.06, 0, x, y + 0.08, w); // V-folded leaf
      if (s) { const b = (s - 1) * 3, c = s * 3; idx.push(b, c, b + 1, c, c + 1, b + 1, b + 1, c + 1, b + 2, c + 1, c + 2, b + 2); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
    const m = new THREE.Mesh(fg, i % 3 ? frondMat : darkMat);
    m.position.copy(top); m.rotation.y = a; m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const nut = new THREE.SphereGeometry(0.16, 12, 10);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(nut, lam("#6b4a2b"));
    m.position.copy(top).add(V(Math.cos(i * 1.7) * 0.2, -0.25, Math.sin(i * 1.7) * 0.2)); m.castShadow = true; g.add(m);
  }
  return g;
};

/** stepped Art Deco hotel: main block, eyebrow ledges, rounded corner tower, central fin with a neon sign */
const hotel = (z0: number, width: number, floors: number, wall: string, trim: string, sign: string | null, neon: string, seed: number) => {
  const g = new THREE.Group(), fh = 3.1, h = floors * fh, depth = 14, x0 = 4.5;
  const fac = decoFacade(seed + wall, wall, trim, floors), bays = Math.max(3, Math.round(width / 3));
  const wallM = lam("#ffffff", fac), plain = lam(wall), trimM = lam(trim);
  // facade box: map the painted facade onto the street face (-x) only
  const mats = [plain, wallM, plain, plain, plain, plain]; // +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(box(depth, h, width), mats);
  body.position.set(x0 + depth / 2, 0, z0 - width / 2); body.castShadow = body.receiveShadow = true; g.add(body);
  // eyebrow ledges over every upper floor
  for (let f = 1; f < floors; f++) {
    const e = new THREE.Mesh(box(0.7, 0.14, width + 0.2), trimM);
    e.position.set(x0 - 0.3, h - f * fh + fh * 0.88 - fh, z0 - width / 2); e.castShadow = e.receiveShadow = true; g.add(e);
  }
  // windows: reflective glass panes with trim frames and a centre mullion (instanced), ink-outlined by the world pass
  const bw = width / bays, ww = bw * 0.58, wh = fh * 0.5;
  const panes: THREE.Matrix4[] = [], frames: THREE.Matrix4[] = [];
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion(), V(sx, sy, sz));
  for (let i = 1; i < floors; i++) for (let b = 0; b < bays; b++) {
    const zc = z0 - (b + 0.5) * bw, yc = i * fh + fh * 0.53;
    panes.push(M(x0 - 0.03, yc, zc, 1, wh, ww));
    for (const s2 of [-1, 1]) frames.push(M(x0 - 0.06, yc + s2 * (wh / 2 + 0.05), zc, 0.12, 0.1, ww + 0.2)); // sill + head
    for (const s2 of [-1, 0, 1]) frames.push(M(x0 - 0.06, yc, zc + s2 * (ww / 2 + (s2 ? 0.05 : 0)), 0.12, wh, s2 ? 0.1 : 0.06)); // jambs + mullion
  }
  // ground floor shopfront: two big panes either side of the door
  for (const s2 of [-1, 1]) {
    const pw = width / 2 - 1.1, zc = z0 - width / 2 + s2 * (0.85 + pw / 2);
    panes.push(M(x0 - 0.03, fh * 0.5, zc, 1, fh * 0.56, pw));
    frames.push(M(x0 - 0.07, fh * 0.2, zc, 0.14, 0.12, pw + 0.2), M(x0 - 0.07, fh * 0.79, zc, 0.14, 0.12, pw + 0.2));
  }
  const paneGeo = new THREE.PlaneGeometry(1, 1); paneGeo.rotateY(-Math.PI / 2);
  const streak = ctex("vice-glass", 256, 256, (c) => {
    c.fillStyle = "#c4c4c4"; c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#ffffff"; c.save(); c.translate(128, 128); c.rotate(-0.6);
    c.fillRect(-90, -200, 34, 400); c.fillRect(-36, -200, 12, 400); c.restore();
  });
  const glassM = gloss(seed % 2 ? "#3a9cc4" : "#3aa6b4", 0.4, 140, 0.9, { map: streak });
  const pm = new THREE.InstancedMesh(paneGeo, glassM, panes.length); panes.forEach((m, i) => pm.setMatrixAt(i, m)); pm.receiveShadow = true; g.add(pm);
  const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trimM, frames.length); frames.forEach((m, i) => fm.setMatrixAt(i, m)); fm.castShadow = fm.receiveShadow = true; g.add(fm);
  // parapet + stepped crown
  const par = new THREE.Mesh(box(depth * 0.9, 0.9, width * 0.96), trimM);
  par.position.set(x0 + depth / 2, h, z0 - width / 2); par.castShadow = true; g.add(par);
  const step = new THREE.Mesh(box(3, 1.6, width * 0.4), plain);
  step.position.set(x0 + 2.5, h + 0.9, z0 - width / 2); step.castShadow = true; g.add(step);
  // vertical fin with a neon sign (emissive > 1 so the bloom picks it up)
  if (sign) {
    const fin = new THREE.Mesh(box(1.4, h * 0.75 + 3.2, 0.5), trimM);
    fin.position.set(x0 - 0.7, h * 0.3, z0 - width / 2); fin.castShadow = true; g.add(fin);
    const st = signTex(sign, sign, "#2a1838", "#ffffff", 256, 1024, "900 120px Arial Black, Arial, sans-serif");
    st.rotation = 0;
    const letters = [...sign];
    const lt = ctex("vice-vsign-" + sign, 256, 1024, (c) => {
      c.fillStyle = "#2a1838"; c.fillRect(0, 0, 256, 1024);
      c.fillStyle = "#ffffff"; c.font = "900 130px Arial Black, Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      letters.forEach((ch, i) => c.fillText(ch, 128, ((i + 0.5) * 1024) / letters.length));
    });
    lt.wrapS = lt.wrapT = THREE.ClampToEdgeWrapping;
    const sm = new THREE.MeshBasicMaterial({ map: lt, color: new THREE.Color(neon).multiplyScalar(1.6), toneMapped: true });
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.6 * 0.25, h * 0.6), sm);
      m.position.set(x0 - 0.7, h * 0.3 + h * 0.75 * 0.55, z0 - width / 2 + s * 0.26);
      m.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(m);
    }
  }
  // awning over the shopfront
  const aw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, width * 0.8), lam("#ffffff", rep(stripes(neon, neon, "#fff6ea", 16), 1, 1)));
  aw.position.set(x0 - 0.8, 3.0, z0 - width / 2); aw.rotation.z = -0.25; aw.castShadow = true; g.add(aw);
  return g;
};

const car = (color: string) => {
  const g = new THREE.Group(), bodyM = gloss(color, 0.28, 70, 0.8), dark = lam("#2b2433"), chrome = gloss("#cfd6e2", 0.85, 160, 1.0), glass = gloss("#3a8fae", 0.7, 150, 1.0);
  const b = new THREE.Mesh(box(1.9, 0.62, 4.6), bodyM); b.position.y = 0.32; g.add(b);
  const cab = new THREE.Mesh(box(1.7, 0.5, 2.0), glass); cab.position.set(0, 0.94, -0.2); g.add(cab);
  const roof = new THREE.Mesh(box(1.74, 0.08, 2.1), bodyM); roof.position.set(0, 1.42, -0.2); g.add(roof);
  for (const z of [-1.55, 1.45]) for (const x of [-0.92, 0.92]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18), dark);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 12), chrome);
    hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.34, z); g.add(hub);
  }
  const bump = new THREE.Mesh(box(1.94, 0.14, 0.18), chrome); bump.position.set(0, 0.28, 2.32); g.add(bump);
  g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  return g;
};

// ---------------- characters ----------------
export const SU = 0.00216; // metres per design unit (same scale as the skill's cast)
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();

/** Toid: purple robe, teal turban with a ruby, gold buttons, curly moustache */
export const TOID: Outfit = { jacket: "#6b3fa0", pants: "#3a2a55", boots: "#e8c45a", buttons: "#e8c45a", moustache: "#2a1a14", hat: null, skin: "#f5c9a0", build: "stout" };
const TOURIST: Outfit = { jacket: "#ff7a59", pants: "#d9c39a", boots: "#f4f1ea", hat: "cap", cap: "#34b5d6", skin: "#ffe2c2", buttons: "#fff3d6" };
const COP: Outfit = { jacket: "#2b3f73", pants: "#22304f", boots: INK, hat: "cap", cap: "#1d2a4d", belt: "#1a1a22", buttons: "#e8c45a", skin: "#c99067", moustache: "#2a201a" };
const LOCAL: Outfit = { jacket: "#ffffff", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#e0a43a", dress: "#ff6fa8", skin: "#ecd0b6" };

/** turban + ruby on top of a stout front-facing head (head centre y 309, crown ~198 in the design space) */
const turban = (p: Pen) => {
  const cx = 300, top = 205;
  p.ell(cx, top - 6, 128, 72, "#1fb5a8", 10);
  p.ell(cx - 30, top - 40, 70, 46, "#25c7b9", 9);
  p.ell(cx + 38, top - 34, 66, 44, "#1aa396", 9);
  p.ell(cx, top - 70, 40, 34, "#2fd6c7", 8);
  p.stroke([[cx - 110, top + 8], [cx - 40, top - 30], [cx + 40, top - 8], [cx + 112, top - 36]], 7, "#14857b");
  p.ell(cx, top - 4, 20, 24, "#e2334a", 7);
  p.ell(cx - 5, top - 11, 6, 7, "#ff9aa8", 0);
  p.poly([[cx + 6, top - 34], [cx + 30, top - 112], [cx + 46, top - 108], [cx + 18, top - 30]], "#f6f0ff", 6); // feather
};

type CardSpec = { draw: (p: Pen) => void; pos: THREE.Vector3; flip?: boolean };
const cardTex = (key: string, draw: (p: Pen) => void, w = 1200, h = 2000) => {
  const t = ctex("vice-card-" + key, w, h, (g) => { g.setTransform(w / 600, 0, 0, h / 1000, 0, 0); draw(new Pen(g)); });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};
const blobTex = () => {
  const t = ctex("vice-blob", 256, 128, (g) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 128);
    const gr = g.createRadialGradient(128, 64, 4, 128, 64, 120);
    gr.addColorStop(0, "rgba(120,100,140,1)"); gr.addColorStop(0.55, "rgba(185,170,200,1)"); gr.addColorStop(1, "rgba(255,255,255,1)");
    g.setTransform(1, 0, 0, 0.5, 0, 32); g.fillStyle = gr; g.beginPath(); g.arc(128, 64, 120, 0, 7); g.fill();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
};

export class ViceWorld {
  root = new THREE.Group();
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private fog = new THREE.Fog("#bfe3f2", 30, 360);
  cards: THREE.Mesh[] = [];
  ball: THREE.Mesh;

  constructor(light: Light) {
    ENV = envTex(light);
    const R = this.root;
    // ---- sky ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, e: { value: new THREE.Vector3() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3; uniform vec3 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el)); c = mix(c, c3, smoothstep(e.y, e.z, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.sun, this.sun.target, this.hemi);
    // clouds: flat painted puffs far away
    const cloud = ctex("vice-cloud", 512, 256, (g) => {
      const p = new Pen(g);
      for (const [x, y, rx, ry] of [[150, 160, 110, 70], [260, 120, 130, 95], [370, 165, 100, 65], [250, 185, 190, 55]] as const) p.ell(x, y, rx, ry, "#ffffff", 0);
      g.globalAlpha = 0.5; for (const [x, y, rx, ry] of [[200, 200, 160, 30], [330, 200, 110, 26]] as const) p.ell(x, y, rx, ry, "#dfe7f7", 0);
    });
    cloud.wrapS = cloud.wrapT = THREE.ClampToEdgeWrapping;
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloud, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
      const w = 120 + (i % 3) * 50, a = -1.9 + i * 0.32;
      m.scale.set(w, w / 2, 1); m.position.set(Math.sin(a) * 700, 90 + (i % 3) * 45, -Math.cos(a) * 700); m.lookAt(0, m.position.y, 0);
      m.layers.set(NOINK); R.add(m);
    }
    // ---- ground ----
    const add = (m: THREE.Mesh) => { m.receiveShadow = true; R.add(m); return m; };
    const sandM = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), lam("#ffffff", rep(sand(), 120, 120)));
    sandM.rotation.x = -Math.PI / 2; sandM.position.set(-400, -0.02, -300); add(sandM);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: untone("#2bb3c6") }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(-45 - 700, 0.01, -300); R.add(ocean);
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(4, 1400), new THREE.MeshBasicMaterial({ color: untone("#e9fbff") }));
    surf.rotation.x = -Math.PI / 2; surf.position.set(-46, 0.015, -300); R.add(surf);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 600), lam("#ffffff", rep(asphalt(), 1, 60)));
    road.rotation.x = -Math.PI / 2; road.position.set(-4.5, 0.0, -260); add(road);
    const walkE = new THREE.Mesh(box(5, 0.15, 600), [lam("#e6c9b8"), lam("#e6c9b8"), lam("#ffffff", rep(pavement(), 2, 240)), lam("#e6c9b8"), lam("#e6c9b8"), lam("#e6c9b8")]);
    walkE.position.set(1.5, 0, -260); add(walkE);
    const walkW = new THREE.Mesh(box(4, 0.15, 600), [lam("#e6c9b8"), lam("#e6c9b8"), lam("#ffffff", rep(pavement(), 1.6, 240)), lam("#e6c9b8"), lam("#e6c9b8"), lam("#e6c9b8")]);
    walkW.position.set(-10, 0, -260); add(walkW);
    // low promenade wall on the beach side
    const wall = new THREE.Mesh(box(0.35, 0.6, 600), lam("#f7efe4")); wall.position.set(-11.9, 0, -260); wall.castShadow = true; add(wall);
    // ---- palms on the promenade and a few on the east sidewalk ----
    for (let k = 0; k < 22; k++) {
      const z = 8 - k * 11, s = k * 7 + 3;
      const p = palm(7.5 + ((k * 37) % 5) * 0.8, V(0.9 * Math.sin(k * 2.1), 0, 0.6 * Math.cos(k * 1.3)), s);
      p.position.set(-10 + Math.sin(k) * 0.5, 0.15, z); R.add(p);
    }
    for (let k = 0; k < 8; k++) { const p = palm(8.5, V(-0.6, 0, 0.3), 90 + k); p.position.set(3.6, 0.15, -9 - k * 24); R.add(p); }
    // ---- hotels (original names) ----
    const H: [number, number, string, string, string | null, string][] = [
      [14, 4, "#a8e6cf", "#f7f3e8", "PALMA", "#ff4fa3"],
      [12, 5, "#ffb3c7", "#fff7ec", null, "#3fd0ff"],
      [16, 4, "#ffd3a5", "#ffffff", "BREEZE", "#3fd0ff"],
      [11, 6, "#b8c8ff", "#fff8ee", null, "#ff4fa3"],
      [15, 4, "#f9f1d0", "#f2a6b8", "TIDES", "#ff4fa3"],
      [13, 5, "#9fe0e6", "#ffffff", null, "#ffd23f"],
      [14, 4, "#ffc2d9", "#ffffff", "SOL", "#3fd0ff"],
      [12, 5, "#c9f2c7", "#fff7ec", null, "#ff4fa3"],
    ];
    let z = 12;
    for (let rep2 = 0; rep2 < 3; rep2++) for (let i = 0; i < H.length; i++) {
      const [w, fl, wallC, trim, sign, neon] = H[i];
      R.add(hotel(z, w, fl, wallC, trim, rep2 === 0 ? sign : null, neon, i + rep2 * 10));
      z -= w + 0.6;
    }
    // ---- parked cars ----
    const c1 = car("#ff5fa2"); c1.position.set(-1.9, 0, -9); R.add(c1);
    const c2 = car("#36c2d6"); c2.position.set(-1.9, 0, -24); R.add(c2);
    const c3 = car("#f4f1ea"); c3.position.set(-7.1, 0, -40); c3.rotation.y = Math.PI; R.add(c3);
    // ---- Toid's fortune table: round table + purple cloth, striped umbrella, crystal ball, sign board ----
    const T = new THREE.Group(); T.position.set(1.15, 0.15, -0.2); R.add(T);
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.78, 32), lam("#7a3fb0")); cloth.position.y = 0.39; T.add(cloth);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 32), lam("#e8c45a")); top.position.y = 0.8; T.add(top);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 16), lam("#e8c45a")); stand.position.y = 0.87; T.add(stand);
    const swirl = ctex("vice-swirl", 512, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, "#7a3cff"); gr.addColorStop(0.5, "#3fe0ff"); gr.addColorStop(1, "#ff5fd2");
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 10; g.lineCap = "round";
      for (let k = 0; k < 5; k++) { g.beginPath(); for (let x = 0; x <= 512; x += 8) g.lineTo(x, 40 + k * 45 + 22 * Math.sin(x / 40 + k * 1.7)); g.stroke(); }
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 24), new THREE.MeshBasicMaterial({ map: swirl, color: new THREE.Color(1.5, 1.5, 1.7) }));
    core.position.y = 1.08; core.rotation.set(0.4, 0.6, 0.2); T.add(core);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), gloss("#bfe9ff", 0.75, 220, 1.4, { transparent: true, opacity: 0.38 }));
    this.ball.position.y = 1.08; this.ball.renderOrder = 2; T.add(this.ball);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), lam("#f4f1ea")); pole.position.set(0.25, 1.25, 0.25); T.add(pole);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 16, 1, true), lam("#ffffff", stripes("umb", "#ff5fa2", "#fff6ea", 16)));
    (umb.material as THREE.Material).side = THREE.DoubleSide; umb.position.set(0.25, 2.62, 0.25); T.add(umb);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), lam("#ffffff", signTex("psychic", "PSYCHIC", "#2a1838", "#ffd23f", 512, 340, "900 72px Arial Black, Arial, sans-serif")));
    board.position.set(-0.75, 0.62, 0.55); board.rotation.set(-0.15, 0.55, 0); T.add(board);
    const legs = new THREE.Mesh(box(0.06, 0.62, 0.06), lam("#2a1838")); legs.position.set(-0.75, 0, 0.5); T.add(legs);
    const stars = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: signTex("toid", "TOID SEES ALL", "#ffd23f", "#2a1838", 1024, 340, "900 84px Arial Black, Arial, sans-serif"), color: new THREE.Color(1.15, 1.15, 1.15) }));
    stars.position.set(0, 0.55, 0.735); T.add(stars);
    T.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== this.ball && o !== core) { o.castShadow = true; o.receiveShadow = true; } });

    // ---- cast: lit flat cards (cardShade) on the NOINK layer + contact blobs ----
    const toidDraw = (p: Pen) => { bodyFront(p, TOID, { mode: "stand", expr: "smile", facing: -1, seed: 4, wave: 0.6, look: -0.4 }); turban(p); };
    const specs: CardSpec[] = [
      { draw: toidDraw, pos: V(1.35, 0.15, -0.95) },
      { draw: (p) => bodyFront(p, TOURIST, { mode: "stroll", phase: 0.15, expr: "shock", facing: 1, seed: 2 }), pos: V(-0.2, 0.15, -6.5) },
      { draw: (p) => bodyFront(p, COP, { mode: "stand", expr: "stern", facing: -1, seed: 6 }), pos: V(2.6, 0.15, -15) },
      { draw: (p) => bodyFront(p, LOCAL, { mode: "stand", expr: "grin", facing: 1, seed: 3 }), pos: V(2.0, 0.15, -21) },
      { draw: (p) => bodyFront(p, { ...TOURIST, jacket: "#5ad1a0", cap: "#ff5fa2", skin: "#c99067" }, { mode: "stand", expr: "laugh", facing: -1, seed: 5 }), pos: V(2.9, 0.15, -21.6) },
    ];
    const bt = blobTex();
    specs.forEach((s, i) => {
      const mat = cardShade(new THREE.MeshLambertMaterial({ map: cardTex("c" + i, s.draw), alphaTest: 0.5, side: THREE.DoubleSide }));
      const dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: 0.5, side: THREE.DoubleSide });
      const m = new THREE.Mesh(BODY, mat);
      m.customDepthMaterial = dmat;
      m.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
      m.position.copy(s.pos); m.renderOrder = 1; m.receiveShadow = true; m.layers.set(NOINK);
      R.add(m); this.cards.push(m);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), blobMaterial(bt));
      b.rotation.x = -Math.PI / 2; b.position.set(s.pos.x, s.pos.y + 0.01, s.pos.z); b.renderOrder = 0.5; b.layers.set(NOINK); R.add(b);
    });
  }

  /** pose for one frame: camera, camera-relative sun, two-tone uniforms, sky, fog, billboards */
  update(cam: THREE.PerspectiveCamera, scene: THREE.Scene, light: Light, pos: THREE.Vector3, look: THREE.Vector3, fov: number, roll = 0) {
    const L: LightPreset = LIGHTS[light];
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look); cam.rotateZ(roll);
    cam.fov = fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // sun relative to the camera's horizontal forward axis (az: 0 ahead, +90 screen right)
    const fw = look.clone().sub(pos).setY(0).normalize(), rt = fw.clone().cross(V(0, 1, 0)).normalize();
    const az = THREE.MathUtils.degToRad(light === "day" ? -98 : -62), el = THREE.MathUtils.degToRad(light === "day" ? 27 : 11);
    const sunDir = fw.clone().multiplyScalar(Math.cos(az)).addScaledVector(rt, Math.sin(az)).multiplyScalar(Math.cos(el)).add(V(0, Math.sin(el), 0)).normalize();
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = 42;
    this.sun.position.copy(look).addScaledVector(sunDir, 220); this.sun.target.position.copy(look);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0, 0, 0); TONE.uSat.value = 1.12;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // Miami sky: bright cyan horizon, deep blue top (day) / pink-orange sunset (golden)
    const SKY = light === "day" ? ["#c4eaf6", "#8fd0f0", "#4fa6e6", "#2a7ad6"] : ["#ffc27a", "#ff8f8a", "#d06aa8", "#5b4a9a"];
    const su = this.skyMat.uniforms;
    SKY.forEach((h, i) => untone(h, su["c" + i].value));
    su.e.value.set(THREE.MathUtils.degToRad(4), THREE.MathUtils.degToRad(14), THREE.MathUtils.degToRad(42));
    this.sky.position.copy(cam.position);
    untone(SKY[0], this.fog.color); this.fog.near = 40; this.fog.far = 420;
    scene.fog = this.fog; scene.background = null;
    // yaw-only billboards toward the camera
    for (const c of this.cards) c.rotation.set(0, Math.atan2(cam.position.x - c.position.x, cam.position.z - c.position.z), 0);
    return look;
  }
}
