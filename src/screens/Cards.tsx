import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import type { CardKind, CardNetwork, PaymentCard, Transaction } from '../lib/types';
import { FINISHES, cardFinishKey, finishFor, suggestFinish } from '../lib/finishes';
import { cardLength, daysUntil, detectNetwork, digits, groupCardNumber, last4, luhnValid, maskCardNumber, money, nextDayOfMonth, round2, todayISO } from '../lib/format';
import { Logo, fileToDataUrl, hasLogo } from '../lib/logos';
import { DeleteRow, Empty, FieldRow, Group, NavRow, Segmented, Sheet, copyText, toast, SaveBtn, EditBtn, CBtn } from '../components/ui';
import { useVerify } from '../components/Verify';
import { LogoPicker } from '../components/LogoPicker';
import { ICopy, IEye, IEyeOff, IPlus } from '../components/Icons';

const NETWORKS: CardNetwork[] = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners', 'Discover', 'Other'];

function ChipSvg() {
  return (
    <svg className="chip-svg" viewBox="0 0 50 38" aria-hidden="true">
      <defs>
        <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4e2a1" /><stop offset=".5" stopColor="#c9a24f" /><stop offset="1" stopColor="#efd48c" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="49" height="37" rx="6" fill="url(#chipg)" stroke="rgba(0,0,0,.2)" />
      <path d="M17 .5v11M33 .5v11M17 26.5v11M33 26.5v11M.5 13h16M33 13h16.5M.5 25h16M33 25h16.5M17 11.5h16v15H17z" fill="none" stroke="rgba(80,55,10,.4)" strokeWidth="1" />
    </svg>
  );
}

function Nfc() {
  return (
    <svg className="nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M7 8.5a5 5 0 0 1 0 7M10.5 6a9 9 0 0 1 0 12M14 3.5a13 13 0 0 1 0 17" />
    </svg>
  );
}

// Heights tuned to how each mark is printed on real cards.
const NET_H: Record<string, string> = { Visa: '5.6cqi', RuPay: '6cqi', Mastercard: '9.5cqi', Amex: '10cqi', Diners: '8cqi', Discover: '7cqi' };
function NetworkMark({ network, light }: { network: string; light: boolean }) {
  if (network === 'Other') return null;
  const style = { height: NET_H[network] ?? '7cqi', width: 'auto' };
  if (network === 'Mastercard') return <Logo name="mastercard" style={style} />;
  if (network === 'RuPay') return <Logo name="rupay" tone={light ? 'color' : 'white'} style={style} />;
  return <Logo name={network} tone={light ? 'dark' : 'white'} style={style} />;
}

/** Wallet-style card face. `reveal` shows the full number. */
export function CardVisual({ c, reveal }: { c: PaymentCard; reveal?: boolean }) {
  const { data } = useStore();
  const f = finishFor(cardFinishKey(c));
  const light = f.logo === 'dark';
  const bankLogo = hasLogo(c.bank, data.logos) ? <Logo name={c.bank} tone={light ? 'dark' : 'white'} /> : null;
  return (
    <div className="pcard-wrap">
      <div className="pcard" style={{ ['--ink' as string]: c.art ? '#fff' : f.ink }}>
        {c.art ? (
          <>
            <div className="bgl photo" style={{ backgroundImage: `url(${c.art})` }} />
            <div className="tex" style={{ background: reveal ? 'rgba(0,0,0,.55)' : 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,.55))' }} />
          </>
        ) : (
          <>
            <div className="bgl" style={{ background: f.bg }} />
            {f.texture && <div className={`tex ${f.texture}`} />}
            <div className="sheen" />
          </>
        )}
        <div className="edge" />
        <div className="face">
          {!c.art && (
            <div className="pc-top">
              <div className="pc-bank">{bankLogo ?? <span className="wordmark">{c.bank || 'Bank'}</span>}</div>
              <div className="pc-product">{c.name}</div>
            </div>
          )}
          {!c.art && (
            <div className="pc-chip"><ChipSvg /><Nfc /></div>
          )}
          {c.art && <div style={{ marginTop: 'auto' }} />}
          {reveal && <div className="pc-num">{groupCardNumber(c.number)}</div>}
          <div className="pc-bottom">
            <div style={{ minWidth: 0 }}>
              {reveal ? (
                <div className="row" style={{ gap: '5cqi' }}>
                  <div><div className="pc-sub">Valid thru</div><div className="pc-last4">{c.expiry || '—'}</div></div>
                  {c.cvv && <div><div className="pc-sub">CVV</div><div className="pc-last4">{c.cvv}</div></div>}
                </div>
              ) : (
                <div className="pc-last4">•••• {last4(c.number)}</div>
              )}
            </div>
            {!c.art && <div className="pc-net"><NetworkMark network={c.network} light={light} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Spend charged to this card since its last statement date (current billing cycle). */
function cycleSpend(c: PaymentCard, txns: Transaction[]) {
  let from: string;
  if (c.statementDay) {
    const t = new Date();
    const clamp = (y: number, m: number) => Math.min(c.statementDay!, new Date(y, m + 1, 0).getDate());
    let d = new Date(t.getFullYear(), t.getMonth(), clamp(t.getFullYear(), t.getMonth()));
    if (d > t) d = new Date(t.getFullYear(), t.getMonth() - 1, clamp(t.getFullYear(), t.getMonth() - 1));
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
      <div className="wash" style={{ ['--wash' as string]: '#c4eedb' }} />
      <header className="topbar">
        <h1>Cards</h1>
        <div className="actions">
          <CBtn variant="glass" size="lg" icon={<IPlus strokeWidth={2.4} />} label="Add card" onClick={() => setForm({ open: true })} />
        </div>
      </header>

      <div className="stack-lg">
        {credit.length > 0 && (
          <div className="card hero">
            <div className="row between">
              <span className="k">Total outstanding</span>
              {overdue > 0 && <span className="pill bad">{fmt(overdue)} overdue</span>}
            </div>
            <div className="big num">{fmt(outstanding)}</div>
            <div className="foot muted" style={{ marginBottom: 12 }}>{fmt(cycle)} unbilled · {fmt(limit)} total limit</div>
            {limit > 0 && (
              <>
                <div className="bar"><div style={{ width: `${Math.min(100, util)}%`, background: util > 30 ? 'var(--orange)' : 'var(--green)' }} /></div>
                <div className="foot muted" style={{ marginTop: 6 }}>{util.toFixed(0)}% credit utilisation</div>
              </>
            )}
          </div>
        )}

        {cards.length > 0 && (
          <Segmented full value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'credit', label: 'Credit' }, { value: 'debit', label: 'Debit' }]} />
        )}

        {list.length === 0 ? (
          <Empty icon="💳" title="No cards yet" text="Add your credit and debit cards to track dues and choose them when logging spends." action={<button className="btn primary" onClick={() => setForm({ open: true })}>Add card</button>} />
        ) : (
          <div className="wallet">
            {list.map((c) => {
              const due = c.kind === 'credit' && c.dueDay ? nextDayOfMonth(c.dueDay) : null;
              const days = due ? daysUntil(due) : null;
              const owed = (c.totalDue ?? 0) + (c.overdue ?? 0);
              return (
                <button key={c.id} style={{ textAlign: 'left' }} onClick={() => setDetail(c.id)} aria-label={`${c.bank} ${c.name} ending ${last4(c.number)}`}>
                  <CardVisual c={c} />
                  <div className="card-meta">
                    <span className="ellipsis muted">{c.name || c.bank} · {c.kind === 'credit' ? 'Credit' : 'Debit'}</span>
                    {c.kind === 'credit' && owed > 0 && due ? (
                      <span className={(c.overdue ?? 0) > 0 || days! <= 3 ? 'bad' : days! <= 7 ? 'warn' : ''} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmt(owed)} · {(c.overdue ?? 0) > 0 ? 'overdue' : days === 0 ? 'due today' : `due in ${days}d`}
                      </span>
                    ) : c.kind === 'credit' ? <span className="muted">No dues</span> : null}
                  </div>
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
  const [show, setShow] = useState<{ number?: boolean; cvv?: boolean }>({});
  const [dues, setDues] = useState(false);
  const cur = data.settings.currency;
  const m = (n?: number) => (n == null ? '—' : money(n, cur));
  const due = c.dueDay ? nextDayOfMonth(c.dueDay) : null;
  const avail = c.creditLimit ? c.creditLimit - (c.totalDue ?? 0) - (c.overdue ?? 0) - cycle : undefined;
  const txCount = data.transactions.filter((t) => t.payment.cardId === c.id).length;

  const toggle = async (k: 'number' | 'cvv') => {
    if (show[k]) return setShow((s) => ({ ...s, [k]: false }));
    if (await verify()) setShow((s) => ({ ...s, [k]: true }));
  };
  const copy = async (v: string, label: string) => {
    if (await verify()) copyText(v, label);
  };
  const SecretRow = ({ label, value, masked, k, copyVal }: { label: string; value: string; masked: string; k: 'number' | 'cvv'; copyVal: string }) => (
    <div className="cell">
      <span className="grow">
        <div className="st" style={{ marginTop: 0 }}>{label}</div>
        <div className="mono" style={{ fontSize: 17, marginTop: 2 }}>{show[k] ? value : masked}</div>
      </span>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={() => toggle(k)} aria-label={show[k] ? `Hide ${label}` : `Show ${label}`}>
        {show[k] ? <IEyeOff width={18} /> : <IEye width={18} />}
      </button>
      <button className="glass-btn" style={{ width: 36, height: 36, background: 'var(--fill)', color: 'var(--tint)' }} onClick={() => copy(copyVal, `${label} copied`)} aria-label={`Copy ${label}`}>
        <ICopy width={18} />
      </button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={c.name || c.bank} actions={<EditBtn onClick={onEdit} />}>
      <div className="stack-lg">
        <CardVisual c={c} reveal={!!show.number} />

        <Group header="Card details">
          <SecretRow label="Card number" k="number" value={groupCardNumber(c.number)} masked={maskCardNumber(c.number)} copyVal={digits(c.number)} />
          {c.cvv && <SecretRow label="CVV" k="cvv" value={c.cvv} masked="•••" copyVal={c.cvv} />}
          <NavRow title="Expiry" value={c.expiry || '—'} />
          <NavRow title="Name on card" value={c.holder || '—'} />
          <NavRow title="Type" value={`${c.kind === 'credit' ? 'Credit' : 'Debit'} · ${c.network}`} />
        </Group>

        {c.kind === 'credit' && (
          <Group header="Billing" footer={c.lastPaid ? `Last marked paid on ${new Date(c.lastPaid).toLocaleDateString()}` : undefined}>
            <NavRow title="Total due" value={<b style={{ color: 'var(--label)' }}>{m(c.totalDue)}</b>} />
            <NavRow title="Minimum due" value={m(c.minDue)} />
            <NavRow title="Overdue" value={<span className={(c.overdue ?? 0) > 0 ? 'bad' : ''}>{m(c.overdue ?? 0)}</span>} />
            <NavRow title="Due date" value={due ? `${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · in ${daysUntil(due)}d` : '—'} />
            <NavRow title="Unbilled this cycle" value={m(cycle)} />
            <NavRow title="Available limit" value={avail == null ? '—' : m(avail)} />
            <NavRow title="Credit limit" value={m(c.creditLimit)} />
            <NavRow title="Statement day" value={c.statementDay ? `${c.statementDay} of month` : '—'} />
          </Group>
        )}

        {c.kind === 'credit' && (
          <div className="group">
            <button className="cell tint" onClick={() => setDues(true)}>Update dues</button>
            <button className="cell tint" disabled={!((c.totalDue ?? 0) + (c.overdue ?? 0))} style={{ opacity: (c.totalDue ?? 0) + (c.overdue ?? 0) ? 1 : 0.4 }} onClick={async () => { await saveCard({ ...c, totalDue: 0, minDue: 0, overdue: 0, lastPaid: todayISO() }); toast('Marked as paid'); }}>Mark as paid</button>
          </div>
        )}

        {c.notes && <Group header="Notes"><div className="cell" style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div></Group>}
        <div className="group-f" style={{ marginTop: -12 }}>{txCount} spend{txCount === 1 ? '' : 's'} logged on this card</div>
        <DeleteRow label="Delete card" onConfirm={async () => { await deleteCard(c.id); toast('Card deleted'); onClose(); }} />
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
  const save = async () => { await saveCard({ ...c, totalDue: n(total), minDue: n(min), overdue: n(over) }); toast('Dues updated'); onClose(); };
  return (
    <Sheet open onClose={onClose} title="Update dues" actions={<SaveBtn onClick={save} />}>
      <Group footer="Overdue is anything unpaid from previous statements.">
        <FieldRow label="Total due"><input inputMode="decimal" placeholder="0" value={total} onChange={(e) => setTotal(clean(e.target.value))} /></FieldRow>
        <FieldRow label="Minimum due"><input inputMode="decimal" placeholder="0" value={min} onChange={(e) => setMin(clean(e.target.value))} /></FieldRow>
        <FieldRow label="Overdue"><input inputMode="decimal" placeholder="0" value={over} onChange={(e) => setOver(clean(e.target.value))} /></FieldRow>
      </Group>
    </Sheet>
  );
}

function CardForm({ edit, onClose }: { edit?: PaymentCard; onClose: () => void }) {
  const { saveCard } = useStore();
  const artRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<CardKind>(edit?.kind ?? 'credit');
  const [bank, setBank] = useState(edit?.bank ?? '');
  const [name, setName] = useState(edit?.name ?? '');
  const [number, setNumber] = useState(edit ? groupCardNumber(edit.number) : '');
  const [network, setNetwork] = useState<CardNetwork>(edit?.network ?? 'Visa');
  const [holder, setHolder] = useState(edit?.holder ?? '');
  const [expiry, setExpiry] = useState(edit?.expiry ?? '');
  const [cvv, setCvv] = useState(edit?.cvv ?? '');
  const [theme, setTheme] = useState(edit ? cardFinishKey(edit) : 'midnight');
  const [themeTouched, setThemeTouched] = useState(!!edit);
  const [art, setArt] = useState(edit?.art ?? '');
  const [limit, setLimit] = useState(edit?.creditLimit ? String(edit.creditLimit) : '');
  const [stmt, setStmt] = useState(edit?.statementDay ? String(edit.statementDay) : '');
  const [dueDay, setDueDay] = useState(edit?.dueDay ? String(edit.dueDay) : '');
  const [totalDue, setTotalDue] = useState(edit?.totalDue ? String(edit.totalDue) : '');
  const [minDue, setMinDue] = useState(edit?.minDue ? String(edit.minDue) : '');
  const [overdue, setOverdue] = useState(edit?.overdue ? String(edit.overdue) : '');
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [err, setErr] = useState('');

  const d = digits(number);
  const luhnWarn = d.length >= cardLength(d) && !luhnValid(d);

  const autoFinish = (b: string, n: string) => {
    if (themeTouched) return;
    const s = suggestFinish(b, n);
    if (s) setTheme(s);
  };
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
    setErr('');
    if (!bank.trim()) return setErr('Enter the bank or issuer name.');
    if (d.length < 4) return setErr('Enter at least the last 4 digits of the card number.');
    if (expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return setErr('Expiry should be MM/YY.');
    await saveCard({
      id: edit?.id,
      kind, bank: bank.trim(), name: name.trim(), network, number: d, holder: holder.trim().toUpperCase(), expiry, cvv, theme, finishChosen: true, art: art || undefined,
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

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit Card' : 'New Card'} actions={<SaveBtn onClick={save} />}>
      <form className="stack-lg" autoComplete="off" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Segmented full value={kind} onChange={setKind} options={[{ value: 'credit', label: 'Credit' }, { value: 'debit', label: 'Debit' }]} />

        <Group>
          <FieldRow label="Bank"><input placeholder="HDFC Bank" value={bank} onChange={(e) => { setBank(e.target.value); autoFinish(e.target.value, name); }} /></FieldRow>
          <FieldRow label="Card name"><input placeholder="Infinia" value={name} onChange={(e) => { setName(e.target.value); autoFinish(bank, e.target.value); }} /></FieldRow>
          <FieldRow label="Network">
            <select value={network} onChange={(e) => setNetwork(e.target.value as CardNetwork)}>
              {NETWORKS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </FieldRow>
        </Group>

        <Group footer={luhnWarn ? <span className="bad">This number fails the checksum — please double-check it.</span> : 'Stored encrypted on this device. Only the last 4 digits show until you verify.'}>
          <FieldRow label="Card number"><input className="mono" inputMode="numeric" placeholder="Required" value={number} onChange={(e) => onNumber(e.target.value)} /></FieldRow>
          <FieldRow label="Expiry"><input className="mono" inputMode="numeric" placeholder="MM/YY" value={expiry} onChange={(e) => onExpiry(e.target.value)} /></FieldRow>
          <FieldRow label="CVV"><input className="mono" type="password" inputMode="numeric" placeholder="Optional" maxLength={4} value={cvv} onChange={(e) => setCvv(digits(e.target.value).slice(0, 4))} /></FieldRow>
          <FieldRow label="Name on card"><input placeholder="Optional" value={holder} onChange={(e) => setHolder(e.target.value)} /></FieldRow>
        </Group>

        <Group header="Appearance" footer={art ? 'Using your photo as the card face.' : 'Pick the finish closest to your card, or use a photo of it.'}>
          {!art && (
            <div className="cell" style={{ display: 'block' }}>
              <div className="swatches">
                {Object.entries(FINISHES).map(([k, f]) => (
                  <button type="button" key={k} title={f.name} aria-label={f.name} className={`swatch ${theme === k ? 'on' : ''}`} style={{ background: f.bg }} onClick={() => { setTheme(k); setThemeTouched(true); }} />
                ))}
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>{finishFor(theme).name}</div>
            </div>
          )}
          <NavRow title={art ? 'Change card photo' : 'Use a photo of my card'} onClick={() => artRef.current?.click()} />
          {art && <button type="button" className="cell danger" style={{ justifyContent: 'flex-start' }} onClick={() => setArt('')}>Remove photo</button>}
          <input ref={artRef} type="file" accept="image/*" className="hidden-input" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (f) { try { setArt(await fileToDataUrl(f, 1000, 'image/jpeg')); } catch { toast('Could not read that image'); } }
          }} />
          {bank.trim() && <LogoPicker name={bank} label="Bank logo" />}
        </Group>

        {kind === 'credit' && (
          <Group header="Billing">
            <FieldRow label="Credit limit"><input inputMode="decimal" placeholder="Optional" value={limit} onChange={(e) => setLimit(clean(e.target.value))} /></FieldRow>
            <FieldRow label="Statement day"><input inputMode="numeric" placeholder="1–31" value={stmt} onChange={(e) => setStmt(digits(e.target.value).slice(0, 2))} /></FieldRow>
            <FieldRow label="Due day"><input inputMode="numeric" placeholder="1–31" value={dueDay} onChange={(e) => setDueDay(digits(e.target.value).slice(0, 2))} /></FieldRow>
            <FieldRow label="Total due"><input inputMode="decimal" placeholder="0" value={totalDue} onChange={(e) => setTotalDue(clean(e.target.value))} /></FieldRow>
            <FieldRow label="Minimum due"><input inputMode="decimal" placeholder="0" value={minDue} onChange={(e) => setMinDue(clean(e.target.value))} /></FieldRow>
            <FieldRow label="Overdue"><input inputMode="decimal" placeholder="0" value={overdue} onChange={(e) => setOverdue(clean(e.target.value))} /></FieldRow>
          </Group>
        )}

        <Group header="Notes">
          <div className="cell"><textarea placeholder="Reward rate, fee waiver target…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </Group>
        {err && <div className="group-f bad" style={{ marginTop: -10 }}>{err}</div>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

