// Simulation rules: needs, objects, actions, social interactions and free will.
import { byId, relType, TRAITS } from "./characters.js";

export const NEEDS = {
  hunger:  { label: "Hunger",  icon: "🍔", decay: 0.12 },
  energy:  { label: "Energy",  icon: "⚡", decay: 0.07 },
  fun:     { label: "Fun",     icon: "🎮", decay: 0.14 },
  social:  { label: "Social",  icon: "💬", decay: 0.10 },
  hygiene: { label: "Hygiene", icon: "🛁", decay: 0.08 },
  bladder: { label: "Bladder", icon: "🚽", decay: 0.16 },
};

// House layout in logical pixels (360 x 560). Rooms are just floor colors; walking is open.
export const ROOMS = [
  { name: "Kitchen",     x: 0,   y: 0,   w: 170, h: 230, floor: "#f3e3c3" },
  { name: "Living room", x: 170, y: 0,   w: 190, h: 230, floor: "#d9c7a7" },
  { name: "Bathroom",    x: 0,   y: 230, w: 120, h: 130, floor: "#cfe3ea" },
  { name: "Main bedroom",x: 120, y: 230, w: 240, h: 130, floor: "#e6d3e8" },
  { name: "Kids' room",  x: 0,   y: 360, w: 180, h: 200, floor: "#d5ead0" },
  { name: "Den",         x: 180, y: 360, w: 180, h: 200, floor: "#ead9c9" },
];

// Everything you can buy. price in dollars; actions = what people can do with it.
export const CATALOG = {
  fridge:   { icon: "🧊", label: "Fridge",        price: 600, cat: "Kitchen",  actions: ["snack", "cook"] },
  stove:    { icon: "🍳", label: "Stove",         price: 450, cat: "Kitchen",  actions: ["cook"] },
  table:    { icon: "🍽️", label: "Dining table",  price: 250, cat: "Kitchen",  actions: ["snack"] },
  grill:    { icon: "🍖", label: "Grill",         price: 350, cat: "Kitchen",  actions: ["grill"] },
  tv:       { icon: "📺", label: "TV",            price: 500, cat: "Fun",      actions: ["tv"] },
  console:  { icon: "🎮", label: "Game console",  price: 400, cat: "Fun",      actions: ["games"] },
  stereo:   { icon: "📻", label: "Stereo",        price: 200, cat: "Fun",      actions: ["dance"] },
  piano:    { icon: "🎹", label: "Keyboard",      price: 700, cat: "Fun",      actions: ["music"] },
  aquarium: { icon: "🐠", label: "Fish tank",     price: 300, cat: "Fun",      actions: ["fish"] },
  toys:     { icon: "🧸", label: "Toy box",       price: 120, cat: "Fun",      actions: ["play"] },
  books:    { icon: "📚", label: "Bookshelf",     price: 180, cat: "Fun",      actions: ["read"] },
  computer: { icon: "💻", label: "Computer",      price: 800, cat: "Fun",      actions: ["browse", "games", "work"] },
  treadmill:{ icon: "🏃", label: "Treadmill",     price: 550, cat: "Fun",      actions: ["workout"] },
  couch:    { icon: "🛋️", label: "Couch",         price: 400, cat: "Comfort",  actions: ["relax", "nap"] },
  bed:      { icon: "🛏️", label: "Bed",           price: 450, cat: "Comfort",  actions: ["sleep", "nap"] },
  toilet:   { icon: "🚽", label: "Toilet",        price: 200, cat: "Bathroom", actions: ["toilet"] },
  shower:   { icon: "🚿", label: "Shower",        price: 350, cat: "Bathroom", actions: ["shower"] },
  tub:      { icon: "🛁", label: "Bathtub",       price: 500, cat: "Bathroom", actions: ["bath"] },
  vanity:   { icon: "💄", label: "Vanity",        price: 250, cat: "Bathroom", actions: ["glam"] },
  hottub:   { icon: "♨️", label: "Hot tub",       price: 1500, cat: "Bathroom", actions: ["soak"] },
  plant:    { icon: "🪴", label: "Plant",         price: 40,  cat: "Decor",    actions: [] },
  painting: { icon: "🖼️", label: "Painting",      price: 90,  cat: "Decor",    actions: [] },
  lamp:     { icon: "💡", label: "Lamp",          price: 60,  cat: "Decor",    actions: [] },
  flowers:  { icon: "💐", label: "Flowers",       price: 30,  cat: "Decor",    actions: [] },
  tree:     { icon: "🎄", label: "Christmas tree",price: 150, cat: "Decor",    actions: ["admire"] },
};

// Starting furniture for every house.
export const DEFAULT_LAYOUT = [
  ["fridge", 45, 50], ["stove", 100, 50], ["table", 110, 150],
  ["tv", 285, 50], ["console", 335, 55], ["couch", 285, 170], ["plant", 210, 35],
  ["toilet", 40, 270], ["shower", 90, 320],
  ["bed", 320, 300], ["bed", 60, 440], ["bed", 150, 520], ["toys", 120, 440],
  ["computer", 260, 440], ["books", 340, 440], ["bed", 320, 535],
];
export const ROOM_COLORS = ["#f3e3c3", "#d9c7a7", "#cfe3ea", "#e6d3e8", "#d5ead0", "#ead9c9", "#f7d6d0", "#fff4c2", "#c9d6f2", "#bfe3d0", "#e0e0e0", "#d6b38a"];

export function makeObjects(layout = DEFAULT_LAYOUT) {
  return layout.map(([type, x, y], i) => ({ id: `${type}-${i}-${Math.random().toString(36).slice(2, 6)}`, type, x, y }));
}
export const info = o => CATALOG[o.type];

// gain = need change per game minute while doing it. until = stop when this need is full. pay = dollars per game hour.
export const ACTIONS = {
  snack:  { label: "Grab a snack",   verb: "Snacking",     mins: 15,  gain: { hunger: 2.0 } },
  cook:   { label: "Cook a meal",    verb: "Cooking",      mins: 45,  gain: { hunger: 2.4, fun: 0.3 }, adultsOnly: true },
  grill:  { label: "Fire up the grill", verb: "Grilling",  mins: 50,  gain: { hunger: 2.2, fun: 0.6 }, adultsOnly: true },
  tv:     { label: "Watch TV",       verb: "Watching TV",  mins: 60,  gain: { fun: 1.2 } },
  games:  { label: "Play video games", verb: "Gaming",     mins: 60,  gain: { fun: 1.6, energy: -0.05 } },
  dance:  { label: "Dance",          verb: "Dancing",      mins: 30,  gain: { fun: 2.0, energy: -0.2, hygiene: -0.2 } },
  music:  { label: "Play music",     verb: "Playing music",mins: 45,  gain: { fun: 1.3 } },
  fish:   { label: "Watch the fish", verb: "Watching fish",mins: 20,  gain: { fun: 0.9, energy: 0.1 } },
  admire: { label: "Admire the tree",verb: "Feeling festive", mins: 15, gain: { fun: 1.5, social: 0.3 } },
  relax:  { label: "Relax",          verb: "Relaxing",     mins: 30,  gain: { fun: 0.6, energy: 0.2 } },
  nap:    { label: "Take a nap",     verb: "Napping",      mins: 60,  gain: { energy: 0.6 } },
  sleep:  { label: "Sleep",          verb: "Sleeping",     mins: 480, gain: { energy: 0.3 }, until: "energy" },
  toilet: { label: "Use the toilet", verb: "In the bathroom", mins: 8, gain: { bladder: 14 } },
  shower: { label: "Take a shower",  verb: "Showering",    mins: 20,  gain: { hygiene: 5.5 } },
  bath:   { label: "Take a bath",    verb: "Bathing",      mins: 40,  gain: { hygiene: 3.0, energy: 0.2, fun: 0.3 } },
  glam:   { label: "Get ready",      verb: "Getting ready",mins: 25,  gain: { hygiene: 1.5, fun: 0.8 } },
  soak:   { label: "Soak in the hot tub", verb: "Soaking", mins: 45,  gain: { hygiene: 1.2, fun: 1.0, energy: 0.2 } },
  play:   { label: "Play with toys", verb: "Playing",      mins: 40,  gain: { fun: 1.8 }, kidsOnly: true },
  browse: { label: "Scroll the internet", verb: "Online",  mins: 40,  gain: { fun: 1.0, social: 0.4 } },
  read:   { label: "Read a book",    verb: "Reading",      mins: 45,  gain: { fun: 0.9 } },
  work:   { label: "Work from home ($)", verb: "Working",  mins: 240, gain: { fun: -0.15, energy: -0.08 }, pay: 60, adultsOnly: true },
  workout:{ label: "Work out",       verb: "Working out",  mins: 40,  gain: { fun: 0.8, energy: -0.3, hygiene: -0.4 }, adultsOnly: true },
};

// Favorite activity: doing it gives a bonus and they choose it more often.
export const FAV_DEFAULTS = { foodie: "cook", energetic: "dance", wise: "read", social: "browse", homebody: "tv", chill: "relax", playful: "games", funny: "tv", loving: "cook", direct: "glam", loyal: "tv" };
export function favoriteOf(c, custom) {
  if (custom?.fav) return custom.fav;
  if (c.age === "child") return "play";
  for (const t of c.traits) if (FAV_DEFAULTS[t] && canDo(c, FAV_DEFAULTS[t])) return FAV_DEFAULTS[t];
  return "tv";
}

// Which need each action mostly fixes, for free will.
const FIXES = { hunger: ["cook", "grill", "snack"], energy: ["sleep", "nap"],
  fun: ["games", "tv", "play", "read", "browse", "dance", "music", "fish", "admire", "soak"],
  hygiene: ["shower", "bath"], bladder: ["toilet"] };

const isKid = c => c.age === "child" || c.age === "teen";
export function canDo(c, actionId) {
  const a = ACTIONS[actionId];
  if (a.adultsOnly && isKid(c)) return false;
  if (a.kidsOnly && !isKid(c)) return false;
  return true;
}

// ---------- Social ----------

export const SOCIALS = {
  chat:       { label: "Chat",          base: 0.85, delta: 4,  social: 18 },
  joke:       { label: "Tell a joke",   base: 0.7,  delta: 6,  social: 22, fun: 8 },
  compliment: { label: "Compliment",    base: 0.8,  delta: 5,  social: 18 },
  hug:        { label: "Hug",           base: 0.5,  delta: 8,  social: 25, minRel: 55 },
  deep:       { label: "Deep talk",     base: 0.6,  delta: 10, social: 30, minRel: 65 },
  tickle:     { label: "Tickle",        base: 0.75, delta: 6,  social: 20, fun: 12, kidTarget: true },
  blunt:      { label: "Keep it real",  base: 0.55, delta: 7,  social: 20, needsTrait: "direct" },
  roast:      { label: "Roast them",    base: 0.5,  delta: 9,  social: 22, fun: 10, needsTrait: "sassy" },
  sideeye:    { label: "Give side-eye", base: 0.45, delta: 5,  social: 10, fun: 6,  needsTrait: "sassy" },
};

export function availableSocials(actor, target, rel) {
  return Object.entries(SOCIALS).filter(([, s]) => {
    if (s.needsTrait && !actor.traits.includes(s.needsTrait)) return false;
    if (s.minRel && rel < s.minRel) return false;
    if (s.kidTarget && !isKid(target)) return false;
    return true;
  }).map(([id]) => id);
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const LINES = {
  chat:       { ok: ["How was your day?", "Did you hear about…", "Girl, let me tell you!", "What we eating later?"], bad: ["Mm-hm. Cool.", "Not right now."] },
  joke:       { ok: ["😂 STOP!", "Why you so silly?", "I can't with you 😂"], bad: ["…That wasn't funny.", "Tough crowd."] },
  compliment: { ok: ["You look good today!", "Okayyy, I see you!", "Proud of you."], bad: ["What do you want?", "Uh… thanks?"] },
  hug:        { ok: ["🤗", "Love you!", "Bring it in!"], bad: ["Personal space!", "Nah, I'm good."] },
  deep:       { ok: ["I really appreciate you.", "You're my person.", "Can I tell you something?"], bad: ["Too deep for today.", "Let's not."] },
  tickle:     { ok: ["Hahaha STOP!", "😆😆😆", "No fair!"], bad: ["Quit it!", "MOOOM!"] },
  blunt:      { ok: ["I'm just saying what everybody's thinking.", "You know I'm right.", "Be so for real right now.", "Somebody had to say it."],
                bad: ["Wow. Okay then.", "Was that necessary?", "You ain't have to say it like THAT."] },
  roast:      { ok: ["Who dressed you today? 💀", "That haircut was a choice.", "You cook like you're mad at the food.", "Not you trying 😭"],
                bad: ["That was low.", "I'm telling Mom.", "Okay, that one hurt."] },
  sideeye:    { ok: ["👀", "…Really?", "Mm. 🙄"], bad: ["Why you looking at me like that?", "What did I do??"] },
};

// Resolve an interaction. Returns { ok, delta, line, reply }.
export function resolveSocial(type, actor, target, rel, phrases = []) {
  const s = SOCIALS[type];
  let chance = s.base + (rel - 50) / 200;
  if (target.traits.includes("funny") && (type === "joke" || type === "roast")) chance += 0.15;
  if (target.traits.includes("chill")) chance += 0.08;
  if (target.traits.includes("loving") && (type === "hug" || type === "deep")) chance += 0.1;
  if (type === "roast" || type === "blunt" || type === "sideeye") {
    // Family and besties are used to her; they usually laugh it off.
    const rt = relType(actor.id, target.id);
    if (["spouse", "sibling", "bestie", "childhood-bestie", "parent"].includes(rt)) chance += 0.15;
  }
  chance = Math.max(0.1, Math.min(0.95, chance));
  const ok = Math.random() < chance;
  const lines = LINES[type];
  return {
    ok,
    delta: ok ? s.delta : -Math.round(s.delta * 0.8),
    line: ok && phrases.length && ["chat", "joke", "blunt", "roast", "deep"].includes(type) && Math.random() < 0.45 ? pick(phrases) : pick(ok ? lines.ok : lines.bad),
    reply: ok ? pick(["😄", "😂", "❤️", "Facts!", "Haha!", "For real!"]) : pick(["😒", "🙄", "Ugh.", "😤"]),
  };
}

// ---------- Free will ----------

// Decide what an idle sim does on their own. Returns { kind: "action", obj, action } or { kind: "social", target } or null.
export function chooseAutonomous(c, sim, others, objects, fav) {
  const needs = sim.needs;
  const find = a => { const os = objects.filter(o => info(o).actions.includes(a)); return os.length ? pick(os) : null; };
  const lowest = Object.keys(NEEDS).sort((a, b) => needs[a] - needs[b])[0];
  if (needs[lowest] < 45) {
    if (lowest === "social" && others.length) return { kind: "social", target: pick(others) };
    let choices = (FIXES[lowest] || []).filter(a => canDo(c, a));
    if (choices.includes(fav)) choices = [fav, ...choices.filter(a => a !== fav)];
    for (const a of choices) { const obj = find(a); if (obj) return { kind: "action", obj: obj.id, action: a }; }
  }
  if (Math.random() < 0.35) {
    if (others.length && Math.random() < 0.45) return { kind: "social", target: pick(others) };
    const funs = FIXES.fun.filter(a => canDo(c, a) && find(a));
    const a = (fav && find(fav) && Math.random() < 0.5) ? fav : pick(funs);
    const obj = a && find(a);
    if (obj) return { kind: "action", obj: obj.id, action: a };
  }
  return null;
}

export function moodOf(c, needs) {
  const vals = Object.values(needs);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  if (min < 15 || avg < 35) return "sad";
  if (avg < 60) return c.traits.includes("sassy") ? "annoyed" : "neutral";
  return "happy";
}

export const traitText = c => c.traits.map(t => TRAITS[t].label).join(" · ");
export { byId };
