import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from './lib/store';
import { NavCtx, type Nav, type SpendDraft, type Tab } from './lib/nav';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/ui';
import { LockScreen } from './screens/Lock';
import { Home } from './screens/Home';
import { Spends } from './screens/Spends';
import { SpendForm } from './screens/SpendForm';
import { Scanner } from './screens/Scanner';
import { GiftCards } from './screens/GiftCards';
import { Cards } from './screens/Cards';
import { SettingsSheet } from './screens/Settings';
import type { Transaction } from './lib/types';

const THEME_KEY = 'sv-theme'; // non-sensitive UI preference, kept outside the vault so the lock screen matches

function useTheme(pref: string | undefined) {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* ignore */
    }
    const choice = pref ?? stored ?? 'system';
    try {
      if (pref) localStorage.setItem(THEME_KEY, pref);
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = choice === 'light' || (choice === 'system' && mq.matches);
      document.documentElement.dataset.theme = light ? 'light' : 'dark';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f2f2f7' : '#000000');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}


export default function App() {
  const { status, data } = useStore();
  useTheme(status === 'unlocked' ? data.settings.theme : undefined);
  const [tab, setTab] = useState<Tab>('home');
  const [form, setForm] = useState<{ open: boolean; draft?: SpendDraft; edit?: Transaction }>({ open: false });
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    if (status !== 'unlocked') {
      setForm({ open: false });
      setSettings(false);
    }
  }, [status]);

  const go = useCallback((t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const nav = useMemo<Nav>(
    () => ({
      tab,
      go,
      newSpend: (draft) => setForm({ open: true, draft }),
      editSpend: (t) => setForm({ open: true, edit: t }),
      openSettings: () => setSettings(true),
    }),
    [tab, go],
  );

  if (status === 'loading') return null;
  if (status !== 'unlocked')
    return (
      <>
        <LockScreen />
        <ToastHost />
      </>
    );

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        {tab === 'home' && <Home />}
        {tab === 'spends' && <Spends />}
        {tab === 'scan' && <Scanner />}
        {tab === 'gifts' && <GiftCards />}
        {tab === 'cards' && <Cards />}
      </div>
      <TabBar tab={tab} onChange={go} onAdd={() => setForm({ open: true })} />
      {form.open && <SpendForm draft={form.draft} edit={form.edit} onClose={() => setForm({ open: false })} />}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <ToastHost />
    </NavCtx.Provider>
  );
}
