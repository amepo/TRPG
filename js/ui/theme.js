/* Paint the active world's palette onto the document.

   The stylesheet defines the fantasy values as its defaults; a world simply
   overrides the same custom properties, so nothing else has to know which
   setting is running. `data-world` is also stamped on <html> for the few
   places that want a setting-specific shape rather than a colour. */

import { onWorld } from '../worlds/index.js';

export function startTheming() {
  onWorld(world => {
    const root = document.documentElement;
    root.dataset.world = world.id;
    for (const [prop, value] of Object.entries(world.theme || {})) {
      root.style.setProperty(prop, value);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && world.theme?.['--bg']) meta.setAttribute('content', world.theme['--bg']);
  });
}
