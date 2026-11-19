import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import type { GiftCard } from '../lib/types';
import { GIFT_BRANDS, giftBackground, giftBrand } from '../lib/categories';
import { daysUntil, money, parseISO, prettyDate, round2 } from '../lib/format';
import { Logo, hasLogo } from '../lib/logos';
import { DeleteRow, Empty, FieldRow, Group, NavRow, Segmented, Sheet, copyText, toast } from '../components/ui';
import { useVerify } from '../components/Verify';
import { LogoPicker } from '../components/LogoPicker';
import { ICopy, IEye, IEyeOff, IPlus } from '../components/Icons';

type Filter = 'active' | 'used' | 'archived';

export function LogoTile({ brand, size }: { brand: string; size?: number }) {
  const { data } = useStore();
  return (
    <span className="logo-tile" style={size ? { minWidth: size, maxWidth: size * 2.4, height: size, borderRadius: size * 0.27, padding: `${size * 0.15}px ${size * 0.2}px` } : undefined}>
      {hasLogo(brand, data.logos) ? <Logo name={brand} /> : <span className="mono-l" style={{ color: giftBrand(brand).color }}>{brand.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

function expiryLabel(g: GiftCard) {
  if (!g.expiry) return null;
  const d = daysUntil(parseISO(g.expiry));
  if (d < 0) return 'Expired';
  if (d <= 30) return `${d}d left`;
  return parseISO(g.expiry).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
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
        <div className="brand">{g.brand}</div>
        <div className="bal num">{money(g.balance, currency, { hide })}</div>
        <div className="pbar"><div style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

export function GiftCards() {
  const { data } = useStore();
  const { giftCards, settings } = data;
  const [filter, setFilter] = useState<Filter>('active');
  const [form, setForm] = useState<{ open: boolean; edit?: GiftCard }>({ open: false });
  const [detail, setDetail] = useState<string | null>(null);

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
      <header className="topbar">
        <h1>Gift Cards</h1>
        <div className="actions">
          <button className="glass-btn liquid tint" onClick={() => setForm({ open: true })} aria-label="Add gift card"><IPlus /></button>
        </div>
      </header>

      <div className="stack-lg">
        <div className="card hero">
          <div className="row between">
            <span className="k">Available balance</span>
            {expiring > 0 && <span className="pill warn">{expiring} expiring soon</span>}
          </div>
          <div className="big num">{fmt(total)}</div>
          <div className="foot muted">across {active.length} active card{active.length === 1 ? '' : 's'}</div>
        </div>

        <Segmented full value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'used', label: 'Used up' }, { value: 'archived', label: 'Archived' }]} />

        {list.length === 0 ? (
          <Empty icon="🎁" title={filter === 'active' ? 'No gift cards' : 'Nothing here'} text="Keep Amazon, Flipkart, Myntra and other gift cards here and use them while logging spends." action={filter === 'active' ? <button className="btn primary" onClick={() => setForm({ open: true })}>Add gift card</button> : undefined} />
        ) : (
          <div className="gift-grid">
            {list.map((g) => (
              <button key={g.id} onClick={() => setDetail(g.id)} aria-label={`${g.brand} gift card`} style={{ display: 'block' }}>
                <GiftPass g={g} currency={settings.currency} hide={settings.hideAmounts} />
              </button>
            ))}
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

  const reveal = async () => (show ? setShow(false) : (await verify()) && setShow(true));
  const copy = async (v: string, label: string) => (await verify()) && copyText(v, label);
  const Secret = ({ label, value }: { label: string; value: string }) => (
    <div className="cell">
      <span className="grow">
        <div className="st" style={{ marginTop: 0 }}>{label}</div>
        <div className="mono" style={{ fontSize: 17, marginTop: 2, wordBreak: 'break-all' }}>{show ? value : '•••• ••••'}</div>
      </span>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={reveal} aria-label={show ? 'Hide' : 'Show'}>{show ? <IEyeOff width={18} /> : <IEye width={18} />}</button>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={() => copy(value, `${label} copied`)} aria-label={`Copy ${label}`}><ICopy width={18} /></button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={g.brand} cancelLabel="Done" actions={<button className="textbtn" onClick={onEdit}>Edit</button>}>
      <div className="stack-lg">
        <GiftPass g={g} currency={cur} hide={false} big />
        <Group header="Redeem">
          <Secret label="Card number / code" value={g.code || '—'} />
          {g.pin && <Secret label="PIN" value={g.pin} />}
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
          <button className="cell tint" disabled={g.balance <= 0} style={{ opacity: g.balance > 0 ? 1 : 0.4 }} onClick={() => { onClose(); nav.newSpend({ giftCards: [{ giftCardId: g.id, amount: 0 }], payment: { type: 'giftcard' } }); }}>Spend with this card</button>
          <button className="cell tint" onClick={async () => { await saveGiftCard({ ...g, archived: !g.archived }); toast(g.archived ? 'Restored' : 'Archived'); onClose(); }}>{g.archived ? 'Unarchive' : 'Archive'}</button>
        </div>
        <DeleteRow label="Delete gift card" onConfirm={async () => { await deleteGiftCard(g.id); toast('Gift card deleted'); onClose(); }} />
      </div>
      {element}
    </Sheet>
  );
}

function GiftForm({ edit, onClose }: { edit?: GiftCard; onClose: () => void }) {
  const { saveGiftCard, data } = useStore();
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
  const clean = (s: string) => s.replace(/[^\d.]/g, '');

  const save = async () => {
    const v = Number(value) || 0;
    const b = balance === '' ? v : Number(balance) || 0;
    if (!name) return setErr('Enter the brand name.');
    if (!(v > 0)) return setErr('Enter the gift card value.');
    await saveGiftCard({ id: edit?.id, brand: name, code: code.trim(), pin: pin.trim(), value: round2(v), balance: round2(b), expiry, notes: notes.trim(), archived: edit?.archived ?? false });
    toast(edit ? 'Gift card updated' : 'Gift card added');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit Gift Card' : 'New Gift Card'} actions={<button className="textbtn bold" onClick={save}>{edit ? 'Done' : 'Add'}</button>}>
      <div className="stack-lg">
        <Group>
          <FieldRow label="Brand">
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {GIFT_BRANDS.map((b) => <option key={b.name}>{b.name}</option>)}
            </select>
          </FieldRow>
          {brand === 'Other' && <FieldRow label="Brand name"><input placeholder="Required" value={custom} onChange={(e) => setCustom(e.target.value)} /></FieldRow>}
          {name && <LogoPicker name={name} label="Logo" />}
        </Group>
        <Group footer="Codes and PINs are encrypted and hidden until you verify.">
          <FieldRow label="Card / code"><input className="mono" autoComplete="off" spellCheck={false} placeholder="Required" value={code} onChange={(e) => setCode(e.target.value)} /></FieldRow>
          <FieldRow label="PIN"><input className="mono" autoComplete="off" spellCheck={false} placeholder="Optional" value={pin} onChange={(e) => setPin(e.target.value)} /></FieldRow>
        </Group>
        <Group footer={edit ? 'Balance updates automatically when you log spends with this card.' : undefined}>
          <FieldRow label={`Value (${data.settings.currency})`}><input inputMode="decimal" placeholder="0" value={value} onChange={(e) => setValue(clean(e.target.value))} /></FieldRow>
          <FieldRow label="Balance"><input inputMode="decimal" placeholder={value || 'Same as value'} value={balance} onChange={(e) => setBalance(clean(e.target.value))} /></FieldRow>
          <FieldRow label="Expires"><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></FieldRow>
        </Group>
        <Group header="Notes">
          <div className="cell"><textarea placeholder="Where it came from, terms…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </Group>
        {err && <div className="group-f bad" style={{ marginTop: -10 }}>{err}</div>}
      </div>
    </Sheet>
  );
}
