export type ID = string;

export type PaymentType = 'card' | 'upi' | 'cash' | 'netbanking' | 'wallet' | 'giftcard' | 'other';

export interface GiftCardUse {
  giftCardId: ID;
  amount: number;
}

export interface Transaction {
  id: ID;
  date: string; // YYYY-MM-DD
  amount: number; // total bill amount
  description: string;
  category: string;
  payment: { type: PaymentType; cardId?: ID };
  giftCards: GiftCardUse[]; // portion paid with gift cards (deducted from their balances)
  merchantId?: ID;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type CardKind = 'credit' | 'debit';
export type CardNetwork = 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Diners' | 'Discover' | 'Other';

export interface PaymentCard {
  id: ID;
  kind: CardKind;
  bank: string;
  name: string; // product / nickname e.g. "Regalia Gold"
  network: CardNetwork;
  number: string;
  holder: string;
  expiry: string; // MM/YY
  cvv: string;
  theme: string;
  creditLimit?: number;
  statementDay?: number; // 1-31
  dueDay?: number; // 1-31
  totalDue?: number;
  minDue?: number;
  overdue?: number;
  lastPaid?: string; // YYYY-MM-DD
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface GiftCard {
  id: ID;
  brand: string;
  code: string;
  pin: string;
  value: number; // original face value
  balance: number; // current balance (auto-adjusted by spends)
  expiry: string; // YYYY-MM-DD or ''
  notes: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Merchant {
  id: ID;
  name: string;
  vpa: string;
  mcc: string;
  notes: string;
  raw: string; // original QR payload
  scannedAt: number;
  updatedAt: number;
}

export interface Settings {
  displayName: string;
  currency: string;
  monthlyBudget: number;
  autoLockMinutes: number;
  theme: 'system' | 'light' | 'dark';
  hideAmounts: boolean;
}

export interface VaultData {
  transactions: Transaction[];
  cards: PaymentCard[];
  giftCards: GiftCard[];
  merchants: Merchant[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  currency: 'INR',
  monthlyBudget: 0,
  autoLockMinutes: 5,
  theme: 'system',
  hideAmounts: false,
};

export const emptyVault = (): VaultData => ({
  transactions: [],
  cards: [],
  giftCards: [],
  merchants: [],
  settings: { ...DEFAULT_SETTINGS },
});
