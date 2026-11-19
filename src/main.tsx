import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

// Track the visible viewport (it shrinks when the on-screen keyboard opens) so sheets can
// sit above the keyboard instead of being pushed off the top of the screen.
//
// iOS bug: after the keyboard closes, a Home Screen web app can keep reporting a shorter
// layout viewport, so `position: fixed; bottom: 0` elements (tab bar, add button) float
// mid-screen until the next scroll. We remember the tallest height seen for each orientation
// while nothing is being typed, and push the floating chrome down by any shortfall.
const vv = window.visualViewport;
const tallest = { portrait: 0, landscape: 0 };
const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) && !(el as HTMLInputElement).readOnly;
};
let keyboardOpen = false;
const sync = () => {
  const root = document.documentElement.style;
  const h = window.innerHeight;
  const orient = h >= window.innerWidth ? 'portrait' : 'landscape';
  const vh = vv ? vv.height : h;
  const kb = vv ? Math.max(0, h - vv.height - vv.offsetTop) : 0;
  root.setProperty('--vvh', `${vh}px`);
  root.setProperty('--kb', `${kb}px`);
  const open = kb > 80 || typing();
  let fix = 0;
  if (!open) {
    tallest[orient] = Math.max(tallest[orient], h);
    const short = tallest[orient] - h;
    if (short > 40 && short < 500) fix = short;
  }
  root.setProperty('--tabfix', `${fix}px`);
  if (keyboardOpen && !open) {
    // Nudge the scroll position — iOS re-lays out fixed elements on a real scroll.
    setTimeout(() => {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      window.scrollTo(0, y);
      sync();
    }, 80);
  }
  keyboardOpen = open;
};
vv?.addEventListener('resize', sync);
vv?.addEventListener('scroll', sync);
window.addEventListener('resize', sync);
window.addEventListener('orientationchange', () => { tallest.portrait = 0; tallest.landscape = 0; setTimeout(sync, 300); });
document.addEventListener('focusin', sync);
document.addEventListener('focusout', () => setTimeout(sync, 120));
sync();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
