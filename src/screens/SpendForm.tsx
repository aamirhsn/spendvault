import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { SpendDraft } from '../lib/nav';
import type { GiftCardUse, PaymentType, Transaction } from '../lib/types';
import { CATEGORIES, giftBrandColors } from '../lib/categories';
import { last4, money, round2, todayISO } from '../lib/format';
import { categoryForMcc, lookupMcc } from '../lib/mcc';
import { Field, Sheet, Toggle, toast } from '../components/ui';
import { ITrash } from '../components/Icons';
import { PAYMENT_LABELS } from '../components/TxnRow';

const METHODS: PaymentType[] = ['card', 'upi', 'cash', 'netbanking', 'wallet', 'giftcard', 'other'];

export function SpendForm({ draft, edit, onClose }: { draft?: SpendDraft; edit?: Transaction; onClose: () => void }) {
  const { data, saveTransaction, deleteTransaction } = useStore();
  const { cards, giftCards, merchants, settings } = data;
  const init = edit ?? draft ?? {};
  const [amount, setAmount] = useState(init.amount ? String(init.amount) : '');
  const [date, setDate] = useState(init.date ?? todayISO());
  const [description, setDescription] = useState(init.description ?? draft?.merchantName ?? '');
  const [category, setCategory] = useState(init.category ?? 'Shopping');
  const [ptype, setPtype] = useState<PaymentType>(init.payment?.type ?? (cards.length ? 'card' : 'upi'));
  const [cardId, setCardId] = useState(init.payment?.cardId ?? cards[0]?.id ?? '');
  const [merchantId, setMerchantId] = useState(init.merchantId ?? '');
  const [notes, setNotes] = useState(init.notes ?? '');
  const [useGift, setUseGift] = useState((init.giftCards?.length ?? 0) > 0);
  const [gifts, setGifts] = useState<Record<string, string>>(() =>
    Object.fromEntries((init.giftCards ?? []).map((g) => [g.giftCardId, String(g.amount)])),
  );
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // Balance available on each gift card for this transaction (includes what this txn already used when editing).
  const giftOptions = useMemo(() => {
    return giftCards
      .map((g) => {
        const prev = edit?.giftCards.find((u) => u.giftCardId === g.id)?.amount ?? 0;
        return { g, available: round2(g.balance + prev) };
      })
      .filter(({ g, available }) => (!g.archived && available > 0) || gifts[g.id]);
  }, [giftCards, edit, gifts]);

  const amt = Number(amount) || 0;
  const giftUses: GiftCardUse[] = useGift
    ? Object.entries(gifts).map(([giftCardId, v]) => ({ giftCardId, amount: round2(Number(v) || 0) })).filter((u) => u.amount > 0)
    : [];
  const giftSum = round2(giftUses.reduce((a, u) => a + u.amount, 0));
  const remainder = round2(amt - giftSum);

  const pickMerchant = (id: string) => {
    setMerchantId(id);
    const m = merchants.find((x) => x.id === id);
    if (!m) return;
    if (!description) setDescription(m.name);
    const c = m.mcc ? categoryForMcc(m.mcc) : undefined;
    if (c) setCategory(c);
  };

  const autoFill = (id: string) => {
    const opt = giftOptions.find((o) => o.g.id === id);
    if (!opt) return;
    const othersSum = giftUses.filter((u) => u.giftCardId !== id).reduce((a, u) => a + u.amount, 0);
    const v = Math.max(0, Math.min(opt.available, round2(amt - othersSum)));
    setGifts((s) => ({ ...s, [id]: v ? String(v) : '' }));
  };

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Enter an amount greater than zero.');
    if (!date) return setError('Pick a date.');
    if (ptype === 'card' && !cardId) return setError('Choose a card, or add one in the Cards tab.');
    for (const u of giftUses) {
      const opt = giftOptions.find((o) => o.g.id === u.giftCardId);
      if (!opt || u.amount > opt.available + 0.001) return setError(`Gift card amount exceeds its balance (${opt ? money(opt.available, settings.currency) : 'removed'}).`);
    }
    if (giftSum > amt + 0.001) return setError('Gift card total is more than the bill amount.');
    if (ptype === 'giftcard' && Math.abs(remainder) > 0.001) return setError('“Gift card only” needs gift cards to cover the full amount.');
    await saveTransaction({
      id: edit?.id,
      amount: round2(amt),
      date,
      description: description.trim(),
      category,
      payment: ptype === 'card' ? { type: 'card', cardId } : { type: ptype },
      giftCards: giftUses,
      merchantId: merchantId || undefined,
      notes: notes.trim(),
    });
    toast(edit ? 'Spend updated' : 'Spend saved');
    onClose();
  };

  const merchant = merchants.find((m) => m.id === merchantId);
  const mccInfo = merchant?.mcc ? lookupMcc(merchant.mcc) : null;

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit spend' : 'New spend'} actions={<button className="btn primary sm" onClick={save}>Save</button>}>
      <div className="stack-lg">
        <div className="field">
          <input className="input amount num" inputMode="decimal" placeholder={money(0, settings.currency)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Amount" autoFocus={!edit} />
        </div>

        <div className="grid2">
          <Field label="Date">
            <input className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Merchant (from scans)">
            <select className="select" value={merchantId} onChange={(e) => pickMerchant(e.target.value)}>
              <option value="">None</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.name || m.vpa}{m.mcc ? ` · ${m.mcc}` : ''}</option>)}
            </select>
          </Field>
        </div>
        {merchant && <div className="hint" style={{ marginTop: -10 }}>MCC {merchant.mcc || '—'}{mccInfo ? ` · ${mccInfo.desc}` : ''} · {merchant.vpa}</div>}

        <Field label="Description">
          <input className="input" placeholder="e.g. Weekly groceries" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
        </Field>

        <div className="field">
          <span className="field-label">Category</span>
          <div className="pick-grid">
            {CATEGORIES.map((c) => (
              <button key={c.name} className={`pick ${category === c.name ? 'on' : ''}`} onClick={() => setCategory(c.name)} type="button">
                <span className="e">{c.icon}</span>{c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Paid with</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {METHODS.map((m) => (
              <button key={m} type="button" className={`filter-chip ${ptype === m ? 'on' : ''}`} onClick={() => { setPtype(m); if (m === 'giftcard') setUseGift(true); }}>
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
          {ptype === 'card' && (
            cards.length ? (
              <select className="select" value={cardId} onChange={(e) => setCardId(e.target.value)} aria-label="Card used">
                {cards.map((c) => <option key={c.id} value={c.id}>{c.bank} {c.name} ({c.kind}) •{last4(c.number)}</option>)}
              </select>
            ) : (
              <div className="hint">No cards in your vault yet — add one from the Cards tab.</div>
            )
          )}
        </div>

        <div className="glass tight stack">
          <div className="row between">
            <div>
              <div style={{ fontWeight: 650 }}>🎁 Use gift cards</div>
              <div className="tiny muted">Balances are deducted automatically</div>
            </div>
            <Toggle on={useGift} onChange={setUseGift} label="Use gift cards" />
          </div>
          {useGift && (
            giftOptions.length === 0 ? (
              <div className="hint">No gift cards with balance. Add some in the Gift Cards tab.</div>
            ) : (
              <>
                {giftOptions.map(({ g, available }) => {
                  const [c1, c2] = giftBrandColors(g.brand);
                  return (
                    <div key={g.id} className="row">
                      <span style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${c1}, ${c2})`, flex: 'none', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>{g.brand.slice(0, 2)}</span>
                      <div className="grow">
                        <div className="small" style={{ fontWeight: 620 }}>{g.brand} <span className="faint">•{g.code.slice(-4)}</span></div>
                        <div className="tiny muted">Available {money(available, settings.currency)}</div>
                      </div>
                      <input className="input num" style={{ width: 110, height: 40, textAlign: 'right' }} inputMode="decimal" placeholder="0" value={gifts[g.id] ?? ''} onChange={(e) => setGifts((s) => ({ ...s, [g.id]: e.target.value.replace(/[^\d.]/g, '') }))} aria-label={`Amount from ${g.brand}`} />
                      <button type="button" className="btn glassy sm" style={{ padding: '0 10px' }} onClick={() => autoFill(g.id)}>Max</button>
                    </div>
                  );
                })}
                <div className="row between small" style={{ borderTop: '1px solid var(--hair)', paddingTop: 10 }}>
                  <span className="muted">Gift cards {money(giftSum, settings.currency)}</span>
                  <span>{ptype === 'giftcard' ? 'Remaining' : `Charged to ${PAYMENT_LABELS[ptype]}`} <b className={remainder < 0 ? 'bad' : ''}>{money(Math.max(0, remainder), settings.currency)}</b></span>
                </div>
              </>
            )
          )}
        </div>

        <Field label="Notes">
          <textarea className="textarea" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>

        {error && <div className="err">{error}</div>}
        <button className="btn primary block" onClick={save}>{edit ? 'Save changes' : 'Add spend'}</button>
        {edit && (
          confirmDel ? (
            <div className="row">
              <button className="btn glassy grow" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn danger grow" onClick={async () => { await deleteTransaction(edit.id); toast('Spend deleted'); onClose(); }}>Delete{edit.giftCards.length ? ' & refund gift cards' : ''}</button>
            </div>
          ) : (
            <button className="btn ghost-danger block" onClick={() => setConfirmDel(true)}><ITrash width={18} /> Delete spend</button>
          )
        )}
      </div>
    </Sheet>
  );
}
