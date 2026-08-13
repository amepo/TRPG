/* Scenarios shipped with the app, plus whatever the player has saved locally. */

import { firstJob } from './first-job.js';
import { silentBell } from './silent-bell.js';
import { rainCheck } from './rain-check.js';
import { describe } from '../core/scenario.js';
import { worldById, DEFAULT_WORLD } from '../worlds/index.js';

export const BUILT_IN = [firstJob, silentBell, rainCheck];

export const byId = id => BUILT_IN.find(s => s.id === id) || null;

/** Everything shipped for one setting. */
export const forWorld = worldId => BUILT_IN.filter(s => (s.world || DEFAULT_WORLD) === worldId);

/** Cards for the scenario picker, tagged with the world they belong to. */
export const catalogue = () => BUILT_IN.map(s => {
  const world = worldById(s.world || DEFAULT_WORLD);
  return {
    ...describe(s),
    length: s.length || '',
    author: s.author || '',
    tutorial: !!s.tutorial,
    builtIn: true,
    worldName: world?.name || '',
    worldIcon: world?.icon || '',
  };
});
