import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { CardKind, CardNetwork, PaymentCard } from '../lib/types';
import { CARD_THEMES } from '../lib/categories';
import { cardLength, daysUntil, detectNetwork, digits, groupCardNumber, last4, luhnValid, maskCardNumber, money, nextDayOfMonth, previewCardNumber, round2, todayISO } from '../lib/format';
import { BrandLogo, NetworkLogo, hasBuiltInLogo } from '../lib/logos';
import { LogoPicker } from '../components/LogoPicker';
import { Empty, Field, Segmented, Sheet, copyText, toast } from '../components/ui';
import { useVerify } from '../components/Verify';
import { IAlert, ICheck, ICopy, IEdit, IEye, IPlus, ITrash } from '../components/Icons';

const NETWORKS: CardNetwork[] = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners', 'Discover', 'Other'];

function ChipSvg() {
  return (
    <svg className="chip-svg" viewBox="0 0 50 38" aria-hidden="true">
      <defs>
        <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e7a1" /><stop offset=".45" stopColor="#d4ae4f" /><stop offset="1" stopColor="#f1d68a" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="49" height="37" rx="7" fill="url(#chipg)" stroke="rgba(0,0,0,.25)" />
      <path d="M17 .5v11M33 .5v11M17 26.5v11M33 26.5v11M.5 13h16M33 13h16.5M.5 25h16M33 25h16.5M17 11.5h16v15H17z" fill="none" stroke="rgba(90,60,10,.45)" strokeWidth="1.1" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg className="nfc" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a9 9 0 0 1 0 12M15 3.5a13 13 0 0 1 0 17" />
    </svg>
  );
}

export function CardVisual({ c, reveal, preview }: { c: PaymentCard; reveal?: boolean; preview?: boolean }) {
  const [a, b] = CARD_THEMES[c.theme] ?? CARD_THEMES.midnight;
  const builtIn = hasBuiltInLogo(c.bank);
  const num = preview ? previewCardNumber(c.number) : reveal ? groupCardNumber(c.number) : maskCardNumber(c.number);
  return (
    <div className="pcard" style={{ ['--c1' as string]: a, ['--c2' as string]: b }}>
      <div className="pc-top">
        <div className="pc-bank">
          {(builtIn || c.bank) && <BrandLogo name={c.bank} height={26} fallback={false} />}
          <div style={{ minWidth: 0 }}>
            <div className="bn">{c.bank || 'Bank name'}</div>
            {c.name && <div className="pn">{c.name}</div>}
          </div>
        </div>
        <span className="pc-kind">{c.kind === 'credit' ? 'Credit' : 'Debit'}</span>
      </div>
      <div className="pc-mid"><ChipSvg /><Contactless /></div>
      <div className="pc-num">{num}</div>
      <div className="pc-bottom">
        <div className="f"><label>Card holder</label><b>{c.holder || '—'}</b></div>
        <div className="f" style={{ flex: 'none' }}><label>Valid thru</label><b>{c.expiry || 'MM/YY'}</b></div>
        {reveal && c.cvv && <div className="f" style={{ flex: 'none' }}><label>CVV</label><b>{c.cvv}</b></div>}
        <div className="net"><NetworkLogo network={c.network} height={28} /></div>
      </div>
    </div>
  );
}

/** Spend charged to this card since its last statement date (current billing cycle). */
function cycleSpend(c: PaymentCard, txns: ReturnType<typeof useStore>['data']['transactions']) {
  let from = '';
  if (c.statementDay) {
    const t = new Date();
    let d = new Date(t.getFullYear(), t.getMonth(), Math.min(c.statementDay, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
    if (d > t) d = new Date(t.getFullYear(), t.getMonth() - 1, Math.min(c.statementDay, new Date(t.getFullYear(), t.getMonth(), 0).getDate()));
    d.setDate(d.getDate() + 1);
    from = todayISO(d);
  } else {
    from = todayISO().slice(0, 8) + '01';
  }
  return txns
    .filter((x) => x.payment.type === 'card' && x.payment.cardId === c.id && x.date >= from)
    .reduce((a, x) => a + x.amount - x.giftCards.reduce((s, g) => s + g.amount, 0), 0);
}

export function Cards() {
  const { data } = useStore();
  const { cards, settings, transactions } = data;
  const [kind, setKind] = useState<'all' | CardKind>('all');
  const [form, setForm] = useState<{ open: boolean; edit?: PaymentCard }>({ open: false });
  const [detail, setDetail] = useState<string | null>(null);
  const fmt = (n: number) => money(n, settings.currency, { hide: settings.hideAmounts, decimals: false });

  const list = cards.filter((c) => kind === 'all' || c.kind === kind);
  const credit = cards.filter((c) => c.kind === 'credit');
  const outstanding = credit.reduce((a, c) => a + (c.totalDue ?? 0) + (c.overdue ?? 0), 0);
  const overdue = credit.reduce((a, c) => a + (c.overdue ?? 0), 0);
  const limit = credit.reduce((a, c) => a + (c.creditLimit ?? 0), 0);
  const cycle = useMemo(() => credit.reduce((a, c) => a + cycleSpend(c, transactions), 0), [credit, transactions]);
  const util = limit > 0 ? ((outstanding + cycle) / limit) * 100 : 0;
  const current = detail ? cards.find((c) => c.id === detail) : undefined;

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <h1>Cards</h1>
          <div className="sub">Encrypted · reveal requires verification</div>
        </div>
        <button className="icon-btn" style={{ color: 'var(--accent)' }} onClick={() => setForm({ open: true })} aria-label="Add card"><IPlus /></button>
      </header>

      <div className="stack-lg">
        {credit.length > 0 && (
          <section className="glass hero">
            <div className="row between">
              <span className="label">Total outstanding</span>
              {overdue > 0 && <span className="chip bad"><IAlert width={12} height={12} /> {fmt(overdue)} overdue</span>}
            </div>
            <div className="big num">{fmt(outstanding)}</div>
            <div className="small muted">+ {fmt(cycle)} unbilled this cycle · limit {fmt(limit)}</div>
            {limit > 0 && (
              <>
                <div className={`budget-bar ${util > 30 ? 'over' : ''}`}><div style={{ width: `${Math.min(100, util)}%` }} /></div>
                <div className="tiny muted" style={{ marginTop: 6 }}>{util.toFixed(0)}% utilisation {util > 30 ? '· above the 30% guideline' : ''}</div>
              </>
            )}
          </section>
        )}

        {cards.length > 0 && (
          <Segmented full value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'credit', label: 'Credit' }, { value: 'debit', label: 'Debit' }]} />
        )}

        {list.length === 0 ? (
          <Empty icon="💳" title="No cards yet" text="Add credit and debit cards to track dues and pick them while logging spends. Everything is encrypted on-device." action={<button className="btn primary" onClick={() => setForm({ open: true })}><IPlus /> Add card</button>} />
        ) : (
          <div className="pcard-stack">
            {list.map((c) => {
              const due = c.kind === 'credit' && c.dueDay ? nextDayOfMonth(c.dueDay) : null;
              const days = due ? daysUntil(due) : null;
              const owed = (c.totalDue ?? 0) + (c.overdue ?? 0);
              return (
                <button key={c.id} style={{ textAlign: 'left' }} onClick={() => setDetail(c.id)}>
                  <CardVisual c={c} />
                  {c.kind === 'credit' && (
                    <div className="row between small" style={{ padding: '10px 6px 0' }}>
                      <span className="muted">{owed > 0 ? <>Due <b style={{ color: 'var(--text)' }}>{fmt(owed)}</b></> : 'No dues'}</span>
                      {due && owed > 0 && <span className={days! <= 3 ? 'bad' : days! <= 7 ? 'warn' : 'muted'}>{(c.overdue ?? 0) > 0 ? 'Overdue · ' : ''}{due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ({days === 0 ? 'today' : `${days}d`})</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {form.open && <CardForm edit={form.edit} onClose={() => setForm({ open: false })} />}
      {current && <CardDetail c={current} cycle={cycleSpend(current, transactions)} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); setForm({ open: true, edit: current }); }} />}
    </div>
  );
}

function CardDetail({ c, cycle, onClose, onEdit }: { c: PaymentCard; cycle: number; onClose: () => void; onEdit: () => void }) {
  const { data, saveCard, deleteCard } = useStore();
  const { verify, element } = useVerify();
  const [reveal, setReveal] = useState(false);
  const [del, setDel] = useState(false);
  const [dues, setDues] = useState(false);
  const cur = data.settings.currency;
  const m = (n?: number) => (n == null ? '—' : money(n, cur));
  const due = c.dueDay ? nextDayOfMonth(c.dueDay) : null;
  const avail = c.creditLimit ? c.creditLimit - (c.totalDue ?? 0) - (c.overdue ?? 0) - cycle : undefined;
  const txCount = data.transactions.filter((t) => t.payment.cardId === c.id).length;

  return (
    <Sheet open onClose={onClose} title={`${c.bank} ${c.name}`} actions={<button className="icon-btn sm" onClick={onEdit} aria-label="Edit"><IEdit width={16} /></button>}>
      <div className="stack-lg">
        <CardVisual c={c} reveal={reveal} />
        <div className="row">
          <button className="btn glassy grow" onClick={async () => (reveal ? setReveal(false) : (await verify()) && setReveal(true))}><IEye width={18} /> {reveal ? 'Hide' : 'Reveal'}</button>
          <button className="btn glassy grow" onClick={async () => (await verify()) && copyText(digits(c.number), 'Card number copied')}><ICopy width={18} /> Number</button>
          {c.cvv && <button className="btn glassy" onClick={async () => (await verify()) && copyText(c.cvv, 'CVV copied')}>CVV</button>}
        </div>

        {c.kind === 'credit' && (
          <>
            <div className="kv">
              <div><div className="k">Total due</div><div className="v">{m(c.totalDue)}</div></div>
              <div><div className="k">Minimum due</div><div className="v">{m(c.minDue)}</div></div>
              <div><div className="k">Overdue</div><div className={`v ${(c.overdue ?? 0) > 0 ? 'bad' : ''}`}>{m(c.overdue ?? 0)}</div></div>
              <div><div className="k">Due date</div><div className="v">{due ? `${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${daysUntil(due)}d` : '—'}</div></div>
              <div><div className="k">Unbilled (this cycle)</div><div className="v">{m(cycle)}</div></div>
              <div><div className="k">Available limit</div><div className="v">{avail == null ? '—' : m(avail)}</div></div>
              <div><div className="k">Credit limit</div><div className="v">{m(c.creditLimit)}</div></div>
              <div><div className="k">Statement day</div><div className="v">{c.statementDay ? `${c.statementDay} of month` : '—'}</div></div>
            </div>
            {c.lastPaid && <div className="tiny faint">Last marked paid on {new Date(c.lastPaid).toLocaleDateString()}</div>}
            <div className="row">
              <button className="btn glassy grow" onClick={() => setDues(true)}>Update dues</button>
              <button className="btn primary grow" disabled={!((c.totalDue ?? 0) + (c.overdue ?? 0))} onClick={async () => { await saveCard({ ...c, totalDue: 0, minDue: 0, overdue: 0, lastPaid: todayISO() }); toast('Marked as paid'); }}>
                <ICheck width={18} /> Mark paid
              </button>
            </div>
          </>
        )}
        {c.notes && <p className="small muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.notes}</p>}
        <div className="tiny faint">{txCount} spend{txCount === 1 ? '' : 's'} logged on this card</div>

        {del ? (
          <div className="row"><button className="btn glassy grow" onClick={() => setDel(false)}>Cancel</button><button className="btn danger grow" onClick={async () => { await deleteCard(c.id); toast('Card deleted'); onClose(); }}>Delete card</button></div>
        ) : (
          <button className="btn ghost-danger block" onClick={() => setDel(true)}><ITrash width={18} /> Delete card</button>
        )}
      </div>
      {dues && <DuesSheet c={c} onClose={() => setDues(false)} />}
      {element}
    </Sheet>
  );
}

function DuesSheet({ c, onClose }: { c: PaymentCard; onClose: () => void }) {
  const { saveCard } = useStore();
  const [total, setTotal] = useState(c.totalDue ? String(c.totalDue) : '');
  const [min, setMin] = useState(c.minDue ? String(c.minDue) : '');
  const [over, setOver] = useState(c.overdue ? String(c.overdue) : '');
  const n = (s: string) => (s === '' ? 0 : round2(Number(s) || 0));
  const clean = (s: string) => s.replace(/[^\d.]/g, '');
  return (
    <Sheet open onClose={onClose} title="Update dues">
      <div className="stack-lg">
        <Field label="Total amount due (statement)"><input className="input num" inputMode="decimal" value={total} onChange={(e) => setTotal(clean(e.target.value))} /></Field>
        <Field label="Minimum due"><input className="input num" inputMode="decimal" value={min} onChange={(e) => setMin(clean(e.target.value))} /></Field>
        <Field label="Overdue amount" hint="Anything unpaid from previous statements"><input className="input num" inputMode="decimal" value={over} onChange={(e) => setOver(clean(e.target.value))} /></Field>
        <button className="btn primary block" onClick={async () => { await saveCard({ ...c, totalDue: n(total), minDue: n(min), overdue: n(over) }); toast('Dues updated'); onClose(); }}>Save</button>
      </div>
    </Sheet>
  );
}

function CardForm({ edit, onClose }: { edit?: PaymentCard; onClose: () => void }) {
  const { saveCard } = useStore();
  const [kind, setKind] = useState<CardKind>(edit?.kind ?? 'credit');
  const [bank, setBank] = useState(edit?.bank ?? '');
  const [name, setName] = useState(edit?.name ?? '');
  const [number, setNumber] = useState(edit ? groupCardNumber(edit.number) : '');
  const [network, setNetwork] = useState<CardNetwork>(edit?.network ?? 'Visa');
  const [holder, setHolder] = useState(edit?.holder ?? '');
  const [expiry, setExpiry] = useState(edit?.expiry ?? '');
  const [cvv, setCvv] = useState(edit?.cvv ?? '');
  const [theme, setTheme] = useState(edit?.theme ?? 'aurora');
  const [limit, setLimit] = useState(edit?.creditLimit ? String(edit.creditLimit) : '');
  const [stmt, setStmt] = useState(edit?.statementDay ? String(edit.statementDay) : '');
  const [dueDay, setDueDay] = useState(edit?.dueDay ? String(edit.dueDay) : '');
  const [totalDue, setTotalDue] = useState(edit?.totalDue ? String(edit.totalDue) : '');
  const [minDue, setMinDue] = useState(edit?.minDue ? String(edit.minDue) : '');
  const [overdue, setOverdue] = useState(edit?.overdue ? String(edit.overdue) : '');
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [err, setErr] = useState('');

  const d = digits(number);
  // Only judge the checksum once the number is complete, so the form doesn't jump while typing.
  const complete = d.length >= cardLength(d);
  const luhnWarn = complete && !luhnValid(d);

  const onNumber = (v: string) => {
    const dd = digits(v).slice(0, 19);
    setNumber(groupCardNumber(dd));
    const net = detectNetwork(dd);
    if (net) setNetwork(net as CardNetwork);
  };
  const onExpiry = (v: string) => {
    const dd = digits(v).slice(0, 4);
    setExpiry(dd.length > 2 ? `${dd.slice(0, 2)}/${dd.slice(2)}` : dd);
  };
  const day = (s: string) => {
    const n = Number(s);
    return n >= 1 && n <= 31 ? n : undefined;
  };
  const num = (s: string) => (s === '' ? undefined : round2(Number(s) || 0));
  const clean = (s: string) => s.replace(/[^\d.]/g, '');

  const save = async () => {
    if (!bank.trim()) return setErr('Enter the bank / issuer name.');
    if (d.length < 4) return setErr('Enter at least the last 4 digits of the card number.');
    if (expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return setErr('Expiry should be MM/YY.');
    await saveCard({
      id: edit?.id,
      kind, bank: bank.trim(), name: name.trim(), network, number: d, holder: holder.trim().toUpperCase(), expiry, cvv, theme,
      creditLimit: kind === 'credit' ? num(limit) : undefined,
      statementDay: kind === 'credit' ? day(stmt) : undefined,
      dueDay: kind === 'credit' ? day(dueDay) : undefined,
      totalDue: kind === 'credit' ? num(totalDue) : undefined,
      minDue: kind === 'credit' ? num(minDue) : undefined,
      overdue: kind === 'credit' ? num(overdue) : undefined,
      lastPaid: edit?.lastPaid,
      notes: notes.trim(),
    });
    toast(edit ? 'Card updated' : 'Card added');
    onClose();
  };

  const preview: PaymentCard = { id: '', kind, bank, name, network, number: d, holder: holder.toUpperCase(), expiry, cvv: '', theme, notes: '', createdAt: 0, updatedAt: 0 };

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit card' : 'Add card'} actions={<button className="btn primary sm" onClick={save}>Save</button>}>
      <form className="stack-lg" autoComplete="off" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <CardVisual c={preview} preview />
        <Segmented full value={kind} onChange={setKind} options={[{ value: 'credit', label: 'Credit card' }, { value: 'debit', label: 'Debit card' }]} />
        <div className="grid2">
          <Field label="Bank / issuer"><input className="input" placeholder="HDFC Bank" value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <Field label="Card name"><input className="input" placeholder="Regalia Gold" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <LogoPicker name={bank} label="Bank logo" />
        <Field label="Card number" error={luhnWarn ? 'Checksum failed — please double-check the number.' : null} hint="Encrypted. Only the last 4 digits are shown by default.">
          <input className="input mono" inputMode="numeric" autoComplete="off" placeholder="1234 5678 9012 3456" value={number} onChange={(e) => onNumber(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Network">
            <select className="select" value={network} onChange={(e) => setNetwork(e.target.value as CardNetwork)}>
              {NETWORKS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Expiry (MM/YY)"><input className="input mono" inputMode="numeric" placeholder="08/29" value={expiry} onChange={(e) => onExpiry(e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label="Name on card"><input className="input" value={holder} onChange={(e) => setHolder(e.target.value)} /></Field>
          <Field label="CVV (optional)" hint="Storing CVV is optional"><input className="input mono" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={cvv} onChange={(e) => setCvv(digits(e.target.value).slice(0, 4))} /></Field>
        </div>
        <div className="field">
          <span className="field-label">Card colour</span>
          <div className="row wrap" style={{ gap: 10 }}>
            {Object.entries(CARD_THEMES).map(([k, [a, b]]) => (
              <button type="button" key={k} aria-label={k} onClick={() => setTheme(k)} style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: theme === k ? '0 0 0 3px var(--bg), 0 0 0 5px var(--accent)' : 'inset 0 1px 0 rgba(255,255,255,.4)' }} />
            ))}
          </div>
        </div>
        {kind === 'credit' && (
          <div className="glass tight stack">
            <div style={{ fontWeight: 650 }}>Billing</div>
            <div className="grid2">
              <Field label="Credit limit"><input className="input num" inputMode="decimal" value={limit} onChange={(e) => setLimit(clean(e.target.value))} /></Field>
              <Field label="Statement day"><input className="input num" inputMode="numeric" placeholder="1–31" value={stmt} onChange={(e) => setStmt(digits(e.target.value).slice(0, 2))} /></Field>
              <Field label="Payment due day"><input className="input num" inputMode="numeric" placeholder="1–31" value={dueDay} onChange={(e) => setDueDay(digits(e.target.value).slice(0, 2))} /></Field>
              <Field label="Total due"><input className="input num" inputMode="decimal" value={totalDue} onChange={(e) => setTotalDue(clean(e.target.value))} /></Field>
              <Field label="Minimum due"><input className="input num" inputMode="decimal" value={minDue} onChange={(e) => setMinDue(clean(e.target.value))} /></Field>
              <Field label="Overdue amount"><input className="input num" inputMode="decimal" value={overdue} onChange={(e) => setOverdue(clean(e.target.value))} /></Field>
            </div>
          </div>
        )}
        <Field label="Notes"><textarea className="textarea" placeholder="Reward rate, fee waiver target, etc." value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" type="submit">{edit ? 'Save changes' : 'Add card'}</button>
        <div className="tiny faint center">•{last4(number) || '····'} · encrypted with AES-256-GCM before it touches storage</div>
      </form>
    </Sheet>
  );
}
