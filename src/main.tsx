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
const vv = window.visualViewport;
if (vv) {
  let keyboardOpen = false;
  const sync = () => {
    const root = document.documentElement.style;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.setProperty('--vvh', `${vv.height}px`);
    root.setProperty('--kb', `${kb}px`);
    const open = kb > 80;
    // Keyboard just closed: iOS can leave the page offset, stranding the fixed tab bar.
    if (keyboardOpen && !open) setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), 60);
    keyboardOpen = open;
  };
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) window.scrollTo(window.scrollX, window.scrollY); }, 80));
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
