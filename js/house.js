// The playable house: characters walk around, use objects, talk, and live on their own.
// Build mode lets you buy, move and sell furniture and paint rooms. You can invite anyone over.
import { HOUSEHOLDS, CHARACTERS, byId, relLabel } from "./characters.js";
import { avatarSvg } from "./avatar.js";
import { NEEDS, ROOMS, CATALOG, ROOM_COLORS, makeObjects, info, ACTIONS, SOCIALS, canDo, availableSocials,
  resolveSocial, chooseAutonomous, moodOf, favoriteOf } from "./sim.js";
import { save } from "./state.js";

const W = 360, H = 560, DOOR = { x: 180, y: 545 };
const GAME_MIN_PER_SEC = 2;   // at 1x, one real second is two game minutes
const WALK_SPEED = 80;        // logical px per real second at 1x
const MOOD_TEXT = { happy: "Happy", neutral: "Okay", sad: "Unhappy", annoyed: "Annoyed" };
const SELL_BACK = 0.8;

function fmtTime(t) {
  const day = Math.floor(t / 1440) + 1, m = Math.floor(t % 1440);
  const h24 = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  const h12 = ((h24 + 11) % 12) + 1;
  return `Day ${day} · ${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}
const clamp = v => Math.max(0, Math.min(100, v));
const money = v => "$" + Math.floor(v).toLocaleString();
const el = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const homeOf = id => HOUSEHOLDS.find(h => h.members.includes(id));

export function openHouse(app, state, hid, onExit) {
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
  let mode = "live", pending = null;   // pending: { kind: "buy", type } | { kind: "move", obj }
  let speed = 1, running = true, lastFrame = performance.now(), lastSave = 0, lastPanel = 0;

  // ---------- DOM ----------
  app.innerHTML = "";
  const bar = el(`<header class="bar play-bar" style="--hc:${h.color}">
    <button class="back" aria-label="Leave house">‹</button>
    <div class="ptitle"><h1>${h.name}</h1><div class="clock"></div></div>
    <div class="speeds">${[0, 1, 2, 3].map(s => `<button data-s="${s}" aria-label="Speed ${s}">${s === 0 ? "❚❚" : "▶".repeat(s)}</button>`).join("")}</div>
  </header>`);
  const clock = bar.querySelector(".clock");
  bar.querySelector(".back").onclick = () => { persist(); running = false; onExit(); };
  bar.querySelectorAll(".speeds button").forEach(b => b.onclick = () => { if (mode === "live") setSpeed(+b.dataset.s); });
  const setSpeed = s => { speed = s; bar.querySelectorAll(".speeds button").forEach(b => b.classList.toggle("on", +b.dataset.s === s)); };

  const stageWrap = el(`<div class="stage-wrap"><div class="stage" style="width:${W}px;height:${H}px"></div><div class="build-tip hidden"></div></div>`);
  const stage = stageWrap.querySelector(".stage");
  const tip = stageWrap.querySelector(".build-tip");
  const roomNodes = ROOMS.map((r, i) => {
    const n = el(`<div class="room" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"><span>${r.name}</span></div>`);
    stage.append(n); return n;
  });
  const door = el(`<div class="door" style="left:${DOOR.x - 20}px;top:${H - 8}px"></div>`); stage.append(door);
  const objLayer = el(`<div class="objs"></div>`); stage.append(objLayer);
  const simLayer = el(`<div class="sims"></div>`); stage.append(simLayer);

  stage.onclick = e => {
    const r = stage.getBoundingClientRect(), k = r.width / W;
    const x = Math.max(20, Math.min(W - 20, (e.clientX - r.left) / k)), y = Math.max(20, Math.min(H - 20, (e.clientY - r.top) / k));
    closeSheet();
    if (mode === "build") return buildTap(x, y);
    if (selected) command(selected, { type: "walk", x, y });
  };

  const panel = el(`<section class="panel"></section>`);
  const sheet = el(`<div class="sheet hidden"></div>`);
  app.append(bar, stageWrap, panel, sheet);

  function fitStage() {
    const avail = stageWrap.getBoundingClientRect();
    const k = Math.min(avail.width / W, avail.height / H);
    stage.style.transform = `scale(${k})`;
    stageWrap.style.setProperty("--sw", `${W * k}px`);
    stageWrap.style.setProperty("--sh", `${H * k}px`);
  }
  const ro = new ResizeObserver(fitStage); ro.observe(stageWrap); fitStage();

  // ---------- People in the house ----------
  function presentIds() {
    const members = h.members.filter(id => !state.away[id]);
    const visitors = Object.entries(state.away).filter(([, at]) => at === hid).map(([id]) => id);
    return [...members, ...visitors];
  }

  function syncSims() {
    const ids = presentIds();
    sims = sims.filter(s => { if (ids.includes(s.id)) return true; s.node.remove(); return false; });
    for (const id of ids) {
      if (sims.some(s => s.id === id)) continue;
      const c = byId[id];
      const p = saved.pos[id];
      const s = {
        id, c, visitor: !h.members.includes(id),
        needs: state.needs[id] ||= Object.fromEntries(Object.keys(NEEDS).map(n => [n, 70 + Math.random() * 25])),
        x: p?.x ?? DOOR.x, y: p?.y ?? DOOR.y - 10,
        task: null, idle: Math.random() * 6, bubble: null, mood: "happy",
      };
      s.node = el(`<button class="sim${s.visitor ? " visitor" : ""}" aria-label="${c.name}"><div class="bubble"></div><div class="face"></div><div class="doing"></div><div class="tag">${c.name}</div></button>`);
      s.node.onclick = e => { e.stopPropagation(); if (mode === "live") simTapped(s); };
      simLayer.append(s.node);
      drawFace(s);
      sims.push(s);
    }
    simById = Object.fromEntries(sims.map(s => [s.id, s]));
    if (!selected || !simById[selected.id]) selected = sims.find(s => s.c.player) || sims.find(s => !s.visitor) || sims[0] || null;
    renderPanel();
  }

  function drawFace(s) {
    s.faceMood = s.mood;
    s.node.querySelector(".face").innerHTML = avatarSvg(state.looks[s.id], { age: s.c.age, years: s.c.years, mood: s.mood, size: 34 });
  }

  // ---------- Furniture & rooms ----------
  function drawObjects() {
    objLayer.innerHTML = "";
    for (const o of saved.objects) {
      const it = info(o);
      const node = el(`<button class="obj${pending?.obj === o ? " moving" : ""}" style="left:${o.x - 20}px;top:${o.y - 20}px" aria-label="${it.label}">${it.icon}</button>`);
      node.onclick = e => { e.stopPropagation(); closeSheet(); mode === "build" ? buildObjectMenu(o) : objectMenu(o); };
      objLayer.append(node);
    }
    roomNodes.forEach((n, i) => n.style.background = saved.rooms[i]);
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
    const it = info(o);
    if (!selected) return;
    if (!it.actions.length) { say(selected, `Nice ${it.label.toLowerCase()} ✨`); return; }
    const fav = favoriteOf(selected.c, state.custom[selected.id]);
    openSheet(`${it.icon} ${it.label} · ${selected.c.name}`, it.actions.map(a => ({
      label: ACTIONS[a].label + (a === fav ? " ❤️" : ""),
      disabled: !canDo(selected.c, a),
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
    const people = CHARACTERS.filter(c => !here.has(c.id));
    openSheet("Invite someone over", people.map(c => {
      const at = state.away[c.id];
      const mine = h.members.includes(c.id);
      const where = at ? `At ${HOUSEHOLDS.find(x => x.id === at).name}` : homeOf(c.id).name;
      return { label: `${mine ? "🏠 Call home: " : ""}${c.name}`, note: where, run: () => invite(c.id) };
    }), "tall");
  }

  function invite(id) {
    if (h.members.includes(id)) delete state.away[id]; else state.away[id] = hid;
    delete saved.pos[id];
    syncSims();
    const s = simById[id];
    if (s) { s.x = DOOR.x; s.y = DOOR.y; command(s, { type: "walk", x: DOOR.x + (Math.random() * 60 - 30), y: DOOR.y - 60 }); say(s, s.visitor ? "Hey y'all! 👋" : "I'm home!"); }
    persist();
  }

  function sendHome(id) {
    delete state.away[id];
    delete saved.pos[id];
    syncSims();
    persist();
  }

  // ---------- Build mode ----------
  function setMode(m) {
    mode = m; pending = null;
    stageWrap.classList.toggle("building", m === "build");
    if (m === "build") { setSpeed(0); } else setSpeed(1);
    drawObjects(); renderPanel(); updateTip();
  }

  function updateTip() {
    if (mode !== "build") { tip.classList.add("hidden"); return; }
    tip.classList.remove("hidden");
    tip.textContent = pending?.kind === "buy" ? `Tap where to put the ${CATALOG[pending.type].label.toLowerCase()}`
      : pending?.kind === "move" ? `Tap where to move the ${info(pending.obj).label.toLowerCase()}`
      : "Tap furniture to move or sell it. Tap a floor to paint it.";
  }

  function buildTap(x, y) {
    if (pending?.kind === "buy") {
      const it = CATALOG[pending.type];
      if (state.funds[hid] < it.price) { pending = null; updateTip(); return; }
      state.funds[hid] -= it.price;
      saved.objects.push({ id: `${pending.type}-${Date.now().toString(36)}`, type: pending.type, x, y });
      pending = null;
    } else if (pending?.kind === "move") {
      pending.obj.x = x; pending.obj.y = y; pending = null;
    } else {
      const i = ROOMS.findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
      if (i >= 0) return paintMenu(i);
    }
    reindex(); drawObjects(); renderPanel(); updateTip(); persist();
  }

  function paintMenu(i) {
    openSheet(`Paint the ${ROOMS[i].name.toLowerCase()} floor`, [{
      html: `<div class="paints">${ROOM_COLORS.map(c => `<button class="swatch${saved.rooms[i] === c ? " on" : ""}" style="background:${c}" data-c="${c}" aria-label="Color ${c}"></button>`).join("")}</div>`,
      bind: n => n.querySelectorAll("button").forEach(b => b.onclick = () => { saved.rooms[i] = b.dataset.c; drawObjects(); closeSheet(); persist(); }),
    }]);
  }

  function buildObjectMenu(o) {
    const it = info(o);
    const refund = Math.round(it.price * SELL_BACK);
    openSheet(`${it.icon} ${it.label}`, [
      { label: "Move it", run: () => { pending = { kind: "move", obj: o }; drawObjects(); updateTip(); } },
      { label: `Sell it`, note: `+${money(refund)}`, run: () => {
        state.funds[hid] += refund;
        saved.objects = saved.objects.filter(x => x !== o);
        for (const s of sims) if (s.task?.obj === o.id) s.task = null;
        reindex(); drawObjects(); renderPanel(); persist();
      } },
    ]);
  }

  function catalogMenu() {
    const cats = [...new Set(Object.values(CATALOG).map(c => c.cat))];
    const items = [];
    for (const cat of cats) {
      items.push({ html: `<div class="cat-head">${cat}</div>` });
      for (const [type, it] of Object.entries(CATALOG).filter(([, v]) => v.cat === cat)) {
        items.push({ label: `${it.icon} ${it.label}`, note: money(it.price), disabled: state.funds[hid] < it.price,
          run: () => { pending = { kind: "buy", type }; updateTip(); } });
      }
    }
    openSheet(`Buy furniture <small>(you have ${money(state.funds[hid])})</small>`, items, "tall");
  }

  // ---------- Commands & tasks ----------
  function command(s, task) {
    s.idle = 0;
    if (task.type === "action") {
      const o = objIndex[task.obj];
      if (!o) return;
      const users = sims.filter(x => x !== s && x.task?.obj === task.obj).length;
      task = { ...task, x: o.x - 14 + users * 14, y: o.y + 10, phase: "walk", remaining: ACTIONS[task.action].mins };
    } else task = { ...task, phase: "walk" };
    s.task = task;
  }

  function say(s, text, secs = 3.8) { s.bubble = { text, until: performance.now() + secs * 1000 }; }

  function finishSocial(s, t) {
    const target = simById[t.target];
    if (!target) return;
    const keyA = `${s.id}|${target.id}`, keyB = `${target.id}|${s.id}`;
    const res = resolveSocial(t.social, s.c, target.c, state.rel[keyA], state.custom[s.id]?.phrases || []);
    state.rel[keyA] = clamp(state.rel[keyA] + res.delta);
    state.rel[keyB] = clamp(state.rel[keyB] + res.delta);
    const soc = SOCIALS[t.social];
    s.needs.social = clamp(s.needs.social + soc.social);
    target.needs.social = clamp(target.needs.social + (res.ok ? soc.social : soc.social / 3));
    if (soc.fun && res.ok) { s.needs.fun = clamp(s.needs.fun + soc.fun); target.needs.fun = clamp(target.needs.fun + soc.fun); }
    say(s, res.line);
    setTimeout(() => say(target, res.reply, 3), 1200);
    target.idle = -4;
    s.idle = -3;
  }

  // ---------- Simulation loop ----------
  function step(dt) {
    const gmin = dt * GAME_MIN_PER_SEC * speed;
    saved.time += gmin;
    const hour = Math.floor(saved.time % 1440 / 60);
    for (const s of sims) {
      const t = s.task;
      const doing = t?.phase === "do" ? ACTIONS[t.action] : null;
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
          const night = hour >= 22 || hour < 6;
          const fav = favoriteOf(s.c, state.custom[s.id]);
          let pick;
          if (night && s.needs.energy < 85 && s.visitor) { say(s, "It's late, I'm heading home! 👋"); setTimeout(() => sendHome(s.id), 1200); s.idle = -999; continue; }
          if (night && s.needs.energy < 85) pick = { kind: "action", obj: bedFor(s), action: "sleep" };
          else pick = chooseAutonomous(s.c, s, others, saved.objects, fav);
          if (pick?.kind === "action" && pick.obj) command(s, { type: "action", obj: pick.obj, action: pick.action });
          if (pick?.kind === "social") command(s, { type: "social", target: pick.target.id, social: autoSocial(s, pick.target) });
        }
        continue;
      }

      if (t.phase === "walk") {
        let tx = t.x, ty = t.y;
        if (t.type === "social") {
          const o = simById[t.target];
          if (!o) { s.task = null; continue; }
          tx = o.x + (s.x < o.x ? -28 : 28); ty = o.y;
        }
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), stepLen = WALK_SPEED * dt * speed;
        if (d <= stepLen + 0.5) {
          s.x = tx; s.y = ty;
          if (t.type === "walk") s.task = null;
          else if (t.type === "social") { finishSocial(s, t); s.task = null; }
          else {
            t.phase = "do";
            if (t.action === favoriteOf(s.c, state.custom[s.id])) say(s, "❤️ My favorite!");
          }
        } else { s.x += dx / d * stepLen; s.y += dy / d * stepLen; }
      } else if (t.phase === "do") {
        const a = ACTIONS[t.action];
        const favBonus = t.action === favoriteOf(s.c, state.custom[s.id]) ? 0.5 : 0;
        for (const [n, g] of Object.entries(a.gain)) s.needs[n] = clamp(s.needs[n] + g * gmin);
        if (favBonus) s.needs.fun = clamp(s.needs.fun + favBonus * gmin);
        if (a.pay) state.funds[s.visitor ? homeOf(s.id).id : hid] += a.pay * gmin / 60;
        t.remaining -= gmin;
        if (t.remaining <= 0 || (a.until && s.needs[a.until] >= 100)) { s.task = null; s.idle = 6; }
      }
      s.mood = moodOf(s.c, s.needs);
    }
  }

  function bedFor(s) {
    const beds = saved.objects.filter(o => o.type === "bed" || o.type === "couch");
    if (!beds.length) return null;
    const load = b => sims.filter(o => o !== s && o.task?.obj === b.id).length;
    beds.sort((a, b) => load(a) - load(b) || (a.type === "bed" ? -1 : 1));
    return beds[0].id;
  }

  function autoSocial(s, target) {
    const opts = availableSocials(s.c, target.c, state.rel[`${s.id}|${target.id}`]);
    if (s.c.traits.includes("sassy") && Math.random() < 0.5) return opts.includes("roast") && Math.random() < 0.5 ? "roast" : "blunt";
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // ---------- Rendering ----------
  function render(now) {
    clock.textContent = fmtTime(saved.time);
    for (const s of sims) {
      s.node.style.transform = `translate(${s.x - 17}px, ${s.y - 34}px)`;
      s.node.classList.toggle("sel", s === selected);
      s.node.classList.toggle("low", s.y < 70);
      if (s.mood !== s.faceMood) drawFace(s);
      const b = s.node.querySelector(".bubble");
      if (s.bubble && now < s.bubble.until) { b.textContent = s.bubble.text; b.classList.add("show"); }
      else b.classList.remove("show");
      const t = s.task;
      s.node.querySelector(".doing").textContent = t?.phase === "do" ? (t.action === "sleep" ? "💤" : info(objIndex[t.obj] || { type: "plant" }).icon) : "";
    }
    if (now - lastPanel > 250) { updatePanel(); lastPanel = now; }
  }

  function renderPanel() {
    if (mode === "build") {
      panel.innerHTML = `<div class="build-panel"><div class="funds">${money(state.funds[hid])}</div>
        <button class="btn buy">🛒 Buy furniture</button><button class="btn ghost done">Done</button></div>`;
      panel.querySelector(".buy").onclick = catalogMenu;
      panel.querySelector(".done").onclick = () => setMode("live");
      return;
    }
    panel.innerHTML = `
      <div class="who"><div class="pface"></div><div class="pinfo"><b class="pname"></b><small class="pstatus"></small></div><button class="stop btn ghost">Stop</button></div>
      <div class="needs">${Object.entries(NEEDS).map(([k, n]) => `<div class="need" data-n="${k}"><span>${n.icon} ${n.label}</span><span class="meter"><i></i></span></div>`).join("")}</div>
      <div class="row"><div class="switch">${sims.map(s => `<button data-id="${s.id}" class="${s === selected ? "on" : ""}${s.visitor ? " vis" : ""}" aria-label="Play as ${s.c.name}">${avatarSvg(state.looks[s.id], { age: s.c.age, years: s.c.years, size: 30 })}</button>`).join("")}</div>
      <div class="tools"><span class="funds">${money(state.funds[hid])}</span><button class="tool invite" aria-label="Invite someone">👋 Invite</button><button class="tool build" aria-label="Build mode">🔨 Build</button></div></div>`;
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
    if (!s) {
      panel.querySelector(".pname").textContent = "Nobody's home";
      panel.querySelector(".pstatus").textContent = "Tap Invite to call someone over.";
      panel.querySelector(".stop").style.visibility = "hidden";
      return;
    }
    panel.querySelector(".pname").textContent = s.c.name + (s.visitor ? " (visiting)" : "");
    const t = s.task;
    const status = !t ? "Free time" : t.type === "walk" ? "Walking" : t.type === "social"
      ? `Going to ${SOCIALS[t.social].label.toLowerCase()} with ${simById[t.target]?.c.name || "someone"}`
      : t.phase === "walk" ? `Heading to the ${info(objIndex[t.obj] || { type: "plant" }).label.toLowerCase()}` : ACTIONS[t.action].verb;
    panel.querySelector(".pstatus").textContent = `${MOOD_TEXT[s.mood]} · ${status}`;
    panel.querySelector(".stop").style.visibility = t ? "visible" : "hidden";
    for (const [n, v] of Object.entries(s.needs)) {
      const i = panel.querySelector(`.need[data-n="${n}"] i`);
      i.style.width = `${v}%`;
      i.style.background = v >= 60 ? "#2ecc71" : v >= 30 ? "#f1c40f" : "#e74c3c";
    }
  }

  function persist() {
    for (const s of sims) saved.pos[s.id] = { x: s.x, y: s.y };
    save(state);
  }

  function frame(now) {
    if (!running) { ro.disconnect(); return; }
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (speed > 0) step(dt);
    render(now);
    if (now - lastSave > 5000) { persist(); lastSave = now; }
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) persist(); });

  drawObjects();
  syncSims();
  setSpeed(1);
  requestAnimationFrame(frame);
}
