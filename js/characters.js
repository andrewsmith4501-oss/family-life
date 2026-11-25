// All characters, households and starting relationships for Kourtanné's game.
// Edit this file to change names, traits, or who lives where.

export const TRAITS = {
  direct:     { label: "Direct",      desc: "Says exactly what she thinks." },
  sassy:      { label: "A little rude", desc: "Gets laughs and eye-rolls in equal measure." },
  loving:     { label: "Loving",      desc: "Hugs first, asks questions later." },
  playful:    { label: "Playful",     desc: "Always up for a game or a joke." },
  chill:      { label: "Chill",       desc: "Hard to rattle." },
  funny:      { label: "Funny",       desc: "The life of the cookout." },
  wise:       { label: "Wise",        desc: "Gives advice whether you asked or not." },
  loyal:      { label: "Loyal",       desc: "Rides for their people." },
  energetic:  { label: "Energetic",   desc: "Never sits still." },
  foodie:     { label: "Foodie",      desc: "Always hungry, always cooking." },
  social:     { label: "Social",      desc: "Needs people around." },
  homebody:   { label: "Homebody",    desc: "Happiest on the couch." },
};

// age: "child" | "teen" | "adult" | "elder"; years is optional (shown for kids)
export const CHARACTERS = [
  { id: "kourtanne", name: "Kourtanné", age: "adult", traits: ["direct", "sassy", "loyal"], player: true },
  { id: "von",       name: "Von",       age: "adult", traits: ["chill", "loving", "funny"] },
  { id: "crevin",    name: "Crévin",    age: "teen", years: 12, traits: ["energetic", "playful"] },
  { id: "serenity",  name: "Serenity",  age: "child", years: 10, traits: ["playful", "social"] },
  { id: "kaeson",    name: "Kaeson",    age: "child", years: 6, traits: ["energetic", "funny"] },

  { id: "beverly",   name: "Beverly",   age: "elder", traits: ["loving", "wise", "foodie"] },
  { id: "jay",       name: "Jay",       age: "elder", traits: ["chill", "funny"] },
  { id: "stacy",     name: "Stacy",     age: "elder", traits: ["funny", "social"] },
  { id: "henry",     name: "Henry",     age: "elder", traits: ["wise", "loving"] },

  { id: "deontre",   name: "Deontré",   age: "adult", traits: ["loyal", "funny"] },
  { id: "sam",       name: "Sam",       age: "adult", traits: ["loving", "social"] },
  { id: "rashad",    name: "Rashad",    age: "adult", traits: ["chill", "loyal"] },
  { id: "andrew",    name: "Andrew",    age: "adult", traits: ["funny", "foodie"] },
  { id: "jabin",     name: "Jabin",     age: "adult", traits: ["energetic", "social"] },

  { id: "antonio",   name: "Antonio",   age: "adult", traits: ["funny", "loyal", "social"] },
  { id: "valissia",  name: "Valissia",  age: "adult", traits: ["loyal", "playful"] },
  { id: "jasannea",  name: "Jásannea",  age: "adult", traits: ["loyal", "wise"] },
  { id: "sehven",    name: "Sehven",    age: "adult", traits: ["chill", "social"] },
];

export const HOUSEHOLDS = [
  { id: "home",     name: "Kourtanné & Von's House", members: ["kourtanne", "von", "crevin", "serenity", "kaeson", "stacy"], color: "#e8a87c" },
  { id: "beverly",  name: "Beverly & Jay's House",   members: ["beverly", "jay", "jabin"], color: "#c38d9e" },
  { id: "deontre",  name: "Deontré & Sam's Place",   members: ["deontre", "sam"], color: "#41b3a3" },
  { id: "rashad",   name: "Rashad & Andrew's Place", members: ["rashad", "andrew"], color: "#85a3d9" },
  { id: "henry",    name: "Henry's House",           members: ["henry"], color: "#b58b6b" },
  { id: "antonio",  name: "Antonio's Apartment",     members: ["antonio"], color: "#d97b7b" },
  { id: "valissia", name: "Valissia's Apartment",    members: ["valissia"], color: "#b07bd9" },
  { id: "jasannea", name: "Jásannea's Place",        members: ["jasannea"], color: "#6bbfbf" },
  { id: "sehven",   name: "Sehven's Place",          members: ["sehven"], color: "#8c8c8c" },
];

// Named relationships. Anything not listed starts as "acquaintance".
// [a, b, type]  types: spouse, engaged, parent, stepparent, sibling, bestie, childhood-bestie, friend
const LINKS = [
  ["kourtanne", "von", "spouse"],
  ["deontre", "sam", "spouse"],
  ["rashad", "andrew", "engaged"],
  ["beverly", "jay", "spouse"],

  ...["crevin", "serenity", "kaeson"].flatMap(k => [["kourtanne", k, "parent"], ["von", k, "parent"]]),
  ...["kourtanne", "deontre", "rashad", "jabin"].flatMap(k => [["beverly", k, "parent"], ["jay", k, "stepparent"]]),
  ["stacy", "kourtanne", "parent"],
  ["henry", "kourtanne", "pops"],  // TODO: grandfather or dad figure? Andrew to confirm with Kourtanné.

  ["crevin", "serenity", "sibling"], ["crevin", "kaeson", "sibling"], ["serenity", "kaeson", "sibling"],
  ["kourtanne", "deontre", "sibling"], ["kourtanne", "rashad", "sibling"], ["kourtanne", "jabin", "sibling"],
  ["deontre", "rashad", "sibling"], ["deontre", "jabin", "sibling"], ["rashad", "jabin", "sibling"],

  ["kourtanne", "antonio", "bestie"],
  ["kourtanne", "valissia", "bestie"],
  ["kourtanne", "jasannea", "childhood-bestie"],
  ["kourtanne", "sehven", "friend"],
  ["antonio", "valissia", "friend"],
];

export const REL_TYPES = {
  "spouse":           { label: "Spouse",              start: 90 },
  "engaged":          { label: "Engaged",             start: 90 },
  "parent":           { label: "Parent",              start: 80 },
  "stepparent":       { label: "Stepparent",          start: 70 },
  "sibling":          { label: "Sibling",             start: 70 },
  "bestie":           { label: "Bestie",              start: 85 },
  "childhood-bestie": { label: "Childhood bestie",    start: 85 },
  "pops":             { label: "Pops",                start: 80 },
  "friend":           { label: "Friend",              start: 60 },
  "family":           { label: "Family",              start: 50 },
  "acquaintance":     { label: "Acquaintance",        start: 25 },
};

// Directional label, e.g. Kourtanné sees Beverly as "Mom".
export function relLabel(fromId, toId) {
  const r = getLink(fromId, toId);
  if (!r) return REL_TYPES[defaultType(fromId, toId)].label;
  const [a, , type] = r;
  const iAmA = a === fromId;
  if (type === "parent") return iAmA ? "Child" : "Parent";
  if (type === "stepparent") return iAmA ? "Stepchild" : "Stepparent";
  return REL_TYPES[type].label;
}

function getLink(x, y) {
  return LINKS.find(([a, b]) => (a === x && b === y) || (a === y && b === x));
}

// Everyone in the Kourtanné/Beverly family tree who isn't directly linked is "family".
const FAMILY = new Set(["kourtanne","von","crevin","serenity","kaeson","beverly","jay","stacy","henry","deontre","sam","rashad","andrew","jabin"]);
function defaultType(x, y) {
  return FAMILY.has(x) && FAMILY.has(y) ? "family" : "acquaintance";
}

export function relType(x, y) {
  const r = getLink(x, y);
  return r ? r[2] : defaultType(x, y);
}

// Builds the starting friendship score (0-100) for every pair.
export function startingRelationships() {
  const rel = {};
  for (const a of CHARACTERS) for (const b of CHARACTERS) {
    if (a.id === b.id) continue;
    rel[`${a.id}|${b.id}`] = REL_TYPES[relType(a.id, b.id)].start;
  }
  return rel;
}

export const byId = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
