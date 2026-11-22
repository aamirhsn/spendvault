import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { SpendDraft } from '../lib/nav';
import type { GiftCardUse, PaymentType, Transaction } from '../lib/types';
import { CATEGORIES, giftName, isCustomCategory } from '../lib/categories';
import { money, parseISO, prettyDate, round2, todayISO } from '../lib/format';
import { categoryForMcc } from '../lib/mcc';
import { CBtn, FieldRow, Group, NavRow, Sheet, Toggle, toast } from '../components/ui';
import { PAYMENT_LABELS } from '../components/TxnRow';
import { LogoTile } from './GiftCards';
import { CatIcon, categoryColor } from '../components/CatIcon';
import { cardFinishKey, finishFor } from '../lib/finishes';
import { IBank, ICalendar, ICard, ICheck, IEdit, IEllipsis, IGift, IScan, IStore, ITrash, IWallet } from '../components/Icons';


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
  // Gift cards chosen before an amount was typed (e.g. “Spend with this card”) follow the amount.
  const [autoGift, setAutoGift] = useState<Set<string>>(() => new Set((init.giftCards ?? []).filter((g) => !g.amount).map((g) => g.giftCardId)));

  const giftOptions = useMemo(
    () =>
      giftCards
        .map((g) => ({ g, available: round2(g.balance + (edit?.giftCards.find((u) => u.giftCardId === g.id)?.amount ?? 0)) }))
        .filter(({ g, available }) => (!g.archived && available > 0) || gifts[g.id] !== undefined)
        .sort((a, b) => Number(gifts[b.g.id] !== undefined) - Number(gifts[a.g.id] !== undefined) || (a.g.expiry || '9999').localeCompare(b.g.expiry || '9999')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [giftCards, edit],
  );

  const amt = Number(amount) || 0;
  useEffect(() => {
    if (!autoGift.size) return;
    setGifts((cur) => {
      const next = { ...cur };
      let left = amt;
      for (const id of autoGift) {
        const g = giftCards.find((x) => x.id === id);
        if (!g) continue;
        const v = Math.max(0, Math.min(g.balance, round2(left)));
        next[id] = v ? String(v) : '';
        left -= v;
      }
      return next;
    });
  }, [amt, autoGift, giftCards]);
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
    if (!(amt > 0)) { setError('Enter an amount'); return toast('Enter an amount'); }
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


  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return todayISO(d); })();
  const selCard = cards.find((c) => c.id === cardId);
  const merchant = merchants.find((m) => m.id === merchantId);
  const fmt = (n: number) => money(n, settings.currency);
  const [picker, setPicker] = useState<null | 'category' | 'other' | 'pay' | 'date' | 'merchant' | 'gift' | 'note'>(null);
  const [otherName, setOtherName] = useState('');
  const usedCustom = useMemo(() => [...new Set(data.transactions.map((t) => t.category).filter(isCustomCategory))].slice(0, 12), [data.transactions]);
  const [armDelete, setArmDelete] = useState(false);
  const payIcon: Record<string, React.ReactNode> = { card: <ICard />, upi: <IScan />, cash: <IWallet />, netbanking: <IBank />, wallet: <IWallet />, giftcard: <IGift />, other: <IEllipsis /> };

  // ---- custom keypad ----
  const press = useCallback((k: string) => {
    setError('');
    setAmount((cur) => {
      if (k === 'del') return cur.slice(0, -1);
      if (k === '.') return cur.includes('.') ? cur : (cur || '0') + '.';
      if (cur.includes('.') && cur.split('.')[1].length >= 2) return cur;
      if (cur.replace('.', '').length >= 9) return cur;
      if (cur === '0') return k;
      return cur + k;
    });
  }, []);
  useEffect(() => {
    if (picker) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === '.' || e.key === ',') press('.');
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') save();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const chosenGifts = giftCards.filter((g) => gifts[g.id] !== undefined && (Number(gifts[g.id]) > 0 || autoGift.has(g.id)));
  const display = amount ? Number(amount.split('.')[0] || 0).toLocaleString(settings.currency === 'INR' ? 'en-IN' : undefined) + (amount.includes('.') ? '.' + amount.split('.')[1] : '') : '0';
  const dateLabel = date === todayISO() ? 'Today' : date === yesterday ? 'Yesterday' : prettyDate(date);
  const payLabel = ptype === 'card' ? (selCard ? `${selCard.name || selCard.bank} ••${selCard.last4}` : 'Choose card') : PAYMENT_LABELS[ptype];

  return (
    <Sheet open onClose={onClose} title={edit ? 'Edit Spend' : 'New Spend'}
      actions={edit ? <CBtn icon={<ITrash />} label={armDelete ? 'Tap again to delete' : 'Delete'} variant="danger" onClick={async () => {
        if (!armDelete) { setArmDelete(true); toast('Tap again to delete'); return; }
        await deleteTransaction(edit.id); toast('Spend deleted'); onClose();
      }} /> : undefined}>
      <div className="entry">
        <div className="entry-amount" style={{ ['--hc' as string]: categoryColor(category) }}>
          <div className={`entry-num ${amount ? '' : 'empty'} ${error ? 'shake' : ''}`} aria-live="polite" aria-label={`Amount ${fmt(amt)}`}>
            <span className="cur">{currencySymbol(settings.currency)}</span>{display}
          </div>
          <button className="entry-desc" onClick={() => setPicker('note')}>{description.trim() || 'Add description'}<IEdit width={14} /></button>
        </div>

        <div className="tags">
          <button className="tagbtn" onClick={() => setPicker('category')}><CatIcon name={category} size={22} round solid />{category}</button>
          <button className="tagbtn" onClick={() => setPicker('pay')}>
            {ptype === 'card' && selCard ? <span className="mini-card" style={{ background: finishFor(cardFinishKey(selCard)).bg, width: 24, height: 16 }} /> : payIcon[ptype]}{payLabel}
          </button>
          <button className="tagbtn" onClick={() => setPicker('date')}><ICalendar />{dateLabel}</button>
          {merchants.length > 0 && <button className={`tagbtn ${merchant ? '' : 'ghost'}`} onClick={() => setPicker('merchant')}><IStore />{merchant ? merchant.name || merchant.vpa : 'Merchant'}</button>}
          {giftCards.some((g) => !g.archived && g.balance > 0) || useGift ? (
            <button className={`tagbtn ${useGift && chosenGifts.length ? '' : 'ghost'}`} onClick={() => setPicker('gift')}><IGift />{useGift && chosenGifts.length ? `${chosenGifts.length === 1 ? giftName(chosenGifts[0]) : `${chosenGifts.length} gift cards`}${giftSum > 0 ? ` · ${fmt(giftSum)}` : ''}` : 'Gift card'}</button>
          ) : null}
          <button className={`tagbtn ${notes ? '' : 'ghost'}`} onClick={() => setPicker('note')}><IEdit />{notes ? 'Note' : 'Add note'}</button>
        </div>

        <div className="keypad-grid" role="group" aria-label="Number pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button key={k} className="kp" onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}>
              {k === 'del' ? '⌫' : k}
            </button>
          ))}
        </div>
        <button className="btn primary entry-save" onClick={save}><ICheck strokeWidth={2.6} width={20} /> {edit ? 'Save Changes' : 'Add Spend'}</button>
      </div>

      {picker === 'category' && (
        <Sheet open onClose={() => setPicker(null)} title="Category">
          <div className="cat-grid">
            {CATEGORIES.map((c) => {
              const on = c.name === 'Other' ? category === 'Other' || isCustomCategory(category) : category === c.name;
              return (
                <button key={c.name} className={`cat-pick ${on ? 'on' : ''}`} onClick={() => {
                  if (c.name === 'Other') { setOtherName(isCustomCategory(category) ? category : ''); setPicker('other'); }
                  else { setCategory(c.name); setPicker(null); }
                }}>
                  <CatIcon name={c.name} size={44} solid={on} />
                  <span>{c.name === 'Other' && isCustomCategory(category) ? category : c.name}</span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {picker === 'other' && (
        <Sheet open onClose={() => setPicker(null)} title="Other category" actions={<CBtn icon={<ICheck strokeWidth={2.6} />} label="Done" variant="primary" onClick={() => { setCategory(otherName.trim() || 'Other'); setPicker(null); }} />}>
          <form onSubmit={(e) => { e.preventDefault(); setCategory(otherName.trim() || 'Other'); setPicker(null); }}>
            <Group footer="Name it yourself, e.g. “Pets” or “Wedding”, or leave it blank to use Other.">
              <FieldRow icon={<IEdit />} tile="#8e8e93" label="Category name"><input autoFocus placeholder="Optional" maxLength={30} value={otherName} onChange={(e) => setOtherName(e.target.value)} enterKeyHint="done" /></FieldRow>
            </Group>
            {usedCustom.length > 0 && (
              <div className="choice-row" style={{ flexWrap: 'wrap', margin: '14px 0 0', padding: 0 }}>
                {usedCustom.map((c) => <button type="button" key={c} className={`cchip ${category === c ? 'on' : ''}`} onClick={() => { setCategory(c); setPicker(null); }}>{c}</button>)}
              </div>
            )}
          </form>
        </Sheet>
      )}

      {picker === 'pay' && (
        <Sheet open onClose={() => setPicker(null)} title="Paid with">
          <div className="stack-lg">
            {cards.length > 0 && (
              <Group header="Cards">
                {cards.map((c) => (
                  <NavRow key={c.id} icon={<span className="mini-card" style={{ background: finishFor(cardFinishKey(c)).bg, width: 34, height: 22 }} />} iconBg="transparent"
                    title={c.name || c.bank} subtitle={`${c.bank} · ••${c.last4}`} chevron={false}
                    right={ptype === 'card' && cardId === c.id ? <ICheck style={{ color: 'var(--tint)' }} /> : undefined}
                    onClick={() => { setPtype('card'); setCardId(c.id); setPicker(null); }} />
                ))}
              </Group>
            )}
            <Group header="Other">
              {(['upi', 'cash', 'netbanking', 'wallet', 'giftcard', 'other'] as PaymentType[]).map((m) => (
                <NavRow key={m} icon={payIcon[m]} iconBg="var(--tint)" title={PAYMENT_LABELS[m]} chevron={false}
                  right={ptype === m ? <ICheck style={{ color: 'var(--tint)' }} /> : undefined}
                  onClick={() => { setPtype(m); if (m === 'giftcard') { setUseGift(true); setPicker('gift'); } else setPicker(null); }} />
              ))}
            </Group>
          </div>
        </Sheet>
      )}

      {picker === 'date' && (
        <Sheet open onClose={() => setPicker(null)} title="Date">
          <div className="stack-lg">
            <div className="choice-row" style={{ padding: '2px 0', margin: 0, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3].map((n) => {
                const d = new Date(); d.setDate(d.getDate() - n); const iso = todayISO(d);
                return <button key={n} className={`cchip ${date === iso ? 'on' : ''}`} onClick={() => { setDate(iso); setPicker(null); }}>{n === 0 ? 'Today' : n === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long' })}</button>;
              })}
            </div>
            <Group><FieldRow icon={<ICalendar />} tile="#ff3b30" label="Pick a date"><input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></FieldRow></Group>
          </div>
        </Sheet>
      )}

      {picker === 'merchant' && (
        <Sheet open onClose={() => setPicker(null)} title="Merchant">
          <Group>
            <NavRow title="None" chevron={false} right={!merchantId ? <ICheck style={{ color: 'var(--tint)' }} /> : undefined} onClick={() => { setMerchantId(''); setPicker(null); }} />
            {merchants.map((m) => (
              <NavRow key={m.id} title={m.name || m.vpa} subtitle={m.mcc ? `MCC ${m.mcc}` : m.vpa} chevron={false}
                right={merchantId === m.id ? <ICheck style={{ color: 'var(--tint)' }} /> : undefined}
                onClick={() => { pickMerchant(m.id); setPicker(null); }} />
            ))}
          </Group>
        </Sheet>
      )}

      {picker === 'gift' && (
        <Sheet open onClose={() => setPicker(null)} title="Gift cards" actions={<CBtn icon={<ICheck strokeWidth={2.6} />} label="Done" variant="primary" onClick={() => setPicker(null)} />}>
          <div className="stack-lg">
            <Group footer={giftSum > 0 ? `${fmt(giftSum)} from gift cards · ${fmt(Math.max(0, remainder))} ${ptype === 'giftcard' ? 'remaining' : `charged to ${PAYMENT_LABELS[ptype].toLowerCase()}`}` : 'Balances are deducted automatically.'}>
              <div className="cell"><span className="grow">Use gift cards</span><Toggle on={useGift} onChange={setUseGift} label="Use gift cards" /></div>
              {useGift && giftOptions.length === 0 && <div className="cell st">No gift cards with balance.</div>}
              {useGift && giftOptions.map(({ g, available }) => (
                <div className="cell" key={g.id}>
                  <LogoTile brand={g.brand} size={30} />
                  <span className="grow">
                    <div className="t ellipsis" style={{ fontSize: 15, fontWeight: gifts[g.id] ? 600 : 400 }}>{giftName(g)}</div>
                    <div className="st" style={{ fontSize: 13 }}>{fmt(available)} left{g.expiry ? ` · exp ${parseISO(g.expiry).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}` : ''}</div>
                  </span>
                  <input inputMode="decimal" placeholder="0" style={{ maxWidth: 90 }} value={gifts[g.id] ?? ''} onChange={(e) => { setAutoGift((a) => { const n = new Set(a); n.delete(g.id); return n; }); setGifts((s) => ({ ...s, [g.id]: e.target.value.replace(/[^\d.]/g, '') })); }} aria-label={`Amount from ${giftName(g)}`} />
                  <button type="button" className="textbtn" style={{ fontSize: 15 }} onClick={() => { setAutoGift((a) => { const n = new Set(a); n.delete(g.id); return n; }); fill(g.id); }}>Max</button>
                </div>
              ))}
            </Group>
          </div>
        </Sheet>
      )}

      {picker === 'note' && (
        <Sheet open onClose={() => setPicker(null)} title="Details" actions={<CBtn icon={<ICheck strokeWidth={2.6} />} label="Done" variant="primary" onClick={() => setPicker(null)} />}>
          <form onSubmit={(e) => { e.preventDefault(); setPicker(null); }}>
            <Group>
              <FieldRow icon={<IEdit />} tile="#8e8e93" label="Description"><input autoFocus placeholder="e.g. Dinner with friends" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} enterKeyHint="done" /></FieldRow>
              <FieldRow icon={<IEdit />} tile="#5856d6" label="Note"><input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} enterKeyHint="done" /></FieldRow>
            </Group>
            <button type="submit" hidden />
          </form>
        </Sheet>
      )}
    </Sheet>
  );
}
