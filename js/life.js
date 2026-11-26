// Modern life-sim layer: emotions (from moodlets), skills, jobs and school, wants and rewards, friendship and romance.
// Everything here is stored per person in state.life[id], so it follows them from house to house.
import { relType } from "./characters.js";

// ---------- Emotions ----------
// face = which face the 3D model makes (models.js setMood).
export const EMOTIONS = {
  fine:          { label: "Fine",          icon: "🙂", color: "#e8e8e8", face: "neutral" },
  happy:         { label: "Happy",         icon: "😊", color: "#2ecc71", face: "happy" },
  playful:       { label: "Playful",       icon: "😜", color: "#4dd0e1", face: "happy" },
  confident:     { label: "Confident",     icon: "😎", color: "#3d7bf2", face: "happy" },
  energized:     { label: "Energized",     icon: "⚡", color: "#ff9f1c", face: "happy" },
  inspired:      { label: "Inspired",      icon: "💡", color: "#7ad3ff", face: "happy" },
  focused:       { label: "Focused",       icon: "🧠", color: "#a66cff", face: "neutral" },
  flirty:        { label: "Flirty",        icon: "😘", color: "#ff6fb5", face: "happy" },
  bored:         { label: "Bored",         icon: "😑", color: "#9aa0a6", face: "neutral" },
  tense:         { label: "Stressed",      icon: "😣", color: "#f39c12", face: "annoyed" },
  angry:         { label: "Angry",         icon: "😠", color: "#e74c3c", face: "annoyed" },
  embarrassed:   { label: "Embarrassed",   icon: "😳", color: "#ff8a80", face: "sad" },
  uncomfortable: { label: "Uncomfortable", icon: "😖", color: "#b5a33a", face: "annoyed" },
  sad:           { label: "Sad",           icon: "😢", color: "#5d7fb8", face: "sad" },
};
const GOOD = new Set(["happy", "playful", "confident", "energized", "inspired", "focused", "flirty"]);
export const isGood = e => GOOD.has(e);

// Moodlets that come straight from needs, checked every tick.
function needMoodlets(needs) {
  const out = [];
  if (needs.hunger < 20) out.push({ label: "Starving", emotion: "uncomfortable", power: 2 });
  else if (needs.hunger < 35) out.push({ label: "Hungry", emotion: "uncomfortable", power: 1 });
  if (needs.energy < 15) out.push({ label: "Exhausted", emotion: "uncomfortable", power: 2 });
  else if (needs.energy < 30) out.push({ label: "Sleepy", emotion: "uncomfortable", power: 1 });
  if (needs.bladder < 25) out.push({ label: "Gotta go!", emotion: "uncomfortable", power: needs.bladder < 12 ? 2 : 1 });
  if (needs.hygiene < 25) out.push({ label: "Feeling grimy", emotion: "embarrassed", power: 1 });
  if (needs.fun < 25) out.push({ label: "Nothing to do", emotion: "bored", power: needs.fun < 12 ? 2 : 1 });
  if (needs.social < 25) out.push({ label: "Lonely", emotion: "sad", power: needs.social < 12 ? 2 : 1 });
  if (Object.values(needs).every(v => v > 80)) out.push({ label: "Feeling great", emotion: "happy", power: 1 });
  return out;
}

// What happens after each activity. power 1-3, mins = how long the feeling lasts (game minutes).
export const AFTER = {
  cook:    { label: "Home-cooked meal", emotion: "happy", power: 1, mins: 180 },
  grill:   { label: "Grill master", emotion: "happy", power: 1, mins: 180 },
  tv:      { label: "Good show", emotion: "happy", power: 1, mins: 120 },
  games:   { label: "Won a round", emotion: "playful", power: 1, mins: 120 },
  dance:   { label: "Got my groove on", emotion: "playful", power: 1, mins: 150 },
  music:   { label: "In the zone", emotion: "inspired", power: 1, mins: 180 },
  fish:    { label: "Calming fish tank", emotion: "happy", power: 1, mins: 90 },
  admire:  { label: "Holiday spirit", emotion: "happy", power: 2, mins: 240 },
  sleep:   { label: "Well rested", emotion: "energized", power: 1, mins: 240 },
  shower:  { label: "Fresh and clean", emotion: "confident", power: 1, mins: 180 },
  bath:    { label: "Relaxing bath", emotion: "happy", power: 1, mins: 180 },
  glam:    { label: "Looking good", emotion: "confident", power: 2, mins: 240 },
  soak:    { label: "Hot tub soak", emotion: "happy", power: 2, mins: 180 },
  play:    { label: "Playtime", emotion: "playful", power: 1, mins: 150 },
  browse:  { label: "Funny videos", emotion: "playful", power: 1, mins: 90 },
  read:    { label: "Good book", emotion: "focused", power: 1, mins: 150 },
  work:    { label: "Long workday", emotion: "tense", power: 1, mins: 120 },
  workout: { label: "Pumped up", emotion: "energized", power: 2, mins: 180 },
  homework:{ label: "Homework's done", emotion: "confident", power: 1, mins: 180 },
};

// What each social move does to feelings. [actor on success, target on success, actor on fail, target on fail]
const SOCIAL_FEEL = {
  chat:       [["Good conversation", "happy", 1], ["Good conversation", "happy", 1], ["Awkward moment", "embarrassed", 1], null],
  joke:       [["Made them laugh", "playful", 1], ["Had a laugh", "playful", 1], ["Joke flopped", "embarrassed", 1], null],
  compliment: [null, ["Got complimented", "confident", 1], ["Awkward moment", "embarrassed", 1], null],
  hug:        [["Nice hug", "happy", 1], ["Nice hug", "happy", 1], ["Hug denied", "embarrassed", 1], null],
  deep:       [["Heart-to-heart", "happy", 2], ["Heart-to-heart", "happy", 2], null, null],
  tickle:     [["Tickle fight", "playful", 1], ["Tickle fight", "playful", 1], null, ["Annoyed", "angry", 1]],
  blunt:      [["Kept it real", "confident", 1], null, null, ["That was rude", "angry", 1]],
  roast:      [["Roasted them", "playful", 1], ["Got roasted (it was funny)", "playful", 1], null, ["Got roasted", "angry", 1]],
  sideeye:    [["Said it with my eyes", "confident", 1], null, null, ["Side-eyed", "tense", 1]],
  flirt:      [["Flirted", "flirty", 1], ["Flirted with", "flirty", 1], ["Got shut down", "embarrassed", 1], null],
  kiss:       [["Sweet kiss", "flirty", 2], ["Sweet kiss", "flirty", 2], ["Not now, babe", "embarrassed", 1], null],
  love:       [["Said I love you", "happy", 2], ["Heard I love you", "happy", 2], null, null],
  vent:       [["Got it off my chest", "happy", 1], null, null, null],
  cheer:      [["Cheered them up", "happy", 1], ["Cheered up", "happy", 2], null, null],
};

export function addMoodlet(life, label, emotion, power = 1, mins = 180) {
  life.moodlets = (life.moodlets || []).filter(m => m.label !== label);
  life.moodlets.push({ label, emotion, power, left: mins });
  if (life.moodlets.length > 8) life.moodlets.shift();
}
export function socialFeelings(type, ok, actorLife, targetLife) {
  const f = SOCIAL_FEEL[type]; if (!f) return;
  const [a, t] = ok ? [f[0], f[1]] : [f[2], f[3]];
  if (a) addMoodlet(actorLife, a[0], a[1], a[2], 150);
  if (t) addMoodlet(targetLife, t[0], t[1], t[2], 150);
}
export function tickMoodlets(life, gmin) {
  for (const m of life.moodlets || []) m.left -= gmin;
  life.moodlets = (life.moodlets || []).filter(m => m.left > 0);
}
// Adds up every moodlet; the biggest emotion wins. Returns { emotion, level, list }.
export function emotionOf(life, needs, c) {
  const list = [...needMoodlets(needs), ...(life.moodlets || [])];
  const sum = {};
  for (const m of list) sum[m.emotion] = (sum[m.emotion] || 0) + m.power;
  let best = "fine", bv = 0;
  for (const [e, v] of Object.entries(sum)) if (v > bv || (v === bv && !isGood(best) && isGood(e))) { best = e; bv = v; }
  // Kourtanné's sass: when she's just "fine", she's a little extra
  if (best === "fine" && c?.traits.includes("sassy")) { best = "confident"; bv = 1; list.push({ label: "Too fabulous to be just fine", emotion: "confident", power: 1 }); }
  const level = bv >= 5 ? 3 : bv >= 3 ? 2 : 1;
  return { emotion: best, level, list };
}
export function emotionText(em) {
  const e = EMOTIONS[em.emotion];
  return (em.emotion === "fine" ? "" : em.level === 3 ? "Very, very " : em.level === 2 ? "Very " : "") + (em.level > 1 ? e.label.toLowerCase() : e.label);
}
// Emotions change how social moves land, like in modern life sims.
export function socialBonus(emotion, type) {
  const b = {
    confident: { chat: 0.1, compliment: 0.1, deep: 0.1, flirt: 0.1, blunt: 0.1 },
    playful:   { joke: 0.15, roast: 0.15, tickle: 0.1 },
    flirty:    { flirt: 0.2, kiss: 0.15, love: 0.1 },
    happy:     { chat: 0.05, hug: 0.1, deep: 0.05 },
    angry:     { roast: 0.1, blunt: 0.1, joke: -0.15, flirt: -0.2, hug: -0.15 },
    sad:       { deep: 0.1, joke: -0.1 },
    embarrassed: { flirt: -0.15, joke: -0.1 },
  }[emotion];
  return b?.[type] || 0;
}

// ---------- Skills ----------
export const SKILLS = {
  cooking:    { label: "Cooking",    icon: "🍳", from: ["cook", "grill"] },
  fitness:    { label: "Fitness",    icon: "💪", from: ["workout", "dance"] },
  charisma:   { label: "Charisma",   icon: "💬", from: ["chat", "compliment", "deep", "blunt", "flirt", "cheer"] },
  comedy:     { label: "Comedy",     icon: "🎤", from: ["joke", "roast", "tickle"] },
  creativity: { label: "Creativity", icon: "🎸", from: ["music", "play"] },
  logic:      { label: "Logic",      icon: "♟️", from: ["read", "homework"] },
  gaming:     { label: "Gaming",     icon: "🎮", from: ["games"] },
};
const SKILL_OF = Object.fromEntries(Object.entries(SKILLS).flatMap(([k, s]) => s.from.map(a => [a, k])));
export const skillFor = actionOrSocial => SKILL_OF[actionOrSocial];
const BOOST = { cooking: "happy", fitness: "energized", charisma: "confident", comedy: "playful", creativity: "inspired", logic: "focused", gaming: "playful" };
export const xpNeeded = lvl => 40 + lvl * 50;   // game minutes of practice for the next level
export const skillLevel = (life, k) => life.skills?.[k]?.lvl || 0;
// Returns the new level if they just leveled up.
export function practice(life, skill, mins, emotion) {
  if (!skill) return null;
  const s = (life.skills ||= {})[skill] ||= { lvl: 0, xp: 0 };
  if (s.lvl >= 10) return null;
  s.xp += mins * (BOOST[skill] === emotion ? 1.6 : 1);
  if (s.xp >= xpNeeded(s.lvl)) { s.xp -= xpNeeded(s.lvl); s.lvl++; return s.lvl; }
  return null;
}

// ---------- Jobs and school ----------
// days: 0 = Monday … 6 = Sunday
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const CAREERS = {
  culinary:  { label: "Culinary", icon: "👩🏾‍🍳", skill: "cooking", start: 14, end: 21, levels: ["Dishwasher", "Line cook", "Sous chef", "Head chef", "Celebrity chef"] },
  business:  { label: "Business", icon: "💼", skill: "charisma", start: 9, end: 17, levels: ["Intern", "Assistant", "Manager", "Director", "CEO"] },
  tech:      { label: "Tech", icon: "💻", skill: "logic", start: 9, end: 17, levels: ["Help desk", "Junior developer", "Developer", "Lead developer", "Tech founder"] },
  comedy:    { label: "Entertainment", icon: "🎤", skill: "comedy", start: 15, end: 22, levels: ["Open mic", "Opening act", "Headliner", "TV comedian", "Comedy legend"] },
  fitness:   { label: "Fitness", icon: "🏋🏾", skill: "fitness", start: 7, end: 15, levels: ["Gym trainee", "Personal trainer", "Coach", "Head coach", "Fitness star"] },
  music:     { label: "Music", icon: "🎶", skill: "creativity", start: 15, end: 22, levels: ["Street performer", "Session player", "Band member", "Recording artist", "Superstar"] },
};
export const PAY = [22, 34, 50, 72, 100];   // dollars per hour by level
export const SCHOOL = { start: 8, end: 15 };
export const GRADES = ["F", "D", "C", "B", "A"];
export const gradeOf = perf => GRADES[Math.min(4, Math.floor(perf / 20))];
export const goesToSchool = c => c.age === "child" || c.age === "teen";
export function shiftFor(c, life) {
  if (goesToSchool(c)) return { kind: "school", ...SCHOOL, label: "School" };
  if (life.job) { const k = CAREERS[life.job.track]; return { kind: "work", start: k.start, end: k.end, label: k.levels[life.job.level] }; }
  return null;
}
// After a shift: performance changes with mood, skill and (for kids) homework. Returns a summary.
export function endShift(c, life, emotion) {
  const sh = shiftFor(c, life); if (!sh) return null;
  const moodK = isGood(emotion) ? 1 : emotion === "fine" ? 0.4 : -0.6;
  if (sh.kind === "school") {
    const sc = life.school ||= { perf: 55 };
    sc.perf = Math.max(0, Math.min(100, sc.perf + 6 * moodK + (sc.homework ? 8 : -4)));
    sc.homework = false;
    return { kind: "school", grade: gradeOf(sc.perf), good: moodK > 0 };
  }
  const j = life.job, k = CAREERS[j.track];
  const pay = PAY[j.level] * (sh.end - sh.start);
  j.perf = Math.max(0, Math.min(100, j.perf + 12 * moodK + skillLevel(life, k.skill) * 1.5));
  let promoted = false;
  if (j.perf >= 100 && j.level < 4) { j.level++; j.perf = 25; promoted = true; }
  return { kind: "work", pay, promoted, title: k.levels[j.level], good: moodK > 0 };
}

// ---------- Wants ----------
// test(kind, detail, ctx) says whether something the person just did fulfills the want.
const WANTS = [
  { id: "cook", text: "Cook a meal", icon: "🍳", ok: c => c.age !== "child" && c.age !== "teen", hit: (k, d) => k === "action" && (d === "cook" || d === "grill") },
  { id: "tv", text: "Watch some TV", icon: "📺", hit: (k, d) => k === "action" && d === "tv" },
  { id: "games", text: "Play video games", icon: "🎮", hit: (k, d) => k === "action" && d === "games" },
  { id: "dance", text: "Dance it out", icon: "💃🏾", hit: (k, d) => k === "action" && d === "dance" },
  { id: "music", text: "Play some music", icon: "🎸", hit: (k, d) => k === "action" && d === "music" },
  { id: "read", text: "Read a book", icon: "📖", hit: (k, d) => k === "action" && d === "read" },
  { id: "workout", text: "Work out", icon: "💪", ok: c => c.age === "adult" || c.age === "elder", hit: (k, d) => k === "action" && d === "workout" },
  { id: "glam", text: "Get ready and look cute", icon: "💄", hit: (k, d) => k === "action" && d === "glam" },
  { id: "bath", text: "Take a long bath", icon: "🛁", hit: (k, d) => k === "action" && (d === "bath" || d === "soak") },
  { id: "play", text: "Play with toys", icon: "🧸", ok: c => c.age === "child" || c.age === "teen", hit: (k, d) => k === "action" && d === "play" },
  { id: "homework", text: "Finish homework", icon: "📝", ok: c => c.age === "child" || c.age === "teen", hit: (k, d) => k === "action" && d === "homework" },
  { id: "joke", text: "Make someone laugh", icon: "😂", hit: (k, d, x) => k === "social" && (d === "joke" || d === "roast") && x.ok },
  { id: "hug", text: "Give somebody a hug", icon: "🤗", hit: (k, d, x) => k === "social" && d === "hug" && x.ok },
  { id: "chat", text: "Catch up with someone", icon: "💬", hit: (k, d, x) => k === "social" && x.ok },
  { id: "roast", text: "Roast somebody", icon: "🔥", ok: c => c.traits.includes("sassy"), hit: (k, d, x) => k === "social" && d === "roast" && x.ok },
  { id: "real", text: "Tell it like it is", icon: "💯", ok: c => c.traits.includes("direct"), hit: (k, d, x) => k === "social" && d === "blunt" },
  { id: "romance", text: "Spend time with bae", icon: "💕", ok: (c, x) => x.hasPartner, hit: (k, d, x) => k === "social" && ["flirt", "kiss", "love"].includes(d) && x.ok },
  { id: "skill", text: "Level up a skill", icon: "⭐", hit: k => k === "levelup" },
  { id: "invite", text: "Have someone over", icon: "👋", ok: c => c.age !== "child", hit: k => k === "invite" },
  { id: "great", text: "Be in a great mood", icon: "😊", hit: (k, d) => k === "emotion" && ["happy", "confident", "playful", "energized", "inspired", "flirty"].includes(d) },
];
export const WANT_POINTS = 100;
export function fillWants(c, life, ctx) {
  life.wants ||= [];
  const pool = WANTS.filter(w => !w.ok || w.ok(c, ctx)).filter(w => !life.wants.includes(w.id));
  while (life.wants.length < 3 && pool.length) life.wants.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
}
export const wantInfo = id => WANTS.find(w => w.id === id);
// Returns the wants that just came true.
export function checkWants(life, kind, detail, extra = {}) {
  const done = (life.wants || []).filter(id => wantInfo(id)?.hit(kind, detail, extra));
  if (!done.length) return [];
  life.wants = life.wants.filter(id => !done.includes(id));
  life.points = (life.points || 0) + WANT_POINTS * done.length;
  addMoodlet(life, "Got what I wanted", "happy", 1, 180);
  return done.map(wantInfo);
}

// Rewards bought with want points.
export const REWARDS = [
  { id: "energy",  label: "Second wind",      note: "Fills Energy",                cost: 250 },
  { id: "clean",   label: "Fresh to death",   note: "Fills Hygiene",               cost: 250 },
  { id: "allneeds",label: "Perfect day",      note: "Fills every need",            cost: 700 },
  { id: "confident", label: "Main character energy", note: "Very confident for a while", cost: 400 },
  { id: "playful", label: "Silly mood",       note: "Very playful for a while",    cost: 300 },
  { id: "inspired",label: "Big ideas",        note: "Very inspired for a while",   cost: 300 },
  { id: "learn",   label: "Quick learner",    note: "+1 level in your best skill", cost: 900 },
];

// ---------- Friendship and romance ----------
export function friendLabel(v) {
  return v >= 85 ? "Best friends" : v >= 65 ? "Good friends" : v >= 45 ? "Friends" : v >= 25 ? "Acquaintances" : v >= 12 ? "Not getting along" : "Rivals";
}
export const isCouple = (a, b) => ["spouse", "engaged"].includes(relType(a, b));
export function romanceLabel(v) { return v >= 85 ? "Soulmates" : v >= 65 ? "In love" : v >= 40 ? "Sweethearts" : "Cooling off"; }
export function partnerOf(id, ids) { return ids.find(o => o !== id && isCouple(id, o)); }

export function lifeOf(state, id) {
  const l = (state.life ||= {})[id] ||= {};
  l.skills ||= {}; l.moodlets ||= []; l.wants ||= []; l.points ??= 0;
  return l;
}
