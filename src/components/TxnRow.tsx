import { categoryIcon } from '../lib/categories';
import { last4, money } from '../lib/format';
import type { PaymentCard, Settings, Transaction } from '../lib/types';

export const PAYMENT_LABELS: Record<string, string> = {
  card: 'Card', upi: 'UPI', cash: 'Cash', netbanking: 'Net banking', wallet: 'Wallet', giftcard: 'Gift card only', other: 'Other',
};

export function paymentLabel(t: Transaction, cards: PaymentCard[]) {
  if (t.payment.type === 'card') {
    const c = cards.find((x) => x.id === t.payment.cardId);
    return c ? `${c.name || c.bank} ••${last4(c.number)}` : 'Removed card';
  }
  return PAYMENT_LABELS[t.payment.type] ?? 'Other';
}

export function TxnRow({ t, cards, settings, onClick }: { t: Transaction; cards: PaymentCard[]; settings: Settings; onClick?: () => void }) {
  const gift = t.giftCards.reduce((a, g) => a + g.amount, 0);
  return (
    <button className="cell" style={{ ['--inset' as string]: '68px' }} onClick={onClick}>
      <span className="tx-ic">{categoryIcon(t.category)}</span>
      <span className="grow">
        <div className="t ellipsis">{t.description || t.category}</div>
        <div className="st ellipsis">{paymentLabel(t, cards)}{gift > 0 ? ' · 🎁 gift card' : ''}</div>
      </span>
      <span className="amt num">{money(t.amount, settings.currency, { hide: settings.hideAmounts })}</span>
    </button>
  );
}
