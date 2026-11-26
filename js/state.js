// Game state, saved on the device so progress survives closing the app.
import { CHARACTERS, HOUSEHOLDS, startingRelationships } from "./characters.js";
import { defaultLook } from "./avatar.js";

const KEY = "kfam-save-v1";
export const START_FUNDS = 3000;

function fresh() {
  return {
    version: 2,
    looks: Object.fromEntries(CHARACTERS.map(c => [c.id, defaultLook(c.id)])),
    rel: startingRelationships(),
    needs: {},     // person id -> needs (shared across houses)
    custom: {},    // person id -> { fav, phrases: [] }
    away: {},      // person id -> household id they're visiting
    funds: Object.fromEntries(HOUSEHOLDS.map(h => [h.id, START_FUNDS])),
    houses: {},    // household id -> { time, objects, rooms, pos, visitors }
    life: {},      // person id -> { moodlets, skills, job, school, wants, points, shift } (see life.js)
    rom: {},       // "a|b" -> romance for couples
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const base = fresh();
      const out = { ...base, ...s, looks: { ...base.looks, ...s.looks }, rel: { ...base.rel, ...s.rel },
        funds: { ...base.funds, ...s.funds }, needs: s.needs || {}, custom: s.custom || {}, away: s.away || {}, life: s.life || {}, rom: s.rom || {} };
      // Older saves kept needs inside each house.
      for (const h of Object.values(out.houses || {})) {
        for (const [id, v] of Object.entries(h.sims || {})) {
          if (v.needs && !out.needs[id]) out.needs[id] = v.needs;
          (h.pos ||= {})[id] ||= { x: v.x, y: v.y };
        }
        delete h.sims;
      }
      return out;
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return fresh();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return fresh();
}
