// Cartoon avatar drawn as SVG from a "look" object. No image files needed.

export const OPTIONS = {
  skin:   ["#f6d5b8", "#e8b48f", "#c98e62", "#a86a43", "#7d4a2b", "#5a3420", "#3d2416"],
  hairColor: ["#111111", "#3b2417", "#6b4226", "#a0522d", "#d4a24c", "#e8e0d0", "#9b9b9b", "#7a2e8f", "#c0392b"],
  hair:   ["short", "fade", "afro", "puffs", "braids", "locs", "long", "bun", "bald"],
  shirt:  ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#ec407a", "#34495e", "#ffffff"],
  facial: ["none", "beard", "goatee", "mustache"],
  glasses:["none", "round", "square"],
};

export const LABELS = {
  skin: "Skin", hairColor: "Hair color", hair: "Hair", shirt: "Shirt", facial: "Facial hair", glasses: "Glasses",
};

// Simple default looks so everyone starts different. Change them in the app.
const DEFAULTS = {
  kourtanne: { skin: 3, hair: "long",   hairColor: 0, shirt: 7, facial: "none",  glasses: "none" },
  von:       { skin: 4, hair: "fade",   hairColor: 0, shirt: 5, facial: "beard", glasses: "none" },
  crevin:    { skin: 3, hair: "short",  hairColor: 0, shirt: 3, facial: "none",  glasses: "none" },
  serenity:  { skin: 3, hair: "puffs",  hairColor: 0, shirt: 6, facial: "none",  glasses: "none" },
  kaeson:    { skin: 4, hair: "afro",   hairColor: 0, shirt: 1, facial: "none",  glasses: "none" },
  beverly:   { skin: 3, hair: "bun",    hairColor: 6, shirt: 6, facial: "none",  glasses: "round" },
  jay:       { skin: 4, hair: "bald",   hairColor: 6, shirt: 8, facial: "mustache", glasses: "none" },
  stacy:     { skin: 4, hair: "short",  hairColor: 6, shirt: 0, facial: "goatee", glasses: "none" },
  henry:     { skin: 5, hair: "short",  hairColor: 5, shirt: 4, facial: "beard", glasses: "square" },
  deontre:   { skin: 4, hair: "fade",   hairColor: 0, shirt: 0, facial: "goatee", glasses: "none" },
  sam:       { skin: 2, hair: "long",   hairColor: 2, shirt: 4, facial: "none",  glasses: "none" },
  rashad:    { skin: 4, hair: "locs",   hairColor: 0, shirt: 8, facial: "beard", glasses: "none" },
  andrew:    { skin: 1, hair: "short",  hairColor: 1, shirt: 5, facial: "none",  glasses: "none" },
  jabin:     { skin: 3, hair: "braids", hairColor: 0, shirt: 2, facial: "none",  glasses: "none" },
  antonio:   { skin: 2, hair: "short",  hairColor: 0, shirt: 3, facial: "beard", glasses: "none" },
  valissia:  { skin: 3, hair: "braids", hairColor: 4, shirt: 7, facial: "none",  glasses: "none" },
  jasannea:  { skin: 4, hair: "long",   hairColor: 1, shirt: 4, facial: "none",  glasses: "none" },
  sehven:    { skin: 3, hair: "locs",   hairColor: 3, shirt: 9, facial: "none",  glasses: "round" },
};

export function defaultLook(id) {
  return { ...(DEFAULTS[id] || { skin: 2, hair: "short", hairColor: 0, shirt: 5, facial: "none", glasses: "none" }) };
}

const darker = (hex, amt = 0.15) => {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.round(c * (1 - amt)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, "0")).join("");
};

function hairBack(style, c) {
  switch (style) {
    case "long":   return `<path d="M22 44 Q20 92 30 104 L70 104 Q80 92 78 44 Z" fill="${c}"/>`;
    case "braids": return `<g fill="${c}">${[26,34,66,74].map(x => `<rect x="${x-3}" y="46" width="6" height="56" rx="3"/>`).join("")}</g>`;
    case "locs":   return `<g fill="${c}">${[24,31,69,76].map(x => `<rect x="${x-3}" y="44" width="6" height="48" rx="3"/>`).join("")}</g>`;
    case "afro":   return `<circle cx="50" cy="40" r="32" fill="${c}"/>`;
    case "puffs":  return `<circle cx="22" cy="28" r="12" fill="${c}"/><circle cx="78" cy="28" r="12" fill="${c}"/>`;
    case "bun":    return `<circle cx="50" cy="14" r="11" fill="${c}"/>`;
    default:       return "";
  }
}

function hairFront(style, c) {
  switch (style) {
    case "short":  return `<path d="M26 40 Q28 18 50 17 Q72 18 74 40 Q66 28 50 28 Q34 28 26 40 Z" fill="${c}"/>`;
    case "fade":   return `<path d="M28 36 Q30 20 50 19 Q70 20 72 36 Q62 27 50 27 Q38 27 28 36 Z" fill="${c}"/>`;
    case "afro":   return `<path d="M26 42 Q26 24 50 22 Q74 24 74 42 Q64 30 50 30 Q36 30 26 42 Z" fill="${c}"/>`;
    case "bald":   return "";
    default:       return `<path d="M25 44 Q24 18 50 17 Q76 18 75 44 Q70 30 50 29 Q30 30 25 44 Z" fill="${c}"/>`;
  }
}

function facialHair(style, c) {
  switch (style) {
    case "beard":    return `<path d="M30 52 Q32 76 50 78 Q68 76 70 52 Q66 64 50 66 Q34 64 30 52 Z" fill="${c}"/>`;
    case "goatee":   return `<path d="M43 62 Q50 74 57 62 Q50 66 43 62 Z" fill="${c}"/>`;
    case "mustache": return `<path d="M40 58 Q50 54 60 58 Q50 61 40 58 Z" fill="${c}"/>`;
    default:         return "";
  }
}

function glassesSvg(style) {
  if (style === "round")  return `<g fill="none" stroke="#222" stroke-width="2"><circle cx="40" cy="47" r="7"/><circle cx="60" cy="47" r="7"/><path d="M47 47 H53"/></g>`;
  if (style === "square") return `<g fill="none" stroke="#222" stroke-width="2"><rect x="32" y="41" width="15" height="11" rx="2"/><rect x="53" y="41" width="15" height="11" rx="2"/><path d="M47 46 H53"/></g>`;
  return "";
}

// mood: "happy" | "neutral" | "sad" | "annoyed"
export function avatarSvg(look, { age = "adult", years, mood = "happy", size = 96 } = {}) {
  const skin = OPTIONS.skin[look.skin] ?? OPTIONS.skin[2];
  const hc = OPTIONS.hairColor[look.hairColor] ?? OPTIONS.hairColor[0];
  const shirt = OPTIONS.shirt[look.shirt] ?? OPTIONS.shirt[5];
  const showFacial = age === "adult" || age === "elder";
  const mouth = {
    happy:   `<path d="M42 60 Q50 67 58 60" stroke="#5a2a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    neutral: `<path d="M43 62 H57" stroke="#5a2a1a" stroke-width="2.5" stroke-linecap="round"/>`,
    sad:     `<path d="M42 64 Q50 58 58 64" stroke="#5a2a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    annoyed: `<path d="M43 63 Q52 60 58 62" stroke="#5a2a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  }[mood];
  const brows = mood === "annoyed"
    ? `<path d="M34 38 L45 41 M66 38 L55 41" stroke="${hc === "#e8e0d0" ? "#888" : hc}" stroke-width="2.5" stroke-linecap="round"/>`
    : `<path d="M34 39 Q40 36 45 39 M55 39 Q60 36 66 39" stroke="${hc === "#e8e0d0" ? "#888" : hc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  // Kids get a bigger head relative to body.
  const scale = years ? Math.min(1, 0.7 + years * 0.025) : age === "child" ? 0.86 : age === "teen" ? 0.93 : 1;
  return `<svg viewBox="0 0 100 120" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g transform="translate(${50 - 50 * scale} ${120 - 120 * scale}) scale(${scale})">
    ${hairBack(look.hair, hc)}
    <path d="M18 120 Q18 88 50 86 Q82 88 82 120 Z" fill="${shirt}"/>
    <path d="M42 84 H58 V92 Q50 96 42 92 Z" fill="${darker(skin)}"/>
    <ellipse cx="50" cy="50" rx="25" ry="28" fill="${skin}"/>
    <ellipse cx="25" cy="52" rx="4" ry="6" fill="${darker(skin, 0.08)}"/>
    <ellipse cx="75" cy="52" rx="4" ry="6" fill="${darker(skin, 0.08)}"/>
    ${hairFront(look.hair, hc)}
    ${brows}
    <circle cx="40" cy="47" r="3" fill="#1a1a1a"/><circle cx="60" cy="47" r="3" fill="#1a1a1a"/>
    <circle cx="41" cy="46" r="1" fill="#fff"/><circle cx="61" cy="46" r="1" fill="#fff"/>
    ${showFacial ? facialHair(look.facial, hc) : ""}
    ${mouth}
    ${glassesSvg(look.glasses)}
  </g>
</svg>`;
}
