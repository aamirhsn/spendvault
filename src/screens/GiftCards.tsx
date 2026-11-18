import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import type { GiftCard } from '../lib/types';
import { GIFT_BRANDS, giftBrandAccent, giftBrandColors, inkOn } from '../lib/categories';
import { daysUntil, money, parseISO, prettyDate, round2 } from '../lib/format';
import { Empty, Field, Sheet, copyText, toast } from '../components/ui';
import { useVerify } from '../components/Verify';
import { LogoPicker } from '../components/LogoPicker';
import { BrandLogo, hasBuiltInLogo, logoKey } from '../lib/logos';
import { ICopy, IEdit, IEye, IPlus, ITrash } from '../components/Icons';

type Filter = 'active' | 'used' | 'archived';

function GiftVisual({ g, currency, hide }: { g: GiftCard; currency: string; hide: boolean }) {
  const [c1, c2] = giftBrandColors(g.brand);
  const accent = giftBrandAccent(g.brand);
  const pct = g.value > 0 ? Math.min(100, (g.balance / g.value) * 100) : 0;
  const exp = g.expiry ? daysUntil(parseISO(g.expiry)) : null;
  const { data } = useStore();
  const logo = hasBuiltInLogo(g.brand) || !!data.logos?.[logoKey(g.brand)];
  return (
    <div className={`gcard ${g.balance <= 0 || g.archived || (exp != null && exp < 0) ? 'dim' : ''}`} style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}>
      <div className="wm">{logo ? <BrandLogo name={g.brand} height={120} /> : <span className="wordmark wm-text">{g.brand}</span>}</div>
      <div className="head">
        <span className="logo-badge" style={logo ? undefined : { background: accent, borderColor: 'transparent', color: inkOn(accent) }}>
          {logo ? <BrandLogo name={g.brand} height={20} /> : <b style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-.03em' }}>{g.brand.slice(0, 1).toUpperCase()}</b>}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="brand">{g.brand}</div>
          <div className="exp">
            {exp == null ? 'No expiry' : exp < 0 ? 'Expired' : exp <= 30 ? `Expires in ${exp}d` : `Valid till ${parseISO(g.expiry).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
          </div>
        </div>
      </div>
      <div>
        <div className="bal-l">Balance</div>
        <div className="bal num">{money(g.balance, currency, { hide })}</div>
        <div className="of">of {money(g.value, currency, { hide })}</div>
        <div className="pbar"><div style={{ width: `${pct}%`, background: accent }} /></div>
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
  const fmt = (n: number) => money(n, settings.currency, { hide: settings.hideAmounts });
  const current = detail ? giftCards.find((g) => g.id === detail) : undefined;

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <h1>Gift Cards</h1>
          <div className="sub">Encrypted vault for vouchers & gift cards</div>
        </div>
        <button className="icon-btn" style={{ color: 'var(--accent)' }} onClick={() => setForm({ open: true })} aria-label="Add gift card"><IPlus /></button>
      </header>

      <div className="stack-lg">
        <section className="glass hero">
          <span className="label">Available balance</span>
          <div className="big num">{fmt(total)}</div>
          <div className="small muted">{active.length} active card{active.length === 1 ? '' : 's'}</div>
        </section>

        <div className="chips">
          {(['active', 'used', 'archived'] as Filter[]).map((f) => (
            <button key={f} className={`filter-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'active' ? 'Active' : f === 'used' ? 'Used up' : 'Archived'}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <Empty icon="🎁" title={filter === 'active' ? 'No gift cards yet' : 'Nothing here'} text="Store Amazon, Flipkart, Myntra and other gift cards. Use them when logging spends." action={filter === 'active' ? <button className="btn primary" onClick={() => setForm({ open: true })}><IPlus /> Add gift card</button> : undefined} />
        ) : (
          <div className="gift-grid">
            {list.map((g) => (
              <button key={g.id} style={{ textAlign: 'left' }} onClick={() => setDetail(g.id)}>
                <GiftVisual g={g} currency={settings.currency} hide={settings.hideAmounts} />
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
  const [shown, setShown] = useState(false);
  const [del, setDel] = useState(false);
  const cur = data.settings.currency;
  const uses = data.transactions.filter((t) => t.giftCards.some((u) => u.giftCardId === g.id));

  const reveal = async () => {
    if (shown) return setShown(false);
    if (await verify()) setShown(true);
  };
  const copy = async (v: string, label: string) => {
    if (await verify()) copyText(v, label);
  };

  return (
    <Sheet open onClose={onClose} title={`${g.brand} gift card`} actions={<button className="icon-btn sm" onClick={onEdit} aria-label="Edit"><IEdit width={16} /></button>}>
      <div className="stack-lg">
        <GiftVisual g={g} currency={cur} hide={false} />
        <div className="stack" style={{ gap: 8 }}>
          <div className="secret-row">
            <div className="grow"><div className="tiny muted">Card number / code</div><div className="v">{shown ? g.code || '—' : '•••• •••• ' + (g.code.slice(-4) || '')}</div></div>
            <button className="icon-btn sm" onClick={() => copy(g.code, 'Code copied')} aria-label="Copy code"><ICopy width={16} /></button>
          </div>
          {g.pin && (
            <div className="secret-row">
              <div className="grow"><div className="tiny muted">PIN</div><div className="v">{shown ? g.pin : '••••••'}</div></div>
              <button className="icon-btn sm" onClick={() => copy(g.pin, 'PIN copied')} aria-label="Copy PIN"><ICopy width={16} /></button>
            </div>
          )}
          <button className="btn glassy block" onClick={reveal}><IEye width={18} /> {shown ? 'Hide details' : 'Reveal code & PIN'}</button>
        </div>
        <div className="kv">
          <div><div className="k">Balance</div><div className="v">{money(g.balance, cur)}</div></div>
          <div><div className="k">Face value</div><div className="v">{money(g.value, cur)}</div></div>
          <div><div className="k">Used</div><div className="v">{money(Math.max(0, g.value - g.balance), cur)}</div></div>
          <div><div className="k">Expiry</div><div className="v">{g.expiry ? parseISO(g.expiry).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'None'}</div></div>
        </div>
        {g.notes && <p className="small muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{g.notes}</p>}

        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>Usage history</div>
          {uses.length ? (
            <div className="glass list">
              {uses.map((t) => (
                <button key={t.id} className="list-item" onClick={() => { onClose(); nav.editSpend(t); }}>
                  <span className="grow"><div className="t ellipsis">{t.description || t.category}</div><div className="d">{prettyDate(t.date)}</div></span>
                  <span className="amt num">−{money(t.giftCards.filter((u) => u.giftCardId === g.id).reduce((a, u) => a + u.amount, 0), cur)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="small faint">Not used in any spend yet.</div>
          )}
        </div>

        <button className="btn primary block" onClick={() => { onClose(); nav.newSpend({ giftCards: [{ giftCardId: g.id, amount: 0 }], payment: { type: 'giftcard' } }); }} disabled={g.balance <= 0}>
          <IPlus width={18} /> Spend with this card
        </button>
        <button className="btn glassy block" onClick={async () => { await saveGiftCard({ ...g, archived: !g.archived }); toast(g.archived ? 'Restored' : 'Archived'); onClose(); }}>
          {g.archived ? 'Unarchive' : 'Archive'}
        </button>
        {del ? (
          <div className="row"><button className="btn glassy grow" onClick={() => setDel(false)}>Cancel</button><button className="btn danger grow" onClick={async () => { await deleteGiftCard(g.id); toast('Gift card deleted'); onClose(); }}>Delete forever</button></div>
        ) : (
          <button className="btn ghost-danger block" onClick={() => setDel(true)}><ITrash width={18} /> Delete</button>
        )}
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

  const save = async () => {
    const name = brand === 'Other' ? custom.trim() : brand;
    const v = Number(value) || 0;
    const b = balance === '' ? v : Number(balance) || 0;
    if (!name) return setErr('Enter the brand name.');
    if (!(v > 0)) return setErr('Enter the gift card value.');
    if (b < 0) return setErr('Balance can’t be negative.');
    await saveGiftCard({ id: edit?.id, brand: name, code: code.trim(), pin: pin.trim(), value: round2(v), balance: round2(b), expiry, notes: notes.trim(), archived: edit?.archived ?? false });
    toast(edit ? 'Gift card updated' : 'Gift card added');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit gift card' : 'Add gift card'} actions={<button className="btn primary sm" onClick={save}>Save</button>}>
      <div className="stack-lg">
        <div className="field">
          <span className="field-label">Brand</span>
          <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
            {GIFT_BRANDS.map((b) => (
              <button key={b.name} type="button" className={`pick ${brand === b.name ? 'on' : ''}`} onClick={() => setBrand(b.name)}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})`, display: 'grid', placeItems: 'center' }}>
                  <BrandLogo name={b.name} height={16} fallback={false} />
                </span>
                {b.name}
              </button>
            ))}
          </div>
          {brand === 'Other' && <input className="input" placeholder="Brand name" value={custom} onChange={(e) => setCustom(e.target.value)} />}
        </div>
        <LogoPicker name={brand === 'Other' ? custom : brand} label="Brand logo" />
        <Field label="Card number / voucher code"><input className="input mono" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="PIN"><input className="input mono" autoComplete="off" spellCheck={false} value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
        <div className="grid2">
          <Field label={`Value (${data.settings.currency})`}><input className="input num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
          <Field label="Current balance" hint={edit ? 'Auto-adjusts with spends' : 'Defaults to value'}><input className="input num" inputMode="decimal" placeholder={value || '0'} value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        </div>
        <Field label="Expiry date"><input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        <Field label="Notes"><textarea className="textarea" placeholder="Where it came from, terms, etc." value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" onClick={save}>{edit ? 'Save changes' : 'Add gift card'}</button>
      </div>
    </Sheet>
  );
}
