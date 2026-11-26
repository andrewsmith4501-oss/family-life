// Original low-poly 3D models built from simple shapes: people and furniture.
// 1 world unit = 20 logical pixels of the 2D house plan.
import * as THREE from "../vendor/three.module.min.js";
import { OPTIONS } from "./avatar.js";

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const geo = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s),
  sph: (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h),
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10),
};
function mesh(g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
const box = (w, h, d, c, x, y, z) => mesh(geo.box(w, h, d), mat(c), x, y, z);

const darken = (hex, k = 0.75) => {
  const c = new THREE.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString();
};

// ---------- People ----------
// Returns a group with named parts so animations can move limbs.
export function buildPerson(look, { age = "adult", years } = {}) {
  const skin = OPTIONS.skin[look.skin] ?? OPTIONS.skin[2];
  const hair = OPTIONS.hairColor[look.hairColor] ?? OPTIONS.hairColor[0];
  const shirt = OPTIONS.shirt[look.shirt] ?? OPTIONS.shirt[5];
  const pants = darken(shirt === "#ffffff" ? "#34495e" : "#2c3e50", 1);
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);           // everything above the feet, for bobbing/lying
  body.name = "body";

  // legs (pivot at hip)
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.11 * side, 0.62, 0);
    hip.add(mesh(geo.cap(0.085, 0.42), mat(pants), 0, -0.3, 0));
    hip.add(box(0.15, 0.08, 0.24, "#222222", 0, -0.6, 0.04));
    body.add(hip); legs.push(hip);
  }
  // torso
  body.add(mesh(geo.cap(0.2, 0.38), mat(shirt), 0, 0.92, 0));
  // arms (pivot at shoulder)
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.27 * side, 1.12, 0);
    sh.add(mesh(geo.cap(0.065, 0.36), mat(shirt), 0, -0.2, 0));
    sh.add(mesh(geo.sph(0.07), mat(skin), 0, -0.46, 0));
    body.add(sh); arms.push(sh);
  }
  // neck + head
  body.add(mesh(geo.cyl(0.07, 0.08, 0.12), mat(skin), 0, 1.3, 0));
  const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
  head.add(mesh(geo.sph(0.22, 20, 16), mat(skin)));
  head.children[0].scale.set(1, 1.08, 1);
  for (const side of [-1, 1]) {
    head.add(mesh(geo.sph(0.03, 8, 6), mat("#1a1a1a"), 0.08 * side, 0.03, 0.2));
    head.add(mesh(geo.sph(0.045, 8, 6), mat(skin), 0.22 * side, 0, 0));        // ears
  }
  const mouth = mesh(geo.box(0.09, 0.02, 0.02), mat("#6b2f1f"), 0, -0.09, 0.205);
  mouth.name = "mouth"; head.add(mouth);
  addHair(head, look.hair, hair);
  if (age === "adult" || age === "elder") addFacialHair(head, look.facial, hair);
  addGlasses(head, look.glasses);

  const s = years ? Math.min(1, 0.55 + years * 0.035) : age === "child" ? 0.72 : age === "teen" ? 0.88 : 1;
  g.scale.setScalar(s);
  if (years && years < 11) head.scale.setScalar(1.15);   // kids get bigger heads
  g.userData.parts = { body, legs, arms, head, mouth };
  return g;
}

function addHair(head, style, c) {
  const m = mat(c);
  const add = (o) => { o.castShadow = true; head.add(o); return o; };
  const cap = (r, thetaLen = Math.PI / 2) => new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, thetaLen);
  switch (style) {
    case "short": add(mesh(cap(0.235, 1.3), m, 0, 0.02, -0.01)); break;
    case "fade":  add(mesh(cap(0.228, 1.1), m, 0, 0.03, 0)); break;
    case "afro":  add(mesh(geo.sph(0.34, 18, 14), m, 0, 0.1, -0.06)); break;
    case "puffs": add(mesh(cap(0.232, 1.2), m, 0, 0.02, 0)); add(mesh(geo.sph(0.13), m, -0.2, 0.2, -0.02)); add(mesh(geo.sph(0.13), m, 0.2, 0.2, -0.02)); break;
    case "bun":   add(mesh(cap(0.232, 1.25), m, 0, 0.02, 0)); add(mesh(geo.sph(0.12), m, 0, 0.24, -0.12)); break;
    case "long":  add(mesh(cap(0.24, 1.45), m, 0, 0.02, -0.01));
                  add(mesh(geo.box(0.44, 0.5, 0.14), m, 0, -0.2, -0.13)); break;
    case "braids":
    case "locs": {
      add(mesh(cap(0.235, 1.3), m, 0, 0.02, -0.01));
      const n = style === "braids" ? 8 : 10;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.15 + 0.7 * i / (n - 1)) + Math.PI;  // around the back
        add(mesh(geo.cyl(0.03, 0.025, 0.5, 6), m, Math.cos(a) * 0.2, -0.2, Math.sin(a) * 0.2 * -1 - 0.02));
      }
      break;
    }
    default: break; // bald
  }
}

function addFacialHair(head, style, c) {
  const m = mat(c);
  if (style === "beard") { const b = mesh(new THREE.SphereGeometry(0.225, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), m, 0, 0.01, 0.01); head.add(b); }
  if (style === "goatee") head.add(mesh(geo.box(0.1, 0.09, 0.05), m, 0, -0.16, 0.18));
  if (style === "mustache") head.add(mesh(geo.box(0.14, 0.03, 0.03), m, 0, -0.05, 0.21));
}

function addGlasses(head, style) {
  if (style === "none" || !style) return;
  const m = mat("#222222");
  for (const side of [-1, 1]) {
    const g = style === "round" ? new THREE.TorusGeometry(0.055, 0.01, 6, 16) : new THREE.BoxGeometry(0.11, 0.08, 0.01);
    const o = mesh(g, style === "round" ? m : mat("#222222", { transparent: true, opacity: 0.55 }), 0.08 * side, 0.03, 0.215);
    head.add(o);
  }
  head.add(mesh(geo.box(0.05, 0.012, 0.01), m, 0, 0.04, 0.215));
}

// pose: "idle" | "walk" | "sit" | "lie" | "dance" | "use" | "run"; t = seconds
export function animatePerson(p, pose, t) {
  const { body, legs, arms, mouth } = p.userData.parts;
  body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
  legs.forEach(l => l.rotation.set(0, 0, 0));
  arms.forEach(a => a.rotation.set(0, 0, 0));
  const sw = Math.sin(t * 9);
  switch (pose) {
    case "walk":
      legs[0].rotation.x = sw * 0.6; legs[1].rotation.x = -sw * 0.6;
      arms[0].rotation.x = -sw * 0.5; arms[1].rotation.x = sw * 0.5;
      body.position.y = Math.abs(Math.cos(t * 9)) * 0.03;
      break;
    case "run":
      legs[0].rotation.x = Math.sin(t * 14) * 0.9; legs[1].rotation.x = -Math.sin(t * 14) * 0.9;
      arms[0].rotation.x = -Math.sin(t * 14) * 0.9; arms[1].rotation.x = Math.sin(t * 14) * 0.9;
      body.position.y = Math.abs(Math.cos(t * 14)) * 0.06;
      break;
    case "sit":
      legs.forEach(l => l.rotation.x = -1.45);
      body.position.y = -0.36;
      arms.forEach((a, i) => a.rotation.x = -0.5 + Math.sin(t * 2 + i) * 0.05);
      break;
    case "lie":
      body.rotation.x = -Math.PI / 2;
      body.position.set(0, 0.7, 0.75);
      arms.forEach(a => a.rotation.z = 0);
      break;
    case "dance":
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.12;
      body.rotation.y = Math.sin(t * 3) * 0.5;
      arms[0].rotation.z = 2.4 + Math.sin(t * 6) * 0.4; arms[1].rotation.z = -2.4 - Math.sin(t * 6 + 1) * 0.4;
      legs[0].rotation.x = Math.sin(t * 6) * 0.3; legs[1].rotation.x = -Math.sin(t * 6) * 0.3;
      break;
    case "use":
      arms.forEach((a, i) => a.rotation.x = -1.1 + Math.sin(t * 5 + i * 2) * 0.15);
      break;
    default:
      body.position.y = Math.sin(t * 1.6) * 0.008;
      arms[0].rotation.z = 0.06; arms[1].rotation.z = -0.06;
  }
  if (mouth) mouth.scale.y = 1;
}

// ---------- Furniture ----------
const WOOD = "#9c6b43", DARKWOOD = "#5e3d26", WHITE = "#f4f4f2", STEEL = "#b9c0c6", BLACK = "#26282c";

function legsUnder(g, w, d, h, c = DARKWOOD) {
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, h, 0.06, c, x * (w / 2 - 0.05), h / 2, z * (d / 2 - 0.05)));
}

const BUILDERS = {
  fridge: g => { g.add(box(0.8, 1.8, 0.7, WHITE, 0, 0.9, 0)); g.add(box(0.04, 0.5, 0.04, STEEL, 0.3, 1.2, 0.37)); g.add(box(0.04, 0.3, 0.04, STEEL, 0.3, 0.55, 0.37)); g.add(box(0.8, 0.02, 0.02, "#cccccc", 0, 0.82, 0.36)); },
  stove: g => { g.add(box(0.8, 0.9, 0.7, WHITE, 0, 0.45, 0)); g.add(box(0.8, 0.04, 0.7, BLACK, 0, 0.92, 0));
    for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) g.add(mesh(geo.cyl(0.1, 0.1, 0.02), mat("#555"), x, 0.95, z));
    g.add(box(0.6, 0.4, 0.02, "#333", 0, 0.45, 0.36)); },
  table: g => { g.add(box(1.3, 0.06, 0.9, WOOD, 0, 0.75, 0)); legsUnder(g, 1.3, 0.9, 0.72);
    for (const x of [-0.4, 0.4]) for (const z of [-0.65, 0.65]) { g.add(box(0.38, 0.05, 0.38, DARKWOOD, x, 0.45, z)); }
    g.add(mesh(geo.cyl(0.12, 0.1, 0.04), mat(WHITE), -0.3, 0.8, 0)); g.add(mesh(geo.cyl(0.12, 0.1, 0.04), mat(WHITE), 0.3, 0.8, 0)); },
  grill: g => { g.add(mesh(geo.cyl(0.4, 0.3, 0.4), mat(BLACK), 0, 0.85, 0)); g.add(mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(BLACK), 0, 1.05, 0));
    for (const a of [0, 2.1, 4.2]) g.add(box(0.04, 0.7, 0.04, "#444", Math.cos(a) * 0.25, 0.35, Math.sin(a) * 0.25)); },
  tv: g => { g.add(box(1.4, 0.45, 0.45, DARKWOOD, 0, 0.22, 0)); g.add(box(1.3, 0.75, 0.05, BLACK, 0, 0.9, 0)); const scr = box(1.2, 0.65, 0.01, "#2b5d8a", 0, 0.9, 0.03); scr.material = mat("#3a7bbf", { emissive: "#1d4f80" }); g.add(scr); },
  console: g => { g.add(box(0.5, 0.4, 0.4, DARKWOOD, 0, 0.2, 0)); g.add(box(0.36, 0.08, 0.26, BLACK, 0, 0.44, 0)); g.add(box(0.14, 0.04, 0.08, "#555", 0.1, 0.5, 0.1)); },
  stereo: g => { g.add(box(0.7, 0.5, 0.35, BLACK, 0, 0.25, 0)); for (const x of [-0.22, 0.22]) g.add(mesh(geo.cyl(0.11, 0.11, 0.02), mat("#555"), x, 0.27, 0.18).rotateX(Math.PI / 2)); },
  piano: g => { g.add(box(1.3, 0.1, 0.4, BLACK, 0, 0.8, 0)); g.add(box(1.2, 0.02, 0.15, WHITE, 0, 0.86, 0.1)); for (const x of [-0.55, 0.55]) g.add(box(0.05, 0.78, 0.05, BLACK, x, 0.39, 0)); },
  aquarium: g => { g.add(box(1.0, 0.6, 0.4, DARKWOOD, 0, 0.3, 0)); g.add(mesh(geo.box(0.95, 0.55, 0.38), mat("#6fc3e8", { transparent: true, opacity: 0.55 }), 0, 0.88, 0));
    g.add(mesh(geo.sph(0.05), mat("#ff8c1a"), -0.15, 0.9, 0.05)); g.add(mesh(geo.sph(0.04), mat("#ffd400"), 0.2, 0.8, -0.05)); },
  toys: g => { g.add(box(0.8, 0.45, 0.5, "#e74c3c", 0, 0.22, 0)); g.add(box(0.82, 0.06, 0.52, "#c0392b", 0, 0.47, 0)); g.add(mesh(geo.sph(0.12), mat("#3498db"), 0.25, 0.6, 0)); g.add(box(0.15, 0.15, 0.15, "#f1c40f", -0.2, 0.58, 0)); },
  books: g => { g.add(box(1.0, 1.8, 0.35, WOOD, 0, 0.9, 0));
    const colors = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#f39c12", "#16a085"];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) g.add(box(0.12, 0.3, 0.25, colors[(i + r) % 6], -0.36 + i * 0.145, 0.27 + r * 0.42, 0.05)); },
  computer: g => { g.add(box(1.2, 0.05, 0.6, WOOD, 0, 0.75, 0)); legsUnder(g, 1.2, 0.6, 0.72);
    g.add(box(0.6, 0.38, 0.03, BLACK, 0, 1.05, -0.15)); const s = box(0.55, 0.33, 0.01, "#7fb3e0", 0, 1.05, -0.13); s.material = mat("#7fb3e0", { emissive: "#305f8a" }); g.add(s);
    g.add(box(0.45, 0.02, 0.15, "#444", 0, 0.79, 0.1)); g.add(box(0.45, 0.06, 0.45, "#333", 0, 0.45, 0.6)); },
  treadmill: g => { g.add(box(0.7, 0.15, 1.5, "#333", 0, 0.08, 0)); g.add(box(0.6, 0.02, 1.3, "#111", 0, 0.17, 0)); for (const x of [-0.32, 0.32]) g.add(box(0.05, 1.1, 0.05, STEEL, x, 0.6, -0.65)); g.add(box(0.7, 0.2, 0.15, "#333", 0, 1.15, -0.65)); },
  couch: g => { const c = "#3f6fb5"; g.add(box(1.8, 0.4, 0.85, c, 0, 0.3, 0)); g.add(box(1.8, 0.6, 0.22, darken(c, 0.85), 0, 0.6, -0.33));
    for (const x of [-0.85, 0.85]) g.add(box(0.2, 0.55, 0.85, darken(c, 0.85), x, 0.38, 0)); g.add(box(0.7, 0.12, 0.6, "#5a8ad0", -0.37, 0.56, 0.05)); g.add(box(0.7, 0.12, 0.6, "#5a8ad0", 0.37, 0.56, 0.05)); },
  bed: g => { g.add(box(1.3, 0.35, 2.0, WOOD, 0, 0.18, 0)); g.add(box(1.25, 0.18, 1.9, WHITE, 0, 0.44, 0)); g.add(box(1.3, 0.8, 0.1, DARKWOOD, 0, 0.45, -1.0));
    g.add(box(1.27, 0.06, 1.2, "#6c8ebf", 0, 0.55, 0.35)); g.add(box(0.45, 0.12, 0.3, WHITE, -0.3, 0.58, -0.7)); g.add(box(0.45, 0.12, 0.3, WHITE, 0.3, 0.58, -0.7)); },
  toilet: g => { g.add(mesh(geo.cyl(0.22, 0.18, 0.4), mat(WHITE), 0, 0.2, 0.1)); g.add(mesh(geo.cyl(0.26, 0.26, 0.05), mat(WHITE), 0, 0.42, 0.12)); g.add(box(0.5, 0.45, 0.2, WHITE, 0, 0.62, -0.2)); },
  shower: g => { g.add(box(1.0, 0.08, 1.0, "#dfe9ee", 0, 0.04, 0)); g.add(mesh(geo.box(0.02, 2.0, 1.0), mat("#bfe6f5", { transparent: true, opacity: 0.35 }), 0.5, 1.0, 0));
    g.add(box(0.04, 1.9, 0.04, STEEL, -0.45, 0.95, -0.45)); g.add(mesh(geo.cyl(0.12, 0.08, 0.05), mat(STEEL), -0.35, 1.95, -0.35)); },
  tub: g => { g.add(box(0.85, 0.55, 1.7, WHITE, 0, 0.28, 0)); g.add(box(0.7, 0.05, 1.55, "#8fd3f4", 0, 0.5, 0)); g.add(box(0.05, 0.25, 0.05, STEEL, 0, 0.65, -0.8)); },
  vanity: g => { g.add(box(1.0, 0.75, 0.45, WHITE, 0, 0.38, 0)); g.add(mesh(geo.box(0.7, 0.8, 0.03), mat("#d8eef7", { emissive: "#405560" }), 0, 1.25, -0.2)); g.add(box(0.12, 0.12, 0.12, "#e84393", 0.3, 0.82, 0.05)); },
  hottub: g => { g.add(mesh(geo.cyl(1.0, 1.0, 0.7, 20), mat(WOOD), 0, 0.35, 0)); g.add(mesh(geo.cyl(0.88, 0.88, 0.05, 20), mat("#4fc3f7", { emissive: "#0b4f70" }), 0, 0.66, 0)); },
  plant: g => { g.add(mesh(geo.cyl(0.18, 0.13, 0.3), mat("#c0703d"), 0, 0.15, 0)); for (let i = 0; i < 5; i++) { const a = i * 1.25; g.add(mesh(geo.sph(0.16, 8, 6), mat("#3f9b4f"), Math.cos(a) * 0.12, 0.45 + (i % 2) * 0.1, Math.sin(a) * 0.12)); } },
  painting: g => { g.add(box(0.9, 0.65, 0.05, DARKWOOD, 0, 1.4, 0)); g.add(box(0.8, 0.55, 0.02, "#f6c26b", 0, 1.4, 0.03)); g.add(mesh(geo.sph(0.1), mat("#e67e22"), 0.15, 1.5, 0.05)); g.add(box(0.8, 0.15, 0.02, "#4caf50", 0, 1.2, 0.04)); g.add(box(0.04, 1.1, 0.04, DARKWOOD, 0, 0.55, -0.05)); },
  lamp: g => { g.add(mesh(geo.cyl(0.15, 0.18, 0.05), mat(BLACK), 0, 0.03, 0)); g.add(box(0.04, 1.4, 0.04, BLACK, 0, 0.72, 0)); g.add(mesh(geo.cyl(0.18, 0.28, 0.32, 14), mat("#fff3c4", { emissive: "#b38f2e" }), 0, 1.5, 0)); },
  flowers: g => { g.add(mesh(geo.cyl(0.1, 0.08, 0.3), mat("#7fb2d9", { transparent: true, opacity: 0.8 }), 0, 0.6, 0)); g.add(box(0.5, 0.45, 0.5, WOOD, 0, 0.22, 0));
    for (const [c, x, z] of [["#e84393", -0.06, 0], ["#fdcb6e", 0.06, 0.04], ["#ff7675", 0, -0.06]]) g.add(mesh(geo.sph(0.07), mat(c), x, 0.85, z)); },
  tree: g => { g.add(mesh(geo.cyl(0.08, 0.1, 0.3), mat(DARKWOOD), 0, 0.15, 0));
    [[0.55, 0.7, 0.55], [0.42, 0.6, 1.0], [0.28, 0.5, 1.4]].forEach(([r, h, y]) => g.add(mesh(new THREE.ConeGeometry(r, h, 12), mat("#2e7d32"), 0, y, 0)));
    g.add(mesh(new THREE.OctahedronGeometry(0.1), mat("#ffd700", { emissive: "#b8860b" }), 0, 1.72, 0));
    const lights = ["#ff5252", "#ffeb3b", "#40c4ff", "#69f0ae", "#ff80ab"];
    for (let i = 0; i < 18; i++) { const y = 0.45 + (i / 18) * 1.1, r = 0.5 * (1 - (y - 0.4) / 1.4) + 0.05, a = i * 2.4;
      const b = mesh(geo.sph(0.035, 6, 4), mat(lights[i % 5], { emissive: lights[i % 5] }), Math.cos(a) * r, y, Math.sin(a) * r); b.userData.twinkle = i; g.add(b); }
    g.add(box(0.25, 0.2, 0.25, "#d63031", 0.35, 0.1, 0.3)); g.add(box(0.2, 0.18, 0.2, "#0984e3", -0.3, 0.09, 0.35)); },
};

// Where a person stands/sits/lies relative to the object (local units) and which pose they use for each action.
export const USE = {
  bed:      { pose: { sleep: "lie", nap: "lie" }, at: [0, 0], y: 0, face: "out" },
  couch:    { pose: { relax: "sit", nap: "lie" }, at: [0, 0.12], y: 0.34, face: "out" },
  computer: { pose: { browse: "sit", games: "sit", work: "sit" }, at: [0, 0.6], y: 0.2, face: "in" },
  table:    { pose: { snack: "sit" }, at: [0.4, 0.65], y: 0.2, face: "in" },
  treadmill:{ pose: { workout: "run" }, at: [0, 0.1], y: 0.17, face: "in" },
  hottub:   { pose: { soak: "sit" }, at: [0.2, 0.3], y: 0.1, face: "out" },
  tub:      { pose: { bath: "lie" }, at: [0, 0], y: -0.15, face: "out" },
  stereo:   { pose: { dance: "dance" }, at: [0, 1.1], face: "in" },
  shower:   { pose: { shower: "idle" }, at: [-0.05, 0], face: "out" },
  toilet:   { pose: { toilet: "sit" }, at: [0, 0.15], y: 0.12, face: "out" },
  piano:    { pose: { music: "use" }, at: [0, 0.6], face: "in" },
  tv:       { pose: { tv: "idle" }, at: [0, 1.6], face: "in" },
  console:  { pose: { games: "use" }, at: [0, 1.4], face: "in" },
};
export function useSpot(type, action) {
  const u = USE[type] || {};
  return { pose: u.pose?.[action] || "use", at: u.at || [0, 0.9], y: u.y || 0, face: u.face || "in" };
}

export function buildFurniture(type) {
  const g = new THREE.Group();
  (BUILDERS[type] || BUILDERS.plant)(g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
