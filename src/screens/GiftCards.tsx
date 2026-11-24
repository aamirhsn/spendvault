import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import type { GiftCard } from '../lib/types';
import { GIFT_BRANDS, giftBackground, giftBrand, giftName } from '../lib/categories';
import { daysUntil, money, parseISO, prettyDate, round2 } from '../lib/format';
import { Logo, hasLogo } from '../lib/logos';
import { DeleteRow, Empty, FieldRow, Group, NavRow, Segmented, Sheet, copyText, toast, SaveBtn, EditBtn, AddFab } from '../components/ui';
import { useVerify } from '../components/Verify';
import { LogoPicker } from '../components/LogoPicker';
import { ICalendar, ICopy, IEdit, IEye, IEyeOff, IHash, ILock, IPie, ITag, IWallet } from '../components/Icons';

type Filter = 'active' | 'used' | 'archived';

export function LogoTile({ brand, size }: { brand: string; size?: number }) {
  const { data } = useStore();
  return (
    <span className="logo-tile" style={size ? { minWidth: size, maxWidth: size * 2, height: size, boxShadow: 'inset 0 0 0 .5px var(--sep)', borderRadius: size * 0.27, padding: `${size * 0.15}px ${size * 0.2}px` } : undefined}>
      {hasLogo(brand, data.logos) ? <Logo name={brand} /> : <span className="mono-l" style={{ color: giftBrand(brand).color }}>{brand.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

function expiryLabel(g: GiftCard) {
  if (!g.expiry) return null;
  const d = daysUntil(parseISO(g.expiry));
  if (d < 0) return 'Expired';
  if (d <= 30) return `${d}d left`;
  const e = parseISO(g.expiry);
  return e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: e.getFullYear() !== new Date().getFullYear() ? '2-digit' : undefined });
}

export function GiftPass({ g, currency, hide, big }: { g: GiftCard; currency: string; hide: boolean; big?: boolean }) {
  const b = giftBrand(g.brand);
  const pct = g.value > 0 ? Math.min(100, (g.balance / g.value) * 100) : 0;
  const exp = expiryLabel(g);
  const expired = !!g.expiry && daysUntil(parseISO(g.expiry)) < 0;
  return (
    <div className={`gcard ${big ? 'big' : ''} ${g.balance <= 0 || g.archived || expired ? 'dim' : ''}`} style={{ background: giftBackground(b.color), ['--ink' as string]: b.ink ?? '#fff' }}>
      <div className="top">
        <LogoTile brand={g.brand} />
        {exp && <span className="exp">{exp}</span>}
      </div>
      <div>
        <div className="brand">{giftName(g)}</div>
        <div className="bal num">{money(g.balance, currency, { hide })}</div>
        <div className="pbar"><div style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

/** Small logo for pins/stubs: brand art if known, else the brand initial in its colour. */
function MiniLogo({ brand }: { brand: string }) {
  const { data } = useStore();
  return hasLogo(brand, data.logos) ? <Logo name={brand} /> : <b className="mini-l" style={{ color: giftBrand(brand).color }}>{brand.slice(0, 1).toUpperCase()}</b>;
}

/** Tear-off voucher: brand stub, perforation, balance. */
export function VoucherTicket({ g, fmt, onClick }: { g: GiftCard; fmt: (n: number) => string; onClick(): void }) {
  const b = giftBrand(g.brand);
  const d = g.expiry ? daysUntil(parseISO(g.expiry)) : null;
  const expired = d != null && d < 0;
  const exp = expiryLabel(g);
  const pct = g.value > 0 ? Math.min(100, (g.balance / g.value) * 100) : 0;
  return (
    <button className={`vt${g.balance <= 0 || g.archived || expired ? ' dim' : ''}`} onClick={onClick} aria-label={`${giftName(g)}, ${fmt(g.balance)} left`}>
      <span className="vt-stub" style={{ background: giftBackground(b.color) }}>
        <span className="vt-logo"><MiniLogo brand={g.brand} /></span>
      </span>
      <span className="vt-body">
        <span className="vt-name">{g.brand}{(g.codeTail || g.code) && <em> ••{g.codeTail || g.code.replace(/[\s-]/g, '').slice(-4)}</em>}</span>
        <span className="vt-amt">{fmt(g.balance)}{g.value > 0 && g.value !== g.balance && <small> of {fmt(g.value)}</small>}</span>
        {g.value > 0 && <span className="vt-bar"><i style={{ width: `${pct}%`, background: b.color }} /></span>}
        {exp && <span className={`vt-exp${expired ? ' bad' : d != null && d <= 30 ? ' hot' : ''}`}>{exp}</span>}
      </span>
    </button>
  );
}

const RUNWAY_DAYS = 183;
/** Timeline of the next ~6 months with each active card pinned to its expiry date. */
export function ExpiryRunway({ cards, fmt, onOpen }: { cards: GiftCard[]; fmt: (n: number) => string; onOpen(id: string): void }) {
  const items = cards
    .map((g) => ({ g, d: daysUntil(parseISO(g.expiry)) }))
    .filter((x) => x.d >= 0 && x.d <= RUNWAY_DAYS)
    .sort((a, b) => a.d - b.d);
  if (!items.length) return null;
  // Lanes: 0 = just above the rail, 1 = just below, 2 = higher, 3 = lower. Greedy so pins don't overlap.
  const W = 24; // pin width as % of the track
  const lastX = [-99, -99, -99, -99];
  const pins = items.map((x) => {
    const pos = 3 + (x.d / RUNWAY_DAYS) * 94;
    let lane = lastX.findIndex((l) => pos - l >= W);
    if (lane < 0) lane = lastX.indexOf(Math.min(...lastX));
    lastX[lane] = pos;
    return { ...x, pos, lane };
  });
  const up = pins.some((p) => p.lane === 2) ? 2 : pins.some((p) => p.lane === 0) ? 1 : 0;
  const down = pins.some((p) => p.lane === 3) ? 2 : pins.some((p) => p.lane === 1) ? 1 : 0;
  const railTop = 8 + up * 54;
  const height = railTop + 28 + down * 54;
  const now = new Date();
  const months = [1, 2, 3, 4, 5, 6].map((m) => {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), pos: 3 + (Math.round((d.getTime() - now.getTime()) / 86_400_000) / RUNWAY_DAYS) * 94 };
  }).filter((m) => m.pos > 12 && m.pos < 97);
  const first = items[0];
  return (
    <div className="rw">
      <div className="label-xs">Expiring in the next 6 months</div>
      <div className="rw-track" style={{ height, ['--rail' as string]: `${railTop}px` }}>
        <div className="rw-rail" />
        <span className="rw-m" style={{ left: '3%' }}>Now</span>
        {months.map((m) => <span key={m.label} className="rw-m" style={{ left: `${m.pos}%` }}>{m.label}</span>)}
        {pins.map(({ g, d, pos, lane }) => {
          const c = giftBrand(g.brand).color;
          return (
            <button key={g.id} className={`rw-pin l${lane}${d <= 30 ? ' hot' : ''}`} style={{ left: `${pos}%`, ['--c' as string]: c }} onClick={() => onOpen(g.id)} aria-label={`${giftName(g)} expires in ${d} days`}>
              <span className="rw-card">
                <span className="rw-logo"><MiniLogo brand={g.brand} /></span>
                <b>{fmt(g.balance)}</b>
              </span>
              <i className="rw-dot" />
            </button>
          );
        })}
      </div>
      <button className={`rw-first${first.d <= 30 ? ' hot' : ''}`} onClick={() => onOpen(first.g.id)}>
        <b>Use {first.g.brand} first</b> · {fmt(first.g.balance)} expires {first.d === 0 ? 'today' : first.d === 1 ? 'tomorrow' : `in ${first.d} days`}
      </button>
    </div>
  );
}

export function GiftCards() {
  const { data } = useStore();
  const { giftCards, settings } = data;
  const [filter, setFilter] = useState<Filter>('active');
  const [form, setForm] = useState<{ open: boolean; edit?: GiftCard }>({ open: false });
  const [detail, setDetail] = useState<string | null>(null);
  const nav = useNav();
  useEffect(() => {
    if (nav.intent === 'gift') { nav.clearIntent(); setForm({ open: true }); }
  }, [nav]);

  const list = useMemo(
    () =>
      giftCards
        .filter((g) => (filter === 'archived' ? g.archived : !g.archived && (filter === 'active' ? g.balance > 0 : g.balance <= 0)))
        .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999')),
    [giftCards, filter],
  );
  const active = giftCards.filter((g) => !g.archived && g.balance > 0);
  const total = active.reduce((a, g) => a + g.balance, 0);
  const expiring = active.filter((g) => g.expiry && daysUntil(parseISO(g.expiry)) >= 0 && daysUntil(parseISO(g.expiry)) <= 30).length;
  const fmt = (n: number) => money(n, settings.currency, { hide: settings.hideAmounts, decimals: false });
  const current = detail ? giftCards.find((g) => g.id === detail) : undefined;

  return (
    <div className="screen">
      <AddFab label="Add gift card" onClick={() => setForm({ open: true })} />
      <div className="wash" style={{ ['--wash' as string]: '#ffd3e2' }} />
      <header className="topbar">
        <h1>Gift Cards</h1>
        <div className="actions">
        </div>
      </header>

      <div className="stack-lg">
        <div className="card hero gift-hero">
          <div className="row between">
            <span className="k">Available balance</span>
            {expiring > 0 && <span className="pill warn">{expiring} expiring soon</span>}
          </div>
          <div className="big num">{fmt(total)}</div>
          <div className="foot muted">across {active.length} active card{active.length === 1 ? '' : 's'}</div>
          <ExpiryRunway cards={active.filter((g) => g.expiry)} fmt={fmt} onOpen={setDetail} />
        </div>

        <Segmented full value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'used', label: 'Used up' }, { value: 'archived', label: 'Archived' }]} />

        {list.length === 0 ? (
          <Empty icon="🎁" title={filter === 'active' ? 'No gift cards' : 'Nothing here'} text="Keep Amazon, Flipkart, Myntra and other gift cards here and use them while logging spends." action={filter === 'active' ? <button className="btn primary" onClick={() => setForm({ open: true })}>Add gift card</button> : undefined} />
        ) : (
          <div className="vt-list">
            {list.map((g) => <VoucherTicket key={g.id} g={g} fmt={fmt} onClick={() => setDetail(g.id)} />)}
          </div>
        )}
      </div>

      {form.open && <GiftForm edit={form.edit} onClose={() => setForm({ open: false })} />}
      {current && <GiftDetail g={current} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); setForm({ open: true, edit: current }); }} />}
    </div>
  );
}

function GiftDetail({ g, onClose, onEdit }: { g: GiftCard; onClose: () => void; onEdit: () => void }) {
  const { data, saveGiftCard, deleteGiftCard } = useStore();
  const nav = useNav();
  const { verify, element } = useVerify();
  const [show, setShow] = useState(false);
  const cur = data.settings.currency;
  const uses = data.transactions.filter((t) => t.giftCards.some((u) => u.giftCardId === g.id));

  const { requestUnlock } = useStore();
  const ready = async () => (await requestUnlock('Unlock to see gift card codes')) && (await verify());
  const reveal = async () => (show ? setShow(false) : (await ready()) && setShow(true));
  // Read the latest value after unlocking (codes are only in memory while the vault is open).
  const copy = async (k: 'code' | 'pin', label: string) => {
    if (!(await ready())) return;
    await new Promise((r) => setTimeout(r, 60)); // let the unlocked values render
    copyText(document.querySelector<HTMLElement>(`[data-secret="${k}"]`)?.dataset.value ?? '', label);
  };
  const Secret = ({ label, value, k }: { label: string; value: string; k: 'code' | 'pin' }) => (
    <div className="cell">
      <span className="grow">
        <div className="st" style={{ marginTop: 0 }}>{label}</div>
        <div className="mono" data-secret={k} data-value={value} style={{ fontSize: 17, marginTop: 2, wordBreak: 'break-all' }}>{show ? value || '—' : '•••• ••••'}</div>
      </span>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={reveal} aria-label={show ? 'Hide' : 'Show'}>{show ? <IEyeOff width={18} /> : <IEye width={18} />}</button>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={() => copy(k, `${label} copied`)} aria-label={`Copy ${label}`}><ICopy width={18} /></button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={g.brand} actions={<EditBtn onClick={onEdit} />}>
      <div className="stack-lg">
        <GiftPass g={g} currency={cur} hide={false} big />
        <Group header="Redeem">
          <Secret k="code" label="Card number / code" value={g.code} />
          <Secret k="pin" label="PIN" value={g.pin} />
        </Group>
        <Group>
          <NavRow title="Balance" value={<b style={{ color: 'var(--label)' }}>{money(g.balance, cur)}</b>} />
          <NavRow title="Face value" value={money(g.value, cur)} />
          <NavRow title="Used" value={money(Math.max(0, g.value - g.balance), cur)} />
          <NavRow title="Expires" value={g.expiry ? parseISO(g.expiry).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'} />
        </Group>
        {g.notes && <Group header="Notes"><div className="cell" style={{ whiteSpace: 'pre-wrap' }}>{g.notes}</div></Group>}
        {uses.length > 0 && (
          <Group header="Used in">
            {uses.map((t) => (
              <NavRow key={t.id} title={t.description || t.category} subtitle={prettyDate(t.date)} value={`−${money(t.giftCards.filter((u) => u.giftCardId === g.id).reduce((a, u) => a + u.amount, 0), cur)}`} onClick={() => { onClose(); nav.editSpend(t); }} />
            ))}
          </Group>
        )}
        <div className="group">
          <button className="cell tint" disabled={g.balance <= 0} style={{ opacity: g.balance > 0 ? 1 : 0.4 }} onClick={() => { onClose(); nav.newSpend({ giftCards: [{ giftCardId: g.id, amount: 0 }], category: 'Shopping' }); }}>Spend with this card</button>
          <button className="cell tint" onClick={async () => { await saveGiftCard({ ...g, archived: !g.archived }); toast(g.archived ? 'Moved back to Active' : 'Moved to Archived', { kind: 'info' }); onClose(); }}>{g.archived ? 'Unarchive' : 'Archive'}</button>
        </div>
        <DeleteRow label="Delete gift card" onConfirm={async () => { await deleteGiftCard(g.id); toast('Gift card deleted', { kind: 'info' }); onClose(); }} />
      </div>
      {element}
    </Sheet>
  );
}

function GiftForm({ edit, onClose }: { edit?: GiftCard; onClose: () => void }) {
  const { saveGiftCard, data, vault, requestUnlock } = useStore();
  const known = GIFT_BRANDS.some((b) => b.name === edit?.brand);
  const [brand, setBrand] = useState(edit ? (known ? edit.brand : 'Other') : 'Amazon');
  const [custom, setCustom] = useState(edit && !known ? edit.brand : '');
  const [code, setCode] = useState(edit?.code ?? '');
  const [pin, setPin] = useState(edit?.pin ?? '');
  const [value, setValue] = useState(edit ? String(edit.value) : '');
  const [balance, setBalance] = useState(edit ? String(edit.balance) : '');
  const [expiry, setExpiry] = useState(edit?.expiry ?? '');
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [err, setErr] = useState('');
  const name = brand === 'Other' ? custom.trim() : brand;
  // Codes live in the PIN vault: load them once it's unlocked.
  useEffect(() => {
    if (vault !== 'unlocked' || !edit) return;
    const cur = data.giftCards.find((x) => x.id === edit.id);
    if (cur) { setCode((c) => c || cur.code); setPin((p) => p || cur.pin); }
  }, [vault, edit, data.giftCards]);
  const clean = (s: string) => s.replace(/[^\d.]/g, '');

  const save = async () => {
    const v = Number(value) || 0;
    const b = balance === '' ? v : Number(balance) || 0;
    if (!name) return setErr('Enter the brand name.');
    if (!(v > 0)) return setErr('Enter the gift card value.');
    if ((code.trim() || pin.trim()) && !(await requestUnlock('Unlock to save the code securely'))) return;
    await saveGiftCard({ id: edit?.id, brand: name, code: code.trim(), pin: pin.trim(), value: round2(v), balance: round2(b), expiry, notes: notes.trim(), archived: edit?.archived ?? false });
    toast(edit ? 'Gift card updated' : 'Gift card added');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit Gift Card' : 'New Gift Card'} actions={<SaveBtn onClick={save} />} footer={<button className="btn primary" onClick={save}>{edit ? 'Save Changes' : 'Add Gift Card'}</button>}>
      <div className="stack-lg">
        <Group>
          <FieldRow icon={<ITag />} tile="#ff2d55" label="Brand">
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {GIFT_BRANDS.map((b) => <option key={b.name}>{b.name}</option>)}
            </select>
          </FieldRow>
          {brand === 'Other' && <FieldRow icon={<IEdit />} tile="#ff2d55" label="Brand name"><input placeholder="Required" value={custom} onChange={(e) => setCustom(e.target.value)} /></FieldRow>}
          {name && <LogoPicker name={name} label="Logo" />}
        </Group>
        <Group footer="Codes and PINs are kept in your PIN-protected vault.">
          {edit && vault !== 'unlocked' && <button className="cell tint" onClick={() => requestUnlock('Unlock to view or change the code')}><ILock width={17} /> Unlock to edit code & PIN</button>}
          <FieldRow icon={<IHash />} tile="#5856d6" label="Card / code"><input className="mono" autoComplete="off" spellCheck={false} placeholder="Required" value={code} onChange={(e) => setCode(e.target.value)} /></FieldRow>
          <FieldRow icon={<ILock />} tile="#8e8e93" label="PIN"><input className="mono" autoComplete="off" spellCheck={false} placeholder="Optional" value={pin} onChange={(e) => setPin(e.target.value)} /></FieldRow>
        </Group>
        <Group footer={edit ? 'Balance updates automatically when you log spends with this card.' : undefined}>
          <FieldRow icon={<IWallet />} tile="#34c759" label={`Value (${data.settings.currency})`}><input inputMode="decimal" placeholder="0" value={value} onChange={(e) => setValue(clean(e.target.value))} /></FieldRow>
          <FieldRow icon={<IPie />} tile="#30b0c7" label="Balance"><input inputMode="decimal" placeholder={value || 'Same as value'} value={balance} onChange={(e) => setBalance(clean(e.target.value))} /></FieldRow>
          <FieldRow icon={<ICalendar />} tile="#ff3b30" label="Expires"><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></FieldRow>
        </Group>
        <Group>
          <FieldRow icon={<IEdit />} tile="#5856d6" label="Notes"><input placeholder="Where it came from, terms…" value={notes} onChange={(e) => setNotes(e.target.value)} /></FieldRow>
        </Group>
        {err && <div className="group-f bad" style={{ marginTop: -10 }}>{err}</div>}
      </div>
    </Sheet>
  );
}
