/* Scenarios shipped with the app, plus whatever the player has saved locally. */

import { firstJob } from './first-job.js';
import { silentBell } from './silent-bell.js';
import { describe } from '../core/scenario.js';

export const BUILT_IN = [firstJob, silentBell];

export const byId = id => BUILT_IN.find(s => s.id === id) || null;

/** Cards for the scenario picker. */
export const catalogue = () => BUILT_IN.map(s => ({
  ...describe(s),
  length: s.length || '',
  author: s.author || '',
  tutorial: !!s.tutorial,
  builtIn: true,
}));
