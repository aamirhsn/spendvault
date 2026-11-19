import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { SpendDraft } from '../lib/nav';
import type { GiftCardUse, PaymentType, Transaction } from '../lib/types';
import { CATEGORIES } from '../lib/categories';
import { last4, money, round2, todayISO } from '../lib/format';
import { categoryForMcc, lookupMcc } from '../lib/mcc';
import { DeleteRow, FieldRow, Group, Sheet, Toggle, toast } from '../components/ui';
import { PAYMENT_LABELS } from '../components/TxnRow';
import { LogoTile } from './GiftCards';

const METHODS: PaymentType[] = ['card', 'upi', 'cash', 'netbanking', 'wallet', 'giftcard', 'other'];

function currencySymbol(c: string) {
  try {
    return (0).toLocaleString(c === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '');
  } catch {
    return c;
  }
}

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
    Object.fromEntries((init.giftCards ?? []).map((g) => [g.giftCardId, g.amount ? String(g.amount) : ''])),
  );
  const [error, setError] = useState('');

  const giftOptions = useMemo(
    () =>
      giftCards
        .map((g) => ({ g, available: round2(g.balance + (edit?.giftCards.find((u) => u.giftCardId === g.id)?.amount ?? 0)) }))
        .filter(({ g, available }) => (!g.archived && available > 0) || gifts[g.id] !== undefined),
    [giftCards, edit, gifts],
  );

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

  const fill = (id: string) => {
    const opt = giftOptions.find((o) => o.g.id === id);
    if (!opt) return;
    const others = giftUses.filter((u) => u.giftCardId !== id).reduce((a, u) => a + u.amount, 0);
    const v = Math.max(0, Math.min(opt.available, round2(amt - others)));
    setGifts((s) => ({ ...s, [id]: v ? String(v) : '' }));
  };

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Enter an amount.');
    if (ptype === 'card' && !cardId) return setError('Choose a card, or add one in the Cards tab.');
    for (const u of giftUses) {
      const opt = giftOptions.find((o) => o.g.id === u.giftCardId);
      if (!opt || u.amount > opt.available + 0.001) return setError(`Gift card amount is more than its balance.`);
    }
    if (giftSum > amt + 0.001) return setError('Gift cards cover more than the bill amount.');
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
    toast(edit ? 'Spend updated' : 'Spend added');
    onClose();
  };

  const merchant = merchants.find((m) => m.id === merchantId);
  const mccInfo = merchant?.mcc ? lookupMcc(merchant.mcc) : null;
  const fmt = (n: number) => money(n, settings.currency);

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit Spend' : 'New Spend'} actions={<button className="textbtn bold" onClick={save}>{edit ? 'Done' : 'Add'}</button>}>
      <div className="stack-lg">
        <div className="amount-entry">
          <span>{currencySymbol(settings.currency)}</span>
          <input inputMode="decimal" placeholder="0" style={{ width: `${Math.max(1, amount.length) * 0.62 + 0.3}em` }} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Amount" autoFocus={!edit} />
        </div>

        <Group>
          <FieldRow label="Description"><input placeholder="What was it?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} /></FieldRow>
          <FieldRow label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon}  {c.name}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Date"><input type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} /></FieldRow>
          {merchants.length > 0 && (
            <FieldRow label="Merchant">
              <select value={merchantId} onChange={(e) => pickMerchant(e.target.value)}>
                <option value="">None</option>
                {merchants.map((m) => <option key={m.id} value={m.id}>{m.name || m.vpa}</option>)}
              </select>
            </FieldRow>
          )}
        </Group>
        {merchant && <div className="group-f" style={{ marginTop: -16 }}>MCC {merchant.mcc || '—'}{mccInfo ? ` · ${mccInfo.desc}` : ''}</div>}

        <Group>
          <FieldRow label="Paid with">
            <select value={ptype} onChange={(e) => { const v = e.target.value as PaymentType; setPtype(v); if (v === 'giftcard') setUseGift(true); }}>
              {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
            </select>
          </FieldRow>
          {ptype === 'card' && (
            <FieldRow label="Card">
              {cards.length ? (
                <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name || c.bank} ••{last4(c.number)}</option>)}
                </select>
              ) : <span className="v grow">Add one in Cards</span>}
            </FieldRow>
          )}
          <div className="cell">
            <span className="grow">Use gift cards</span>
            <Toggle on={useGift} onChange={setUseGift} label="Use gift cards" />
          </div>
          {useGift && giftOptions.length === 0 && <div className="cell st">No gift cards with balance.</div>}
          {useGift && giftOptions.map(({ g, available }) => (
            <div className="cell" key={g.id} style={{ ['--inset' as string]: '16px' }}>
              <LogoTile brand={g.brand} size={34} />
              <span className="grow">
                <div className="t ellipsis" style={{ fontSize: 15 }}>{g.brand}</div>
                <div className="st" style={{ fontSize: 13 }}>{fmt(available)} available</div>
              </span>
              <input inputMode="decimal" placeholder="0" style={{ maxWidth: 90 }} value={gifts[g.id] ?? ''} onChange={(e) => setGifts((s) => ({ ...s, [g.id]: e.target.value.replace(/[^\d.]/g, '') }))} aria-label={`Amount from ${g.brand}`} />
              <button type="button" className="textbtn" style={{ fontSize: 15 }} onClick={() => fill(g.id)}>Max</button>
            </div>
          ))}
        </Group>
        {useGift && giftSum > 0 && (
          <div className="group-f" style={{ marginTop: -16 }}>
            {fmt(giftSum)} from gift cards · <b className={remainder < 0 ? 'bad' : ''}>{fmt(Math.max(0, remainder))}</b> {ptype === 'giftcard' ? 'remaining' : `charged to ${PAYMENT_LABELS[ptype].toLowerCase()}`}
          </div>
        )}

        <Group header="Notes">
          <div className="cell"><textarea placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        </Group>

        {error && <div className="group-f bad" style={{ marginTop: -10 }}>{error}</div>}
        {edit && <DeleteRow label="Delete spend" confirmLabel={edit.giftCards.length ? 'Delete and refund gift cards' : 'Delete spend'} onConfirm={async () => { await deleteTransaction(edit.id); toast('Spend deleted'); onClose(); }} />}
      </div>
    </Sheet>
  );
}
