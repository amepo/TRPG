/* Application shell: screen routing and the handful of transitions between
   the three modes. Everything is client side; the back button works because
   each screen pushes a history entry. */

import { $, el, clear, toast } from './ui/dom.js';
import { homeScreen, scenarioScreen } from './ui/home.js';
import { partyScreen } from './ui/builder.js';
import { startSolo, resumeSolo } from './ui/solo.js';
import { TableScreen } from './ui/table.js';
import { EditorScreen } from './ui/editor.js';
import { worldScreen } from './ui/world.js';
import { Session } from './core/engine.js';
import { startTheming } from './ui/theme.js';
import { useWorld, DEFAULT_WORLD } from './worlds/index.js';

const TITLES = {
  home: '灯火のテーブル',
  scenarios: 'シナリオを選ぶ',
  party: '一行を決める',
  play: '冒険',
  table: 'セッション支援',
  editor: 'シナリオ工房',
  world: '世界',
};

class App {
  constructor() {
    startTheming();
    this.screen = $('#screen');
    this.backBtn = $('#backBtn');
    this.titleEl = $('#screenTitle');
    this.actions = $('#topActions');
    this.current = null;
    this.pendingScenario = null;
    this.play = null;

    this.backBtn.addEventListener('click', () => history.back());
    $('#sheetClose').addEventListener('click', () => $('#sheet').close());
    $('#sheet').addEventListener('click', e => {
      // Clicking the backdrop (outside the dialog box) closes the sheet.
      if (e.target === $('#sheet')) $('#sheet').close();
    });

    window.addEventListener('popstate', e => this.show(e.state?.route || 'home', { replace: true }));
    this.show(location.hash.slice(1) || 'home', { replace: true });
  }

  /* ------------------------------------------------------------- routing */

  go(route) { this.show(route); }

  show(route, { replace = false } = {}) {
    if (!TITLES[route]) route = 'home';
    // Leaving a game in progress: keep the session so "続きから" still works.
    this.current = route;
    this.titleEl.textContent = TITLES[route];
    this.backBtn.hidden = route === 'home';
    clear(this.actions);

    if (replace) history.replaceState({ route }, '', `#${route}`);
    else history.pushState({ route }, '', `#${route}`);

    clear(this.screen);
    window.scrollTo(0, 0);

    switch (route) {
      case 'scenarios':
        scenarioScreen(this.screen, { app: this });
        break;
      case 'party':
        if (!this.pendingScenario) { this.show('scenarios', { replace: true }); return; }
        partyScreen(this.screen, {
          app: this,
          title: `「${this.pendingScenario.title}」に挑む一行`,
          onReady: party => this.beginPlay(party),
        });
        break;
      case 'play':
        if (!this.play) { this.show('home', { replace: true }); return; }
        this.titleEl.textContent = this.play.session.scenario.title;
        this.play.root = this.screen;
        this.play.render();
        this.actions.append(el('button', { onclick: () => this.play.save() }, ['セーブ']));
        break;
      case 'table':
        new TableScreen(this.screen, { app: this });
        break;
      case 'editor':
        new EditorScreen(this.screen, { app: this });
        break;
      case 'world':
        worldScreen(this.screen, { app: this });
        break;
      case 'home':
      default:
        if (!this.play) useWorld(DEFAULT_WORLD);
        homeScreen(this.screen, { app: this });
    }
  }

  /* --------------------------------------------------------------- play */

  chooseScenario(scenario) {
    this.pendingScenario = scenario;
    // The party is built from the scenario's setting, so switch worlds before
    // the builder opens — otherwise you recruit knights for a cyberpunk job.
    useWorld(scenario.world || DEFAULT_WORLD);
    this.show('party');
  }

  /** Jump straight from the editor into a play test. */
  playScenario(scenario) {
    this.chooseScenario(scenario);
  }

  beginPlay(party) {
    this.titleEl.textContent = this.pendingScenario.title;
    this.play = startSolo(this.screen, {
      scenario: this.pendingScenario,
      party,
      app: this,
    });
    this.show('play');
  }

  resume(save) {
    try {
      this.play = resumeSolo(this.screen, { save, app: this });
      this.show('play');
    } catch (err) {
      console.error(err);
      toast('このセーブは読み込めませんでした');
    }
  }
}

/* ------------------------------------------------------------- bootstrap */

const app = new App();
window.trpg = { app, Session };          // handy for debugging in the console

// Offline support piggybacks on the site's service worker when it is there.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is optional */ });
}
