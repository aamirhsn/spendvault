import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GiftCard, Merchant, PaymentCard, Settings, Transaction, VaultData } from './types';
import * as V from './vault';
import { round2, uid } from './format';
import { requestPersistence } from './db';

type Status = 'loading' | 'setup' | 'locked' | 'unlocked';

interface Store {
  status: Status;
  data: VaultData;
  meta: V.VaultMeta | null;
  biometricEnabled: boolean;
  setup(passcode: string, kind: V.PasscodeKind): Promise<void>;
  unlock(passcode: string): Promise<void>;
  unlockBiometric(): Promise<void>;
  lock(): void;
  refreshMeta(): Promise<void>;
  replaceAll(data: VaultData): Promise<void>;
  saveTransaction(t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCard(c: Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void>;
  deleteCard(id: string): Promise<void>;
  saveGiftCard(g: Omit<GiftCard, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void>;
  deleteGiftCard(id: string): Promise<void>;
  saveMerchant(m: Omit<Merchant, 'id' | 'updatedAt'> & { id?: string }): Promise<string>;
  deleteMerchant(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  setLogo(key: string, dataUrl: string | null): Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};

function upsert<T extends { id: string; createdAt?: number; updatedAt: number }>(list: T[], item: Partial<T> & { id?: string }): T[] {
  const now = Date.now();
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...x, ...item, updatedAt: now } as T) : x));
  }
  return [{ ...item, id: item.id ?? uid(), createdAt: now, updatedAt: now } as T, ...list];
}

/** Apply (sign=-1) or refund (sign=+1) gift card usage to balances. */
function adjustGiftBalances(giftCards: GiftCard[], uses: Transaction['giftCards'], sign: 1 | -1) {
  if (!uses.length) return giftCards;
  return giftCards.map((g) => {
    const used = uses.filter((u) => u.giftCardId === g.id).reduce((a, u) => a + u.amount, 0);
    return used ? { ...g, balance: Math.max(0, round2(g.balance + sign * used)), updatedAt: Date.now() } : g;
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<VaultData>(() => ({ transactions: [], cards: [], giftCards: [], merchants: [], settings: {} as Settings, logos: {} }));
  const [meta, setMeta] = useState<V.VaultMeta | null>(null);
  const dek = useRef<CryptoKey | null>(null);
  const dataRef = useRef(data);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    V.loadMeta().then((m) => {
      setMeta(m ?? null);
      setStatus(m ? 'locked' : 'setup');
    });
  }, []);

  const opened = useCallback((r: { dek: CryptoKey; data: VaultData; meta: V.VaultMeta }) => {
    dek.current = r.dek;
    dataRef.current = r.data;
    setData(r.data);
    setMeta(r.meta);
    setStatus('unlocked');
    requestPersistence();
  }, []);

  const flushRef = useRef<() => unknown>(() => undefined);
  const lock = useCallback(() => {
    flushRef.current();
    dek.current = null;
    const blank = { transactions: [], cards: [], giftCards: [], merchants: [], settings: dataRef.current.settings, logos: {} } as VaultData;
    dataRef.current = blank;
    setData(blank);
    setStatus((s) => (s === 'unlocked' ? 'locked' : s));
  }, []);

  /**
   * Mutate state immediately, then persist the encrypted snapshot shortly after.
   * Rapid edits (typing in settings) coalesce into one encryption + write.
   */
  const pending = useRef<{ timer: number; key: CryptoKey } | null>(null);
  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return saveChain.current;
    clearTimeout(p.timer);
    pending.current = null;
    const snapshot = dataRef.current;
    saveChain.current = saveChain.current.then(() => V.saveData(p.key, snapshot)).catch((e) => console.error('Save failed', e));
    return saveChain.current;
  }, []);

  const commit = useCallback(async (fn: (d: VaultData) => VaultData, immediate = true) => {
    if (!dek.current) throw new Error('Vault is locked');
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { key: dek.current, timer: window.setTimeout(flush, immediate ? 0 : 400) };
    if (immediate) await flush();
  }, [flush]);

  flushRef.current = flush;
  useEffect(() => {
    const onHide = () => { if (document.hidden) flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  // ---- Auto-lock on inactivity and when hidden ----
  useEffect(() => {
    if (status !== 'unlocked') return;
    const minutes = data.settings.autoLockMinutes ?? 5;
    if (!minutes) return;
    const ms = minutes * 60_000;
    let timer = window.setTimeout(lock, ms);
    let hiddenAt = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = window.setTimeout(lock, ms);
    };
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= ms) lock();
      else bump();
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(timer);
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', vis);
    };
  }, [status, data.settings.autoLockMinutes, lock]);

  const store = useMemo<Store>(
    () => ({
      status,
      data,
      meta,
      biometricEnabled: !!meta?.biometric,
      setup: async (p, k) => opened(await V.createVault(p, k)),
      unlock: async (p) => opened(await V.unlockWithPasscode(p)),
      unlockBiometric: async () => opened(await V.unlockWithBiometric()),
      lock,
      refreshMeta: async () => setMeta((await V.loadMeta()) ?? null),
      replaceAll: (d) => commit(() => d),
      saveTransaction: (t) =>
        commit((d) => {
          const prev = t.id ? d.transactions.find((x) => x.id === t.id) : undefined;
          let giftCards = d.giftCards;
          if (prev) giftCards = adjustGiftBalances(giftCards, prev.giftCards, 1);
          giftCards = adjustGiftBalances(giftCards, t.giftCards, -1);
          const transactions = upsert(d.transactions, t as Partial<Transaction>).sort(
            (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
          );
          return { ...d, transactions, giftCards };
        }),
      deleteTransaction: (id) =>
        commit((d) => {
          const prev = d.transactions.find((x) => x.id === id);
          return {
            ...d,
            transactions: d.transactions.filter((x) => x.id !== id),
            giftCards: prev ? adjustGiftBalances(d.giftCards, prev.giftCards, 1) : d.giftCards,
          };
        }),
      saveCard: (c) => commit((d) => ({ ...d, cards: upsert(d.cards, c as Partial<PaymentCard>) })),
      deleteCard: (id) => commit((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) })),
      saveGiftCard: (g) => commit((d) => ({ ...d, giftCards: upsert(d.giftCards, g as Partial<GiftCard>) })),
      deleteGiftCard: (id) => commit((d) => ({ ...d, giftCards: d.giftCards.filter((g) => g.id !== id) })),
      saveMerchant: async (m) => {
        const existing = m.id ?? dataRef.current.merchants.find((x) => x.vpa && x.vpa.toLowerCase() === m.vpa.toLowerCase())?.id;
        const id = existing ?? uid();
        await commit((d) => {
          const now = Date.now();
          const merchants = d.merchants.some((x) => x.id === id)
            ? d.merchants.map((x) => (x.id === id ? { ...x, ...m, id, updatedAt: now } : x))
            : [{ ...m, id, updatedAt: now }, ...d.merchants];
          return { ...d, merchants };
        });
        return id;
      },
      deleteMerchant: (id) => commit((d) => ({ ...d, merchants: d.merchants.filter((m) => m.id !== id) })),
      updateSettings: (patch) => commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }), false),
      setLogo: (key, url) =>
        commit((d) => {
          const logos = { ...d.logos };
          if (url) logos[key] = url;
          else delete logos[key];
          return { ...d, logos };
        }),
    }),
    [status, data, meta, opened, lock, commit],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
