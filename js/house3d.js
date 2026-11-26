// 3D version of the playable house. Same rules as the 2D version (sim.js), drawn with Three.js.
import * as THREE from "../vendor/three.module.min.js";
import { HOUSEHOLDS, CHARACTERS, byId, relLabel } from "./characters.js";
import { avatarSvg } from "./avatar.js";
import { NEEDS, ROOMS, CATALOG, ROOM_COLORS, makeObjects, info, ACTIONS, SOCIALS, canDo, availableSocials,
  resolveSocial, chooseAutonomous, moodOf, favoriteOf } from "./sim.js";
import { buildPerson, animatePerson, buildFurniture, useSpot, mat } from "./models.js";
import { save } from "./state.js";

const W = 360, H = 560, U = 20;               // logical plan size; 20 logical px = 1 world unit
const DOOR = { x: 270, y: 548 };   // front door sits in the den's outside wall
const GAME_MIN_PER_SEC = 2, WALK_SPEED = 80, SELL_BACK = 0.8;
const MOOD_TEXT = { happy: "Happy", neutral: "Okay", sad: "Unhappy", annoyed: "Annoyed" };
const MOOD_COLOR = { happy: "#2ecc71", neutral: "#f1c40f", annoyed: "#f39c12", sad: "#e74c3c" };
const toW = (x, y) => new THREE.Vector3(x / U - W / U / 2, 0, y / U - H / U / 2);
const fromW = (v) => ({ x: (v.x + W / U / 2) * U, y: (v.z + H / U / 2) * U });

function fmtTime(t) {
  const day = Math.floor(t / 1440) + 1, m = Math.floor(t % 1440);
  const h24 = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `Day ${day} · ${((h24 + 11) % 12) + 1}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}
const clamp = v => Math.max(0, Math.min(100, v));
const money = v => "$" + Math.floor(v).toLocaleString();
const el = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const homeOf = id => HOUSEHOLDS.find(h => h.members.includes(id));

export function openHouse3d(app, state, hid, onExit) {
  const h = HOUSEHOLDS.find(x => x.id === hid);
  const saved = state.houses[hid] ||= {};
  saved.time ??= 8 * 60;
  saved.objects ||= makeObjects();
  saved.rooms ||= ROOMS.map(r => r.floor);
  saved.pos ||= {};
  let objIndex = {};
  const reindex = () => { objIndex = Object.fromEntries(saved.objects.map(o => [o.id, o])); };
  reindex();

  let sims = [], simById = {}, selected = null;
  let mode = "live", pending = null;
  let speed = 1, running = true, lastFrame = performance.now(), lastSave = 0, lastPanel = 0, clockT = 0;

  // ---------- Page ----------
  app.innerHTML = "";
  const bar = el(`<header class="bar play-bar" style="--hc:${h.color}">
    <button class="back" aria-label="Leave house">‹</button>
    <div class="ptitle"><h1>${h.name}</h1><div class="clock"></div></div>
    <div class="speeds">${[0, 1, 2, 3].map(s => `<button data-s="${s}" aria-label="Speed ${s}">${s === 0 ? "❚❚" : "▶".repeat(s)}</button>`).join("")}</div>
  </header>`);
  const clock = bar.querySelector(".clock");
  bar.querySelector(".back").onclick = () => leave();
  bar.querySelectorAll(".speeds button").forEach(b => b.onclick = () => { if (mode === "live") setSpeed(+b.dataset.s); });
  const setSpeed = s => { speed = s; bar.querySelectorAll(".speeds button").forEach(b => b.classList.toggle("on", +b.dataset.s === s)); };

  const view = el(`<div class="view3d"><canvas></canvas><div class="labels"></div>
    <div class="cam"><button data-r="-1" aria-label="Rotate left">⟲</button><button data-z="1" aria-label="Zoom in">＋</button><button data-z="-1" aria-label="Zoom out">－</button><button data-r="1" aria-label="Rotate right">⟳</button></div>
    <div class="build-tip hidden"></div></div>`);
  const canvas = view.querySelector("canvas"), labels = view.querySelector(".labels"), tip = view.querySelector(".build-tip");
  const panel = el(`<section class="panel"></section>`);
  const sheet = el(`<div class="sheet hidden"></div>`);
  app.append(bar, view, panel, sheet);

  // ---------- Three.js scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a7d3ee");
  const hemi = new THREE.HemisphereLight("#ffffff", "#6b8f4e", 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff6e0", 1.6);
  sun.position.set(-8, 16, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 18, bottom: -18, near: 1, far: 50 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat("#7fb069"));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
  // a little path to the front door
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 6), mat("#d9cbb0")); path.rotation.x = -Math.PI / 2;
  path.position.copy(toW(DOOR.x, DOOR.y + 60)); path.position.y = -0.05; path.receiveShadow = true; scene.add(path);

  const floors = ROOMS.map((r, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(r.w / U, 0.1, r.h / U), new THREE.MeshLambertMaterial({ color: saved.rooms[i] }));
    m.position.copy(toW(r.x + r.w / 2, r.y + r.h / 2)); m.position.y = -0.05; m.receiveShadow = true; m.userData.room = i;
    scene.add(m); return m;
  });

  // Walls: a doorway in the middle of every wall two rooms share, solid outside walls except the front door.
  // Far-side outside walls stand tall, near ones drop low so you can see in.
  const walls = [], doors = [];
  const wallMat = mat("#f2ece1"), trimMat = mat("#d8cbb5");
  const DOOR_GAP = 30;   // logical px
  function addWallSeg(x1, y1, x2, y2, exterior, gapAt) {
    const horiz = y1 === y2;
    const lo = horiz ? x1 : y1, hi = horiz ? x2 : y2;
    const pieces = gapAt == null ? [[lo, hi]] : [[lo, gapAt - DOOR_GAP / 2], [gapAt + DOOR_GAP / 2, hi]];
    for (const [a, b] of pieces) {
      if (b - a < 1) continue;
      const g = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), exterior ? wallMat : trimMat);
      g.castShadow = true; g.receiveShadow = true;
      g.position.copy(horiz ? toW((a + b) / 2, y1) : toW(x1, (a + b) / 2));
      g.userData = { horiz, len: (b - a) / U, exterior,
        nx: horiz ? 0 : (x1 === 0 ? -1 : 1), nz: horiz ? (y1 === 0 ? -1 : 1) : 0 };
      scene.add(g); walls.push(g);
    }
  }
  ROOMS.forEach((A, i) => ROOMS.forEach((B, j) => {
    if (j <= i) return;
    for (const [y, ok] of [[A.y + A.h, A.y + A.h === B.y], [A.y, A.y === B.y + B.h]]) if (ok) {
      const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.w, B.x + B.w);
      if (hi - lo > 0) { const gap = hi - lo >= 40 ? (lo + hi) / 2 : null; addWallSeg(lo, y, hi, y, false, gap); if (gap != null) doors.push({ a: i, b: j, x: gap, y, horiz: true }); }
    }
    for (const [x, ok] of [[A.x + A.w, A.x + A.w === B.x], [A.x, A.x === B.x + B.w]]) if (ok) {
      const lo = Math.max(A.y, B.y), hi = Math.min(A.y + A.h, B.y + B.h);
      if (hi - lo > 0) { const gap = hi - lo >= 40 ? (lo + hi) / 2 : null; addWallSeg(x, lo, x, hi, false, gap); if (gap != null) doors.push({ a: i, b: j, x, y: gap, horiz: false }); }
    }
  }));
  const roomAt = (x, y) => ROOMS.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  const frontRoom = roomAt(DOOR.x, H - 1);
  doors.push({ a: frontRoom, b: -1, x: DOOR.x, y: H, horiz: true });
  ROOMS.forEach(r => {
    if (r.y === 0) addWallSeg(r.x, 0, r.x + r.w, 0, true);
    if (r.y + r.h === H) addWallSeg(r.x, H, r.x + r.w, H, true, DOOR.x > r.x && DOOR.x < r.x + r.w ? DOOR.x : null);
    if (r.x === 0) addWallSeg(0, r.y, 0, r.y + r.h, true);
    if (r.x + r.w === W) addWallSeg(W, r.y, W, r.y + r.h, true);
  });

  // Route through doorways: breadth-first search over rooms, then step through each doorway in turn.
  const roomCenter = i => i < 0 ? { x: DOOR.x, y: H + 100 } : { x: ROOMS[i].x + ROOMS[i].w / 2, y: ROOMS[i].y + ROOMS[i].h / 2 };
  function pathTo(x0, y0, x1, y1) {
    const from = roomAt(x0, y0), to = roomAt(x1, y1);
    if (from === to) return [];
    const prev = new Map([[from, null]]), queue = [from];
    while (queue.length) {
      const r = queue.shift();
      if (r === to) break;
      for (const d of doors) {
        const next = d.a === r ? d.b : d.b === r ? d.a : undefined;
        if (next === undefined || prev.has(next)) continue;
        prev.set(next, { r, d }); queue.push(next);
      }
    }
    if (!prev.has(to)) return [];
    const steps = [];
    for (let r = to; prev.get(r); r = prev.get(r).r) steps.unshift(prev.get(r));
    const pts = [];
    for (const { r, d } of steps) {
      const c = roomCenter(r), side = d.horiz ? Math.sign(c.y - d.y) : Math.sign(c.x - d.x);
      pts.push(d.horiz ? { x: d.x, y: d.y + side * 16 } : { x: d.x + side * 16, y: d.y });
      pts.push(d.horiz ? { x: d.x, y: d.y - side * 16 } : { x: d.x - side * 16, y: d.y });
    }
    return pts;
  }

  function updateWalls() {
    const dx = Math.sin(cam.az), dz = Math.cos(cam.az);   // camera direction on the ground
    for (const w of walls) {
      const d = w.userData;
      const far = d.exterior && (d.nx * dx + d.nz * dz) < 0;
      const ht = far ? 2.2 : d.exterior ? 0.45 : 0.3;
      w.scale.set(d.horiz ? d.len : 0.12, ht, d.horiz ? 0.12 : d.len);
      w.position.y = ht / 2;
    }
  }
  // front door frame
  const doorFrame = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.16), mat("#8b5a2b")); p.position.set(s * 0.72, 0.3, 0); doorFrame.add(p); }
  const mat_ = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.5), mat("#a0522d")); mat_.position.set(0, 0.01, 0.4); doorFrame.add(mat_);
  doorFrame.position.copy(toW(DOOR.x, H)); scene.add(doorFrame);

  // ---------- Camera ----------
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const cam = { az: Math.PI / 4, el: 0.62, zoom: 1.45, target: new THREE.Vector3(0, 0, 0) };
  function placeCamera() {
    const r = 60;
    camera.position.set(cam.target.x + Math.sin(cam.az) * Math.cos(cam.el) * r, Math.sin(cam.el) * r, cam.target.z + Math.cos(cam.az) * Math.cos(cam.el) * r);
    camera.lookAt(cam.target);
    const rect = view.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const base = aspect < 0.8 ? 12.5 / aspect * 0.62 : 16;   // fit the whole house on a phone
    const half = base / cam.zoom;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
    updateWalls();
  }
  function resize() {
    const r = view.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    placeCamera();
  }
  const ro = new ResizeObserver(resize); ro.observe(view);

  view.querySelectorAll(".cam button").forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (b.dataset.r) cam.azTarget = (cam.azTarget ?? cam.az) + Math.PI / 2 * +b.dataset.r;
    if (b.dataset.z) cam.zoom = Math.max(0.8, Math.min(3, cam.zoom * (+b.dataset.z > 0 ? 1.3 : 1 / 1.3)));
    placeCamera();
  });

  // Touch/mouse: tap = act, one-finger drag = pan, two fingers = pinch zoom + twist rotate, wheel = zoom.
  const pointers = new Map();
  let drag = null;
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, moved: false, multi: pointers.size > 1 };
    if (pointers.size === 2) drag.pinch = pinchInfo();
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId) || !drag) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
    if (pointers.size === 2 && drag.pinch) {
      const p = pinchInfo();
      cam.zoom = Math.max(0.8, Math.min(3, cam.zoom * p.d / drag.pinch.d));
      cam.az -= (p.a - drag.pinch.a); cam.azTarget = undefined;
      drag.pinch = p; drag.moved = true; placeCamera();
    } else if (pointers.size === 1 && drag.moved) {
      const k = (camera.right - camera.left) / canvas.clientWidth;
      const dx = (e.clientX - prev.x) * k, dy = (e.clientY - prev.y) * k / Math.sin(cam.el);
      const right = new THREE.Vector3(Math.cos(cam.az), 0, -Math.sin(cam.az));
      const fwd = new THREE.Vector3(Math.sin(cam.az), 0, Math.cos(cam.az));
      cam.target.addScaledVector(right, -dx).addScaledVector(fwd, -dy);
      cam.target.x = Math.max(-12, Math.min(12, cam.target.x)); cam.target.z = Math.max(-16, Math.min(16, cam.target.z));
      placeCamera();
    }
  });
  const endPointer = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (drag && !drag.moved && !drag.multi && pointers.size === 0) tap(e.clientX, e.clientY);
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", e => { pointers.delete(e.pointerId); drag = null; });
  canvas.addEventListener("wheel", e => { e.preventDefault(); cam.zoom = Math.max(0.8, Math.min(3, cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); placeCamera(); }, { passive: false });
  function pinchInfo() {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  // ---------- Picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy, list) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(list, true);
  }
  function ownerOf(o) { while (o && !o.userData.simId && !o.userData.objId && o.userData.room === undefined) o = o.parent; return o; }
  function floorPoint(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }

  function tap(cx, cy) {
    closeSheet();
    const fp = floorPoint(cx, cy);
    const lp = fp && fromW(fp);
    const inside = lp && lp.x >= 0 && lp.x <= W && lp.y >= 0 && lp.y <= H;
    if (mode === "build") {
      if (pending) { if (inside) buildPlace(lp.x, lp.y); return; }
      const hit = pick(cx, cy, objGroup.children)[0];
      if (hit) return buildObjectMenu(objIndex[ownerOf(hit.object).userData.objId]);
      if (inside) { const i = ROOMS.findIndex(r => lp.x >= r.x && lp.x < r.x + r.w && lp.y >= r.y && lp.y < r.y + r.h); if (i >= 0) paintMenu(i); }
      return;
    }
    const hitSim = pick(cx, cy, simGroup.children)[0];
    if (hitSim) { const s = simById[ownerOf(hitSim.object).userData.simId]; if (s) return simTapped(s); }
    const hitObj = pick(cx, cy, objGroup.children)[0];
    if (hitObj) return objectMenu(objIndex[ownerOf(hitObj.object).userData.objId]);
    if (selected && inside) command(selected, { type: "walk", x: lp.x, y: lp.y });
  }

  // ---------- Furniture ----------
  const objGroup = new THREE.Group(); scene.add(objGroup);
  function drawObjects() {
    objGroup.clear();
    for (const o of saved.objects) {
      const g = buildFurniture(o.type);
      g.position.copy(toW(o.x, o.y));
      g.rotation.y = -(o.rot || 0) * Math.PI / 2;
      g.userData.objId = o.id;
      if (pending?.obj === o) g.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.45; } });
      objGroup.add(g);
    }
    floors.forEach((f, i) => f.material.color.set(saved.rooms[i]));
  }
  const twinkle = () => objGroup.traverse(m => { if (m.userData.twinkle !== undefined) m.visible = Math.sin(clockT * 3 + m.userData.twinkle) > -0.3; });

  // Where a person goes to use an object, in logical coords, plus their pose and facing.
  function spotFor(o, action, s) {
    const u = useSpot(o.type, action);
    const users = sims.filter(x => x !== s && x.task?.obj === o.id).length;
    const rot = -(o.rot || 0) * Math.PI / 2;
    const lx = u.at[0] + (u.pose === "lie" ? (users ? 0.35 : -0.25) * (o.type === "bed" ? 1 : 0) : users * 0.5), lz = u.at[1];
    const wx = lx * Math.cos(rot) + lz * Math.sin(rot), wz = -lx * Math.sin(rot) + lz * Math.cos(rot);
    const c = toW(o.x, o.y);
    const p = fromW(new THREE.Vector3(c.x + wx, 0, c.z + wz));
    const faceAngle = u.face === "out" ? rot : rot + Math.PI;
    return { x: p.x, y: p.y, pose: u.pose, lift: u.y, faceAngle };
  }

  // ---------- People ----------
  const simGroup = new THREE.Group(); scene.add(simGroup);
  const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 8, 32);
  function presentIds() {
    const members = h.members.filter(id => !state.away[id]);
    const visitors = Object.entries(state.away).filter(([, at]) => at === hid).map(([id]) => id);
    return [...members, ...visitors];
  }
  function syncSims() {
    const ids = presentIds();
    sims = sims.filter(s => { if (ids.includes(s.id)) return true; simGroup.remove(s.model); s.label.remove(); return false; });
    for (const id of ids) {
      if (sims.some(s => s.id === id)) continue;
      const c = byId[id], p = saved.pos[id];
      const s = { id, c, visitor: !h.members.includes(id),
        needs: state.needs[id] ||= Object.fromEntries(Object.keys(NEEDS).map(n => [n, 70 + Math.random() * 25])),
        x: p?.x ?? DOOR.x, y: p?.y ?? DOOR.y - 10, task: null, idle: Math.random() * 6, bubble: null, mood: "happy", heading: 0, phase: Math.random() * 10 };
      buildModel(s);
      s.label = el(`<div class="tag3d"><div class="bubble" data-who="${c.name}"></div><span class="nm">${c.name}</span></div>`);
      labels.append(s.label);
      sims.push(s);
    }
    simById = Object.fromEntries(sims.map(s => [s.id, s]));
    if (!selected || !simById[selected.id]) selected = sims.find(s => s.c.player) || sims.find(s => !s.visitor) || sims[0] || null;
    renderPanel();
  }
  function buildModel(s) {
    if (s.model) simGroup.remove(s.model);
    const g = new THREE.Group();
    s.person = buildPerson(state.looks[s.id], { age: s.c.age, years: s.c.years });
    g.add(s.person);
    s.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#2ecc71", transparent: true, opacity: 0.9 }));
    s.ring.rotation.x = Math.PI / 2; s.ring.position.y = 0.03; g.add(s.ring);
    g.userData.simId = s.id;
    s.model = g; simGroup.add(g);
  }

  // ---------- Sheets ----------
  function openSheet(title, items, extraClass = "") {
    sheet.innerHTML = `<div class="sheet-card ${extraClass}"><div class="sheet-title">${title}</div></div>`;
    const card = sheet.firstElementChild;
    for (const it of items) {
      if (it.html) { const n = el(it.html); it.bind?.(n); card.append(n); continue; }
      const b = el(`<button class="sheet-item" ${it.disabled ? "disabled" : ""}><span>${it.label}</span>${it.note ? `<small>${it.note}</small>` : ""}</button>`);
      b.onclick = () => { closeSheet(); it.run(); };
      card.append(b);
    }
    const cancel = el(`<button class="sheet-item cancel">Close</button>`); cancel.onclick = closeSheet; card.append(cancel);
    sheet.classList.remove("hidden");
    sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  }
  function closeSheet() { sheet.classList.add("hidden"); }

  function objectMenu(o) {
    if (!o || !selected) return;
    const it = info(o);
    if (!it.actions.length) { say(selected, `Nice ${it.label.toLowerCase()} ✨`); return; }
    const fav = favoriteOf(selected.c, state.custom[selected.id]);
    openSheet(`${it.icon} ${it.label} · ${selected.c.name}`, it.actions.map(a => ({
      label: ACTIONS[a].label + (a === fav ? " ❤️" : ""), disabled: !canDo(selected.c, a),
      note: !canDo(selected.c, a) ? (ACTIONS[a].adultsOnly ? "Grown-ups only" : "Kids only") : "",
      run: () => command(selected, { type: "action", obj: o.id, action: a }),
    })));
  }
  function simTapped(s) {
    if (s === selected) return;
    const rel = state.rel[`${selected.id}|${s.id}`];
    const items = availableSocials(selected.c, s.c, rel).map(t => ({ label: SOCIALS[t].label, run: () => command(selected, { type: "social", target: s.id, social: t }) }));
    items.push({ label: `▶ Play as ${s.c.name}`, run: () => { selected = s; renderPanel(); } });
    if (s.visitor) items.push({ label: `👋 Send ${s.c.name} home`, run: () => sendHome(s.id) });
    openSheet(`${selected.c.name} → ${s.c.name} <small>(${relLabel(selected.id, s.id)}, ${Math.round(rel)}/100)</small>`, items);
  }

  // ---------- Visiting ----------
  function inviteMenu() {
    const here = new Set(presentIds());
    openSheet("Invite someone over", CHARACTERS.filter(c => !here.has(c.id)).map(c => {
      const at = state.away[c.id], mine = h.members.includes(c.id);
      return { label: `${mine ? "🏠 Call home: " : ""}${c.name}`, note: at ? `At ${HOUSEHOLDS.find(x => x.id === at).name}` : homeOf(c.id).name, run: () => invite(c.id) };
    }), "tall");
  }
  function invite(id) {
    if (h.members.includes(id)) delete state.away[id]; else state.away[id] = hid;
    delete saved.pos[id];
    syncSims();
    const s = simById[id];
    if (s) { s.x = DOOR.x; s.y = DOOR.y + 30; command(s, { type: "walk", x: DOOR.x + (Math.random() * 60 - 30), y: DOOR.y - 50 }); say(s, s.visitor ? "Hey y'all! 👋" : "I'm home!"); }
    persist();
  }
  function sendHome(id) { delete state.away[id]; delete saved.pos[id]; syncSims(); persist(); }

  // ---------- Build mode ----------
  function setMode(m) {
    mode = m; pending = null;
    view.classList.toggle("building", m === "build");
    setSpeed(m === "build" ? 0 : 1);
    simGroup.visible = m !== "build"; labels.style.display = m === "build" ? "none" : "";
    drawObjects(); renderPanel(); updateTip();
  }
  function updateTip() {
    if (mode !== "build") { tip.classList.add("hidden"); return; }
    tip.classList.remove("hidden");
    tip.textContent = pending?.kind === "buy" ? `Tap where to put the ${CATALOG[pending.type].label.toLowerCase()}`
      : pending?.kind === "move" ? `Tap where to move the ${info(pending.obj).label.toLowerCase()}`
      : "Tap furniture to move, turn or sell it. Tap a floor to paint it.";
  }
  function buildPlace(x, y) {
    if (pending.kind === "buy") {
      const it = CATALOG[pending.type];
      if (state.funds[hid] >= it.price) { state.funds[hid] -= it.price; saved.objects.push({ id: `${pending.type}-${Date.now().toString(36)}`, type: pending.type, x, y, rot: 0 }); }
    } else { pending.obj.x = x; pending.obj.y = y; }
    pending = null; reindex(); drawObjects(); renderPanel(); updateTip(); persist();
  }
  function paintMenu(i) {
    openSheet(`Paint the ${ROOMS[i].name.toLowerCase()} floor`, [{
      html: `<div class="paints">${ROOM_COLORS.map(c => `<button class="swatch${saved.rooms[i] === c ? " on" : ""}" style="background:${c}" data-c="${c}" aria-label="Color ${c}"></button>`).join("")}</div>`,
      bind: n => n.querySelectorAll("button").forEach(b => b.onclick = () => { saved.rooms[i] = b.dataset.c; drawObjects(); closeSheet(); persist(); }),
    }]);
  }
  function buildObjectMenu(o) {
    const it = info(o), refund = Math.round(it.price * SELL_BACK);
    openSheet(`${it.icon} ${it.label}`, [
      { label: "Move it", run: () => { pending = { kind: "move", obj: o }; drawObjects(); updateTip(); } },
      { label: "Turn it ⟳", run: () => { o.rot = ((o.rot || 0) + 1) % 4; drawObjects(); persist(); } },
      { label: "Sell it", note: `+${money(refund)}`, run: () => {
        state.funds[hid] += refund; saved.objects = saved.objects.filter(x => x !== o);
        for (const s of sims) if (s.task?.obj === o.id) s.task = null;
        reindex(); drawObjects(); renderPanel(); persist();
      } },
    ]);
  }
  function catalogMenu() {
    const items = [];
    for (const cat of [...new Set(Object.values(CATALOG).map(c => c.cat))]) {
      items.push({ html: `<div class="cat-head">${cat}</div>` });
      for (const [type, it] of Object.entries(CATALOG).filter(([, v]) => v.cat === cat))
        items.push({ label: `${it.icon} ${it.label}`, note: money(it.price), disabled: state.funds[hid] < it.price, run: () => { pending = { kind: "buy", type }; updateTip(); } });
    }
    openSheet(`Buy furniture <small>(you have ${money(state.funds[hid])})</small>`, items, "tall");
  }

  // ---------- Commands ----------
  function command(s, task) {
    s.idle = 0;
    if (task.type === "action") {
      const o = objIndex[task.obj]; if (!o) return;
      const sp = spotFor(o, task.action, s);
      task = { ...task, ...sp, phase: "walk", remaining: ACTIONS[task.action].mins };
    } else task = { ...task, phase: "walk" };
    task.path = task.type === "social" ? [] : pathTo(s.x, s.y, task.x, task.y);
    s.task = task;
  }
  function say(s, text, secs = 3.8) { s.bubble = { text, until: performance.now() + secs * 1000 }; }
  function finishSocial(s, t) {
    const target = simById[t.target]; if (!target) return;
    const keyA = `${s.id}|${target.id}`, keyB = `${target.id}|${s.id}`;
    const res = resolveSocial(t.social, s.c, target.c, state.rel[keyA], state.custom[s.id]?.phrases || []);
    state.rel[keyA] = clamp(state.rel[keyA] + res.delta); state.rel[keyB] = clamp(state.rel[keyB] + res.delta);
    const soc = SOCIALS[t.social];
    s.needs.social = clamp(s.needs.social + soc.social);
    target.needs.social = clamp(target.needs.social + (res.ok ? soc.social : soc.social / 3));
    if (soc.fun && res.ok) { s.needs.fun = clamp(s.needs.fun + soc.fun); target.needs.fun = clamp(target.needs.fun + soc.fun); }
    s.heading = Math.atan2(target.x - s.x, target.y - s.y);
    if (!target.task) target.heading = Math.atan2(s.x - target.x, s.y - target.y);
    say(s, res.line); setTimeout(() => say(target, res.reply, 3), 1200);
    s.gesture = { kind: t.social === "hug" ? "hug" : "talk", until: performance.now() + 1800 };
    target.idle = -4; s.idle = -3;
  }

  // ---------- Simulation ----------
  function step(dt) {
    const gmin = dt * GAME_MIN_PER_SEC * speed;
    saved.time += gmin;
    const hour = Math.floor(saved.time % 1440 / 60);
    for (const s of sims) {
      const t = s.task, doing = t?.phase === "do" ? ACTIONS[t.action] : null;
      for (const [n, inf] of Object.entries(NEEDS)) {
        if (doing?.gain[n] > 0) continue;
        s.needs[n] = clamp(s.needs[n] - inf.decay * gmin * (doing?.until === "energy" ? 0.3 : 1));
      }
      if (s.needs.bladder <= 0) { s.needs.bladder = 100; s.needs.hygiene = 0; say(s, "Oops… 😳"); }
      if (!t) {
        s.idle += gmin;
        if (s.idle > 12) {
          s.idle = 0;
          const others = sims.filter(o => o !== s && o.task?.action !== "sleep");
          const night = hour >= 22 || hour < 6, fav = favoriteOf(s.c, state.custom[s.id]);
          if (night && s.needs.energy < 85 && s.visitor) { say(s, "It's late, I'm heading home! 👋"); command(s, { type: "walk", x: DOOR.x, y: DOOR.y + 40, leaving: true }); continue; }
          const pk = night && s.needs.energy < 85 ? { kind: "action", obj: bedFor(s), action: "sleep" } : chooseAutonomous(s.c, s, others, saved.objects, fav);
          if (pk?.kind === "action" && pk.obj) command(s, { type: "action", obj: pk.obj, action: pk.action });
          if (pk?.kind === "social") command(s, { type: "social", target: pk.target.id, social: autoSocial(s, pk.target) });
        }
        continue;
      }
      if (t.phase === "walk") {
        let tx = t.x, ty = t.y;
        if (t.type === "social") {
          const o = simById[t.target]; if (!o) { s.task = null; continue; }
          tx = o.x + (s.x < o.x ? -22 : 22); ty = o.y;
          if (!t.path.length && roomAt(s.x, s.y) !== roomAt(o.x, o.y)) t.path = pathTo(s.x, s.y, o.x, o.y);
        }
        const via = t.path[0];
        if (via) { tx = via.x; ty = via.y; }
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), stepLen = WALK_SPEED * dt * speed;
        if (d > 0.5) s.heading = Math.atan2(dx, dy);
        if (via && d <= stepLen + 0.5) { s.x = tx; s.y = ty; t.path.shift(); continue; }
        if (d <= stepLen + 0.5) {
          s.x = tx; s.y = ty;
          if (t.type === "walk") { s.task = null; if (t.leaving) sendHome(s.id); }
          else if (t.type === "social") { finishSocial(s, t); s.task = null; }
          else { t.phase = "do"; s.heading = t.faceAngle; if (t.action === favoriteOf(s.c, state.custom[s.id])) say(s, "❤️ My favorite!"); }
        } else { s.x += dx / d * stepLen; s.y += dy / d * stepLen; }
      } else if (t.phase === "do") {
        const a = ACTIONS[t.action];
        const fav = t.action === favoriteOf(s.c, state.custom[s.id]);
        for (const [n, g] of Object.entries(a.gain)) s.needs[n] = clamp(s.needs[n] + g * gmin);
        if (fav) s.needs.fun = clamp(s.needs.fun + 0.5 * gmin);
        if (a.pay) state.funds[s.visitor ? homeOf(s.id).id : hid] += a.pay * gmin / 60;
        t.remaining -= gmin;
        if (t.remaining <= 0 || (a.until && s.needs[a.until] >= 100)) { s.task = null; s.idle = 6; nudgeOff(s); }
      }
      s.mood = moodOf(s.c, s.needs);
    }
  }
  // step off furniture after using it
  function nudgeOff(s) {
    const a = s.heading, r = roomAt(s.x, s.y);
    const nx = Math.max(12, Math.min(W - 12, s.x + Math.sin(a) * 24)), ny = Math.max(12, Math.min(H - 12, s.y + Math.cos(a) * 24));
    if (roomAt(nx, ny) === r) { s.x = nx; s.y = ny; }
  }
  function bedFor(s) {
    const beds = saved.objects.filter(o => o.type === "bed" || o.type === "couch"); if (!beds.length) return null;
    const load = b => sims.filter(o => o !== s && o.task?.obj === b.id).length;
    beds.sort((a, b) => load(a) - load(b) || (a.type === "bed" ? -1 : 1));
    return beds[0].id;
  }
  function autoSocial(s, target) {
    const opts = availableSocials(s.c, target.c, state.rel[`${s.id}|${target.id}`]);
    if (s.c.traits.includes("sassy") && Math.random() < 0.5) return opts.includes("roast") && Math.random() < 0.5 ? "roast" : "blunt";
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // ---------- Draw ----------
  const tmp = new THREE.Vector3();
  function render(now) {
    clockT += 1 / 60;
    if (cam.azTarget !== undefined) {
      const d = cam.azTarget - cam.az;
      if (Math.abs(d) < 0.01) { cam.az = cam.azTarget; cam.azTarget = undefined; } else cam.az += d * 0.18;
      placeCamera();
    }
    clock.textContent = fmtTime(saved.time);
    // daylight follows the clock
    const hr = (saved.time % 1440) / 60, day = Math.max(0, Math.min(1, Math.sin((hr - 6) / 12 * Math.PI) * 1.6));
    sun.intensity = 0.25 + day * 1.4; hemi.intensity = 0.45 + day * 0.7;
    scene.background.setHSL(0.57, 0.55, 0.18 + day * 0.55);
    twinkle();

    const vr = canvas.getBoundingClientRect();
    const shown = [];
    for (const s of sims) {
      const t = s.task;
      let pose = "idle", lift = 0;
      if (t?.phase === "walk") pose = "walk";
      else if (t?.phase === "do") { pose = t.pose; lift = t.lift || 0; }
      if (s.gesture && now < s.gesture.until && pose === "idle") pose = s.gesture.kind === "hug" ? "use" : "idle";
      // standing around with nothing to do: after a moment, turn toward the camera so you can see faces
      if (!t && !(s.gesture && now < s.gesture.until)) {
        s.idleReal = (s.idleReal || 0) + 1 / 60;
        if (s.idleReal > 3.5) s.heading = cam.az + Math.sin(s.phase) * 0.35;
      } else s.idleReal = 0;
      const w = toW(s.x, s.y);
      s.model.position.set(w.x, lift, w.z);
      // turn smoothly toward heading
      let d = s.heading - s.person.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      s.person.rotation.y += d * Math.min(1, 0.25 * speed + 0.15);
      animatePerson(s.person, speed === 0 && pose === "walk" ? "idle" : pose, clockT * Math.max(1, speed) + s.phase);
      s.ring.visible = s === selected;
      s.ring.material.color.set(MOOD_COLOR[s.mood]);
      s.ring.position.y = 0.03 - lift;
      // label above head
      tmp.set(w.x, lift + (pose === "lie" ? 1.2 : 2.15) * s.person.scale.y, w.z).project(camera);
      const sx = (tmp.x + 1) / 2 * vr.width, sy = (1 - tmp.y) / 2 * vr.height;
      s.label.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      s.labelPos = { sx, sy };
      s.label.classList.toggle("sel", s === selected);
      s.label.style.setProperty("--mood", MOOD_COLOR[s.mood]);
      const b = s.label.querySelector(".bubble");
      const zzz = t?.phase === "do" && (t.action === "sleep" || t.action === "nap") ? "💤" : "";
      const txt = s.bubble && now < s.bubble.until ? s.bubble.text : zzz;
      if (txt) {
        if (b.dataset.t !== txt) { b.dataset.t = txt; b.textContent = txt; }
        b.classList.add("show");
        shown.push({ s, b, sx, sy });
      } else { b.classList.remove("show"); s.bubbleLift = 0; b.style.setProperty("--lift", "0px"); }
    }
    spreadBubbles(shown);
    shown.length = 0;
    renderer.render(scene, camera);
    if (now - lastPanel > 250) { updatePanel(); lastPanel = now; }
  }

  // Keep speech bubbles from covering each other: the one nearest the front stays put, others stack upward.
  function spreadBubbles(list) {
    const NAME_H = 16, GAP = 4, EDGE = 6, vw = labels.clientWidth;
    // name tags are obstacles too, so a bubble never hides someone's name
    const placed = sims.filter(x => x.labelPos).map(x => {
      const w = x.label.querySelector(".nm").offsetWidth;
      return { left: x.labelPos.sx - w / 2, right: x.labelPos.sx + w / 2, top: x.labelPos.sy - NAME_H, bottom: x.labelPos.sy, owner: x };
    });
    list.sort((a, b) => b.sy - a.sy);
    const crowd = list.length > 1;   // name the speaker whenever more than one person is talking
    for (const it of list) it.b.classList.toggle("lifted", crowd);
    for (const it of list) {
      const w = it.b.offsetWidth, h = it.b.offsetHeight;
      // keep the bubble on screen sideways
      let left = it.sx - w / 2;
      const dx = Math.max(EDGE - left, Math.min(0, vw - EDGE - (left + w)));
      left += dx;
      const right = left + w;
      const baseTop = it.sy - NAME_H - GAP - h;
      let top = baseTop, moved = true, guard = 0;
      while (moved && guard++ < 16) {
        moved = false;
        for (const p of placed) {
          if (p.owner === it.s) continue;
          if (right + GAP > p.left && left - GAP < p.right && top + h + GAP > p.top && top - GAP < p.bottom) { top = p.top - h - GAP; moved = true; }
        }
      }
      placed.push({ left, right, top, bottom: top + h });
      it.s.bubbleLift = baseTop - top;
      it.b.style.setProperty("--lift", `${Math.round(it.s.bubbleLift)}px`);
      it.b.style.setProperty("--dx", `${Math.round(dx)}px`);
    }
  }

  // ---------- Panel ----------
  function renderPanel() {
    if (mode === "build") {
      panel.innerHTML = `<div class="build-panel"><div class="funds">${money(state.funds[hid])}</div><button class="btn buy">🛒 Buy furniture</button><button class="btn ghost done">Done</button></div>`;
      panel.querySelector(".buy").onclick = catalogMenu;
      panel.querySelector(".done").onclick = () => setMode("live");
      return;
    }
    panel.innerHTML = `
      <div class="who"><div class="pface"></div><div class="pinfo"><b class="pname"></b><small class="pstatus"></small></div><button class="stop btn ghost">Stop</button></div>
      <div class="needs">${Object.entries(NEEDS).map(([k, n]) => `<div class="need" data-n="${k}"><span>${n.icon} ${n.label}</span><span class="meter"><i></i></span></div>`).join("")}</div>
      <div class="row"><div class="switch">${sims.map(s => `<button data-id="${s.id}" class="${s === selected ? "on" : ""}${s.visitor ? " vis" : ""}" aria-label="Play as ${s.c.name}">${avatarSvg(state.looks[s.id], { age: s.c.age, years: s.c.years, size: 30 })}</button>`).join("")}</div>
      <div class="tools"><span class="funds">${money(state.funds[hid])}</span><button class="tool invite">👋 Invite</button><button class="tool build">🔨 Build</button></div></div>`;
    panel.querySelector(".stop").onclick = () => { if (selected) { selected.task = null; selected.idle = -20; } };
    panel.querySelectorAll(".switch button").forEach(b => b.onclick = () => { selected = simById[b.dataset.id]; renderPanel(); });
    panel.querySelector(".invite").onclick = inviteMenu;
    panel.querySelector(".build").onclick = () => setMode("build");
    if (selected) panel.querySelector(".pface").innerHTML = avatarSvg(state.looks[selected.id], { age: selected.c.age, years: selected.c.years, size: 44 });
    updatePanel();
  }
  function updatePanel() {
    const f = panel.querySelector(".funds"); if (f) f.textContent = money(state.funds[hid]);
    if (mode === "build") return;
    const s = selected;
    if (!s) { panel.querySelector(".pname").textContent = "Nobody's home"; panel.querySelector(".pstatus").textContent = "Tap Invite to call someone over."; panel.querySelector(".stop").style.visibility = "hidden"; return; }
    panel.querySelector(".pname").textContent = s.c.name + (s.visitor ? " (visiting)" : "");
    const t = s.task;
    const status = !t ? "Free time" : t.type === "walk" ? "Walking" : t.type === "social"
      ? `Going to ${SOCIALS[t.social].label.toLowerCase()} with ${simById[t.target]?.c.name || "someone"}`
      : t.phase === "walk" ? `Heading to the ${info(objIndex[t.obj] || { type: "plant" }).label.toLowerCase()}` : ACTIONS[t.action].verb;
    panel.querySelector(".pstatus").textContent = `${MOOD_TEXT[s.mood]} · ${status}`;
    panel.querySelector(".stop").style.visibility = t ? "visible" : "hidden";
    for (const [n, v] of Object.entries(s.needs)) {
      const i = panel.querySelector(`.need[data-n="${n}"] i`);
      i.style.width = `${v}%`; i.style.background = v >= 60 ? "#2ecc71" : v >= 30 ? "#f1c40f" : "#e74c3c";
    }
  }

  function persist() { for (const s of sims) saved.pos[s.id] = { x: s.x, y: s.y }; save(state); }
  function leave() { persist(); running = false; ro.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); onExit(); }
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) persist(); });

  drawObjects();
  syncSims();
  setSpeed(1);
  resize();
  if (location.hash === "#debug") window.__house = { get sims() { return sims; }, roomAt, doors };
  renderer.setAnimationLoop(() => {
    if (!running) return;
    const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (speed > 0) step(dt);
    render(now);
    if (now - lastSave > 5000) { persist(); lastSave = now; }
  });
}
