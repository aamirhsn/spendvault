import { money } from '../lib/format';
import { Logo, findBrand } from '../lib/logos';
import type { Merchant, PaymentCard, Settings, Transaction } from '../lib/types';
import { CatIcon } from './CatIcon';

export const PAYMENT_LABELS: Record<string, string> = {
  card: 'Card', upi: 'UPI', cash: 'Cash', netbanking: 'Net banking', wallet: 'Wallet', giftcard: 'Gift card only', other: 'Other',
};

export function paymentLabel(t: Transaction, cards: PaymentCard[]) {
  if (t.payment.type === 'card') {
    const c = cards.find((x) => x.id === t.payment.cardId);
    return c ? `${c.name || c.bank} ••${c.last4}` : 'Removed card';
  }
  return PAYMENT_LABELS[t.payment.type] ?? 'Other';
}

/** Merchant logo when the spend mentions a known brand, otherwise the coloured category icon. */
export function TxnIcon({ t, merchants, size = 40 }: { t: Transaction; merchants?: Merchant[]; size?: number }) {
  const m = t.merchantId ? merchants?.find((x) => x.id === t.merchantId) : undefined;
  const brand = findBrand(m?.name) ?? findBrand(t.description);
  if (brand) return <span className="logo-round" style={{ width: size, height: size }}><Logo name={brand} preferMark /></span>;
  return <CatIcon name={t.category} size={size} round />;
}

export function TxnRow({ t, cards, settings, merchants, onClick }: { t: Transaction; cards: PaymentCard[]; settings: Settings; merchants?: Merchant[]; onClick?: () => void }) {
  const gift = t.giftCards.reduce((a, g) => a + g.amount, 0);
  return (
    <button className="cell" style={{ ['--inset' as string]: '68px' }} onClick={onClick}>
      <TxnIcon t={t} merchants={merchants} />
      <span className="grow">
        <div className="t ellipsis" style={{ fontWeight: 500 }}>{t.description || t.category}</div>
        <div className="st ellipsis">{t.category}</div>
      </span>
      <span className="amt-col">
        <div className="a neg">−{money(t.amount, settings.currency, { hide: settings.hideAmounts })}</div>
        <div className="b ellipsis" style={{ maxWidth: 140 }}>{gift > 0 ? '🎁 ' : ''}{paymentLabel(t, cards)}</div>
      </span>
    </button>
  );
}
