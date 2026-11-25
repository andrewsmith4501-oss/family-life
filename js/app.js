import { CHARACTERS, HOUSEHOLDS, TRAITS, byId, relLabel } from "./characters.js";
import { avatarSvg, OPTIONS, LABELS } from "./avatar.js";
import { load, save, reset } from "./state.js";
import { openHouse } from "./house.js";
import { ACTIONS, canDo, favoriteOf } from "./sim.js";

let state = load();
const app = document.getElementById("app");
const AGE = { child: "Kid", teen: "Preteen", adult: "Adult", elder: "Elder" };
const ageText = c => c.years ? `${AGE[c.age]}, ${c.years}` : AGE[c.age];

function householdOf(id) { return HOUSEHOLDS.find(h => h.members.includes(id)); }
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function face(id, size = 72, mood = "happy") { return avatarSvg(state.looks[id], { age: byId[id].age, years: byId[id].years, size, mood }); }

// ---------- Screens ----------

function showHouseholds() {
  app.innerHTML = "";
  app.append(el(`<header class="bar"><h1>Neighborhood</h1></header>`));
  const list = el(`<main class="scroll"><p class="hint">Tap a house to meet who lives there.</p><div class="houses"></div></main>`);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  let tipHidden = false; try { tipHidden = localStorage.getItem("kfam-tip-hidden") === "1"; } catch (e) {}
  if (!standalone && !tipHidden) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const tip = el(`<div class="install-tip"><span>📲 <b>Make it an app:</b> ${isIOS
      ? "in Safari tap the Share button (the square with an arrow ⬆️), then <b>Add to Home Screen</b>."
      : "in Chrome or Edge, open the menu and choose <b>Install</b> (or <b>Apps → Install this site as an app</b>)."}</span><button aria-label="Hide tip">×</button></div>`);
    tip.querySelector("button").onclick = () => { tip.remove(); try { localStorage.setItem("kfam-tip-hidden", "1"); } catch (e) {} };
    list.prepend(tip);
  }
  const wrap = list.querySelector(".houses");
  for (const h of HOUSEHOLDS) {
    const card = el(`<button class="house" style="--hc:${h.color}">
      <div class="roof"></div>
      <div class="faces">${h.members.map(m => `<span class="mini">${face(m, 40)}</span>`).join("")}</div>
      <div class="hname">${h.name}</div>
      <div class="hcount">${h.members.length} ${h.members.length === 1 ? "person" : "people"}</div>
    </button>`);
    card.onclick = () => showHousehold(h.id);
    wrap.append(card);
  }
  const foot = el(`<div class="foot"><button class="link danger">Reset all changes</button></div>`);
  foot.querySelector("button").onclick = () => confirmInline(foot, "Reset everyone's looks and friendships?");
  list.append(foot);
  app.append(list);
}

// Inline confirm (no browser dialogs).
function confirmInline(container, question) {
  container.innerHTML = `<p>${question}</p><button class="btn danger">Yes, reset</button> <button class="btn ghost">Cancel</button>`;
  const [yes, no] = container.querySelectorAll("button");
  yes.onclick = () => { state = reset(); showHouseholds(); };
  no.onclick = () => showHouseholds();
}

function showHousehold(hid) {
  const h = HOUSEHOLDS.find(x => x.id === hid);
  app.innerHTML = "";
  const bar = el(`<header class="bar" style="--hc:${h.color}"><button class="back" aria-label="Back">‹</button><h1>${h.name}</h1></header>`);
  bar.querySelector(".back").onclick = showHouseholds;
  app.append(bar);
  const main = el(`<main class="scroll"><button class="btn play">▶ Play this household</button><div class="people"></div></main>`);
  main.querySelector(".play").onclick = () => openHouse(app, state, hid, () => showHousehold(hid));
  for (const id of h.members) {
    const c = byId[id];
    const card = el(`<button class="person">
      <div class="pf">${face(id, 80)}</div>
      <div class="pinfo"><div class="pname">${c.name}${c.player ? ' <span class="star">★</span>' : ""}</div>
      <div class="ptraits">${c.traits.map(t => TRAITS[t].label).join(" · ")}</div>
      <div class="page">${ageText(c)}</div></div>
    </button>`);
    card.onclick = () => showPerson(id, hid);
    main.querySelector(".people").append(card);
  }
  app.append(main);
}

function showPerson(id, fromHid) {
  const c = byId[id];
  app.innerHTML = "";
  const bar = el(`<header class="bar" style="--hc:${householdOf(id).color}"><button class="back" aria-label="Back">‹</button><h1>${c.name}</h1></header>`);
  bar.querySelector(".back").onclick = () => showHousehold(fromHid);
  app.append(bar);

  const others = CHARACTERS.filter(o => o.id !== id)
    .map(o => ({ o, v: state.rel[`${id}|${o.id}`] }))
    .sort((a, b) => b.v - a.v);

  const main = el(`<main class="scroll">
    <section class="profile">
      <div class="big">${face(id, 140, c.traits.includes("sassy") ? "annoyed" : "happy")}</div>
      <div class="meta">
        <div class="sub">${ageText(c)} · ${householdOf(id).name}</div>
        <div class="chips">${c.traits.map(t => `<span class="chip" title="${TRAITS[t].desc}">${TRAITS[t].label}</span>`).join("")}</div>
        <button class="btn">Change look</button>
      </div>
    </section>
    <h2>Personal touches</h2>
    <section class="touches">
      <label>Favorite thing to do
        <select class="fav">${Object.entries(ACTIONS).filter(([a]) => canDo(c, a) && !["toilet", "sleep", "nap", "work"].includes(a))
          .map(([a, v]) => `<option value="${a}" ${favoriteOf(c, state.custom[id]) === a ? "selected" : ""}>${v.label}</option>`).join("")}</select>
      </label>
      <label>Catchphrases and inside jokes <small>One per line. ${c.name} will say these when chatting.</small>
        <textarea class="phrases" rows="4" placeholder="e.g. Who ate my leftovers?!">${(state.custom[id]?.phrases || []).join("\n").replace(/</g, "&lt;")}</textarea>
      </label>
      <div class="saved-note" aria-live="polite"></div>
    </section>
    <h2>Relationships</h2>
    <ul class="rels">${others.map(({ o, v }) => `
      <li><span class="rf">${face(o.id, 36)}</span>
        <span class="rn"><b>${o.name}</b><small>${relLabel(id, o.id)}</small></span>
        <span class="meter"><i style="width:${v}%; background:${v >= 70 ? "#2ecc71" : v >= 40 ? "#f1c40f" : "#e67e22"}"></i></span>
      </li>`).join("")}
    </ul>
  </main>`);
  main.querySelector(".btn").onclick = () => showEditor(id, fromHid);
  const custom = () => (state.custom[id] ||= {});
  const note = main.querySelector(".saved-note");
  const saved = () => { save(state); note.textContent = "Saved ✓"; clearTimeout(note._t); note._t = setTimeout(() => note.textContent = "", 1500); };
  main.querySelector(".fav").onchange = e => { custom().fav = e.target.value; saved(); };
  main.querySelector(".phrases").onchange = e => { custom().phrases = e.target.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 30); saved(); };
  app.append(main);
}

function showEditor(id, fromHid) {
  const c = byId[id];
  const look = { ...state.looks[id] };
  app.innerHTML = "";
  const bar = el(`<header class="bar"><button class="back" aria-label="Cancel">‹</button><h1>${c.name}'s look</h1><button class="save">Save</button></header>`);
  bar.querySelector(".back").onclick = () => showPerson(id, fromHid);
  bar.querySelector(".save").onclick = () => { state.looks[id] = look; save(state); showPerson(id, fromHid); };
  app.append(bar);
  const main = el(`<main class="scroll editor"><div class="preview"></div><div class="opts"></div></main>`);
  const preview = main.querySelector(".preview");
  const draw = () => { preview.innerHTML = avatarSvg(look, { age: c.age, years: c.years, size: 150 }); };
  draw();
  for (const key of Object.keys(OPTIONS)) {
    const row = el(`<div class="opt"><label>${LABELS[key]}</label><div class="choices"></div></div>`);
    const choices = row.querySelector(".choices");
    OPTIONS[key].forEach((val, i) => {
      const isColor = key === "skin" || key === "hairColor" || key === "shirt";
      const v = isColor ? i : val;
      const b = el(isColor
        ? `<button class="swatch" style="background:${val}" aria-label="${LABELS[key]} ${i + 1}"></button>`
        : `<button class="pill">${val === "none" ? "None" : val[0].toUpperCase() + val.slice(1)}</button>`);
      if (look[key] === v) b.classList.add("on");
      b.onclick = () => {
        look[key] = v;
        choices.querySelectorAll("button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        draw();
      };
      choices.append(b);
    });
    main.querySelector(".opts").append(row);
  }
  app.append(main);
}

showHouseholds();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
