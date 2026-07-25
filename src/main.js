import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { engine as animeEngine } from 'animejs';
import { loadExplainer, mountExplainer } from './framework/index.js';
import { isCategory } from './categories.js';
import { mountHome } from './home.js';

// anime.js pauses its engine when the document is hidden and, in embedded /
// backgrounded contexts, doesn't reliably resume on becoming visible again —
// which freezes every looping timeline (and, if it happens at load, the home
// page's entrance animation). Keep the engine running regardless of tab
// visibility; a real foreground tab renders fine, a background one just costs
// a little idle work.
animeEngine.pauseOnDocumentHidden = false;

// Explainers register themselves: registry.js globs every
// src/explainers/*/meta.js eagerly and lazy-imports index.js on navigation.

const app = document.querySelector('#app');
let current = null;
let nav = 0;

async function route() {
  const token = ++nav;
  current?.destroy();
  current = null;
  window.scrollTo(0, 0);

  // Paths: '' → library, 'vehicles' → category page, 'vehicles/jet-engine'
  // or plain 'jet-engine' → explainer (ids are globally unique, so only the
  // last segment matters — old flat URLs keep working).
  const path = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!path) {
    current = mountHome(app);
    return;
  }
  const last = path.split('/').at(-1);
  if (isCategory(last)) {
    current = mountHome(app, last);
    return;
  }
  const def = await loadExplainer(last);
  if (token !== nav) return; // user navigated again while the chunk loaded
  current = def ? mountExplainer(def, app) : mountHome(app);
}

window.addEventListener('hashchange', route);
route();
