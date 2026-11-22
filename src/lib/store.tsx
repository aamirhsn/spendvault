import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GiftCard, Merchant, PaymentCard, Settings, SmsRule, Todo, Transaction, VaultData } from './types';
import { emptyVault } from './types';
import * as V from './vault';
import { last4, round2, uid } from './format';
import { requestPersistence } from './db';

/**
 * Two storage tiers:
 *  • open data   — spends, budgets, merchants, gift card balances, card names/dues. Encrypted with a
 *                  device key; available as soon as the app opens.
 *  • card vault  — full card numbers, CVV, expiry, holder, card photos, gift card codes/PINs.
 *                  Encrypted with a key only your PIN or biometrics can unwrap.
 */
type Status = 'loading' | 'migrate' | 'ready';
type VaultState = 'none' | 'locked' | 'unlocked';

interface UnlockRequest { reason: string; resolve: (ok: boolean) => void }

interface Store {
  status: Status;
  vault: VaultState;
  data: VaultData;
  meta: V.VaultMeta | null;
  biometricEnabled: boolean;
  unlockRequest: UnlockRequest | null;
  /** Ask for PIN / biometrics (or PIN setup). Resolves true once the card vault is unlocked. */
  requestUnlock(reason: string): Promise<boolean>;
  setupPin(pin: string): Promise<void>;
  unlock(pin: string): Promise<void>;
  unlockBiometric(): Promise<void>;
  migrate(passcode: string | null): Promise<V.PasscodeKind>;
  finishMigration(): void;
  lock(): void;
  refreshMeta(): Promise<void>;
  replaceAll(data: VaultData): Promise<void>;
  saveTransaction(t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void>;
  saveTransactions(ts: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[], seen?: string[]): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCard(c: Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt' | 'last4'> & { id?: string; last4?: string }): Promise<void>;
  deleteCard(id: string): Promise<void>;
  saveGiftCard(g: Omit<GiftCard, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void>;
  deleteGiftCard(id: string): Promise<void>;
  saveMerchant(m: Omit<Merchant, 'id' | 'updatedAt'> & { id?: string }): Promise<string>;
  deleteMerchant(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  setLogo(key: string, dataUrl: string | null): Promise<void>;
  saveRules(rules: SmsRule[]): Promise<void>;
  saveTodo(t: Partial<Todo> & { title: string }): Promise<void>;
  toggleTodo(id: string): Promise<void>;
  deleteTodo(id: string): Promise<void>;
  clearDoneTodos(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};

// ---- split / merge between the two tiers ----
function split(d: VaultData): { pub: VaultData; sec: V.Secrets } {
  const sec = V.emptySecrets();
  const cards = d.cards.map((c) => {
    sec.cards[c.id] = { number: c.number, cvv: c.cvv, expiry: c.expiry, holder: c.holder, art: c.art };
    return { ...c, last4: c.last4 || last4(c.number), number: '', cvv: '', expiry: '', holder: '', art: undefined };
  });
  const giftCards = d.giftCards.map((g) => {
    sec.gifts[g.id] = { code: g.code, pin: g.pin };
    return { ...g, codeTail: g.code ? tail(g.code) : g.codeTail, code: '', pin: '' };
  });
  return { pub: { ...d, cards, giftCards }, sec };
}
function merge(d: VaultData, sec: V.Secrets): VaultData {
  return {
    ...d,
    cards: d.cards.map((c) => (sec.cards[c.id] ? { ...c, ...sec.cards[c.id] } : c)),
    giftCards: d.giftCards.map((g) => (sec.gifts[g.id] ? { ...g, ...sec.gifts[g.id] } : g)),
  };
}

function upsert<T extends { id: string; createdAt?: number; updatedAt: number }>(list: T[], item: Partial<T> & { id?: string }): T[] {
  const now = Date.now();
  if (item.id && list.some((x) => x.id === item.id)) return list.map((x) => (x.id === item.id ? ({ ...x, ...item, updatedAt: now } as T) : x));
  return [{ ...item, id: item.id ?? uid(), createdAt: now, updatedAt: now } as T, ...list];
}

function adjustGiftBalances(giftCards: GiftCard[], uses: Transaction['giftCards'], sign: 1 | -1) {
  if (!uses.length) return giftCards;
  return giftCards.map((g) => {
    const used = uses.filter((u) => u.giftCardId === g.id).reduce((a, u) => a + u.amount, 0);
    return used ? { ...g, balance: Math.max(0, round2(g.balance + sign * used)), updatedAt: Date.now() } : g;
  });
}
const tail = (code: string) => code.replace(/[\s-]/g, '').slice(-4);
/** Completed to-dos are kept this many days, then removed. */
export const TODO_KEEP_DAYS = 10;
const sortTx = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [vault, setVault] = useState<VaultState>('none');
  const [data, setData] = useState<VaultData>(emptyVault);
  const [meta, setMeta] = useState<V.VaultMeta | null>(null);
  const [unlockRequest, setUnlockRequest] = useState<UnlockRequest | null>(null);
  const dek = useRef<CryptoKey | null>(null);
  const dataRef = useRef(data);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef(0);

  const setAll = (d: VaultData) => {
    dataRef.current = d;
    setData(d);
  };

  useEffect(() => {
    (async () => {
      const m = (await V.loadMeta()) ?? null;
      setMeta(m);
      if (await V.hasLegacyData()) {
        setVault('locked');
        setStatus('migrate');
        return;
      }
      setAll((await V.loadOpen()) ?? emptyVault());
      setVault(m ? 'locked' : 'none');
      setStatus('ready');
      requestPersistence();
    })();
  }, []);

  /** Persist: open tier always; secure tier only while unlocked (otherwise secrets aren't in memory). */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = 0;
    const snapshot = dataRef.current;
    const key = dek.current;
    saveChain.current = saveChain.current
      .then(async () => {
        const { pub, sec } = split(snapshot);
        await V.saveOpen(pub);
        if (key) await V.saveSecure(key, sec);
      })
      .catch((e) => console.error('Save failed', e));
    return saveChain.current;
  }, []);

  const commit = useCallback(async (fn: (d: VaultData) => VaultData, immediate = true) => {
    setAll(fn(dataRef.current));
    clearTimeout(timer.current);
    if (immediate) await flush();
    else timer.current = window.setTimeout(flush, 400);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.hidden && timer.current) flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const opened = useCallback(async (r: { dek: CryptoKey; meta: V.VaultMeta }) => {
    dek.current = r.dek;
    setMeta(r.meta);
    setAll(merge(dataRef.current, await V.loadSecure(r.dek)));
    setVault('unlocked');
    // Backfill public code tails for gift cards saved before they existed.
    if (dataRef.current.giftCards.some((g) => g.code && !g.codeTail)) flush();
  }, [flush]);

  const lock = useCallback(() => {
    if (!dek.current) return;
    if (timer.current) flush();
    dek.current = null;
    setAll(split(dataRef.current).pub);
    setVault((v) => (v === 'unlocked' ? 'locked' : v));
  }, [flush]);

  // Completed to-dos are cleared 10 days after they were ticked off.
  useEffect(() => {
    if (status !== 'ready') return;
    const sweep = () => {
      const cutoff = Date.now() - TODO_KEEP_DAYS * 86_400_000;
      const todos = dataRef.current.todos ?? [];
      if (todos.some((t) => t.done && (t.doneAt ?? t.updatedAt) < cutoff)) {
        commit((d) => ({ ...d, todos: (d.todos ?? []).filter((t) => !(t.done && (t.doneAt ?? t.updatedAt) < cutoff)) }));
      }
    };
    sweep();
    const id = window.setInterval(sweep, 6 * 3_600_000);
    return () => clearInterval(id);
  }, [status, commit]);

  // Auto-lock the card vault after inactivity / time in background.
  useEffect(() => {
    if (vault !== 'unlocked') return;
    const minutes = data.settings.autoLockMinutes ?? 5;
    if (!minutes) return;
    const ms = minutes * 60_000;
    let t = window.setTimeout(lock, ms);
    let hiddenAt = 0;
    const bump = () => { clearTimeout(t); t = window.setTimeout(lock, ms); };
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= ms) lock();
      else bump();
    };
    const evs = ['pointerdown', 'keydown'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', vis);
    };
  }, [vault, data.settings.autoLockMinutes, lock]);

  const requestUnlock = useCallback((reason: string) => {
    if (dek.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setUnlockRequest({ reason, resolve: (ok) => { setUnlockRequest(null); resolve(ok); } }));
  }, []);

  const store = useMemo<Store>(
    () => ({
      status,
      vault,
      data,
      meta,
      biometricEnabled: !!meta?.biometric,
      unlockRequest,
      requestUnlock,
      setupPin: async (pin) => {
        const r = await V.createVault(pin, 'pin');
        dek.current = r.dek;
        setMeta(r.meta);
        setVault('unlocked');
        await flush();
      },
      unlock: async (pin) => opened(await V.unlockWithPasscode(pin)),
      unlockBiometric: async () => opened(await V.unlockWithBiometric()),
      migrate: async (passcode) => {
        const r = passcode != null ? await V.unlockWithPasscode(passcode) : await V.unlockWithBiometric();
        const legacy = await V.loadData(r.dek);
        dek.current = r.dek;
        setMeta(r.meta);
        const cards = legacy.cards.map((c) => ({ ...c, last4: c.last4 || last4(c.number) }));
        setAll({ ...legacy, cards });
        await flush();
        await V.deleteLegacyData();
        setVault('unlocked');
        // Password vaults stay on the migration screen until a PIN replaces the password.
        if (r.meta.passcode.kind === 'pin' || passcode == null) setStatus('ready');
        requestPersistence();
        return r.meta.passcode.kind;
      },
      finishMigration: () => setStatus('ready'),
      lock,
      refreshMeta: async () => setMeta((await V.loadMeta()) ?? null),
      replaceAll: (d) => commit(() => ({ ...d, cards: d.cards.map((c) => ({ ...c, last4: c.last4 || last4(c.number) })) })),
      saveTransaction: (t) =>
        commit((d) => {
          const prev = t.id ? d.transactions.find((x) => x.id === t.id) : undefined;
          let giftCards = d.giftCards;
          if (prev) giftCards = adjustGiftBalances(giftCards, prev.giftCards, 1);
          giftCards = adjustGiftBalances(giftCards, t.giftCards, -1);
          return { ...d, transactions: upsert(d.transactions, t as Partial<Transaction>).sort(sortTx), giftCards };
        }),
      saveTransactions: (ts, seen = []) =>
        commit((d) => {
          let list = d.transactions;
          for (const t of ts) list = upsert(list, t as Partial<Transaction>);
          return { ...d, transactions: list.sort(sortTx), smsSeen: [...seen, ...(d.smsSeen ?? [])].slice(0, 1000) };
        }),
      deleteTransaction: (id) =>
        commit((d) => {
          const prev = d.transactions.find((x) => x.id === id);
          return { ...d, transactions: d.transactions.filter((x) => x.id !== id), giftCards: prev ? adjustGiftBalances(d.giftCards, prev.giftCards, 1) : d.giftCards };
        }),
      saveCard: (c) => commit((d) => ({ ...d, cards: upsert(d.cards, { ...c, last4: c.number ? last4(c.number) : c.last4 } as Partial<PaymentCard>) })),
      deleteCard: (id) => commit((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) })),
      saveGiftCard: (g) => commit((d) => ({ ...d, giftCards: upsert(d.giftCards, { ...g, codeTail: g.code ? tail(g.code) : g.codeTail } as Partial<GiftCard>) })),
      deleteGiftCard: (id) => commit((d) => ({ ...d, giftCards: d.giftCards.filter((g) => g.id !== id) })),
      saveMerchant: async (m) => {
        const id = m.id ?? dataRef.current.merchants.find((x) => x.vpa && x.vpa.toLowerCase() === m.vpa.toLowerCase())?.id ?? uid();
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
      saveRules: (rules) => commit((d) => ({ ...d, rules })),
      saveTodo: (t) => commit((d) => ({ ...d, todos: upsert(d.todos ?? [], { done: false, ...t } as Partial<Todo>) })),
      toggleTodo: (id) =>
        commit((d) => ({ ...d, todos: (d.todos ?? []).map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now(), updatedAt: Date.now() } : t)) })),
      deleteTodo: (id) => commit((d) => ({ ...d, todos: (d.todos ?? []).filter((t) => t.id !== id) })),
      clearDoneTodos: () => commit((d) => ({ ...d, todos: (d.todos ?? []).filter((t) => !t.done) })),
    }),
    [status, vault, data, meta, unlockRequest, requestUnlock, opened, lock, commit, flush],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
