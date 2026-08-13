/* World registry — which setting the game is currently running in.

   A world is pure data: abilities, skills, the things you can be, the things
   you can carry, and the things that try to kill you. `core/content.js` and
   `core/rules.js` read whichever world is active, so swapping the setting
   swaps the whole game without touching the engine.

   Scenarios name their world (`world: 'neon'`); starting a session activates
   it. Skill *ids* are what scenarios reference, so a world may rename a skill
   freely but should keep ids it wants shared scenarios to work with. */

import { fantasy } from './fantasy.js';
import { neon } from './neon.js';

export const WORLDS = [fantasy, neon];

export const DEFAULT_WORLD = fantasy.id;

const listeners = new Set();
let current = fantasy;

export const worldById = id => WORLDS.find(w => w.id === id) || null;

/** The world in play right now. */
export const activeWorld = () => current;

/**
 * Switch worlds. Safe to call with the id already active (no-op).
 * @param {string} id
 * @returns {object} the world now in play
 */
export function useWorld(id) {
  const next = worldById(id);
  if (!next) {
    console.warn(`[trpg] 未知の世界観: ${id} — ${current.name} のまま続けます`);
    return current;
  }
  if (next === current) return current;
  current = next;
  for (const fn of listeners) fn(current);
  return current;
}

/**
 * Run `fn` whenever the world changes, and once immediately so the caller
 * starts in sync.
 * @returns {() => void} unsubscribe
 */
export function onWorld(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

/** Cards for the world picker. */
export const catalogue = () => WORLDS.map(w => ({
  id: w.id, name: w.name, tagline: w.tagline, blurb: w.blurb, icon: w.icon,
  classes: w.classes.length, monsters: Object.keys(w.monsters).length,
}));
