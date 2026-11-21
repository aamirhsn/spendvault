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
  number: string; // secret: blank unless the card vault is unlocked
  last4: string; // public, used everywhere outside the Cards tab
  holder: string;
  expiry: string; // MM/YY
  cvv: string;
  theme: string; // card finish key (see lib/finishes.ts)
  finishChosen?: boolean; // true once picked in the v2 form; otherwise a finish is suggested from the card name
  art?: string; // optional photo of the real card front (data URL, encrypted with the vault)
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
  codeTail?: string; // last 4 of the code — public, so cards can be told apart while the vault is locked
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
  categoryBudgets: Record<string, number>;
  autoLockMinutes: number;
  theme: 'system' | 'light' | 'dark';
  hideAmounts: boolean;
  rulesSeeded?: boolean;
}

/** A rule applied to bank SMS: when `match` appears in the message, set these fields. */
export interface SmsRule {
  id: ID;
  match: string; // keyword, case-insensitive
  name?: string; // description to use
  category?: string;
  paymentType?: PaymentType;
  cardId?: ID;
  ignore?: boolean; // skip messages that match
}

export interface Todo {
  id: ID;
  title: string;
  done: boolean;
  due?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: number;
  updatedAt: number;
  doneAt?: number;
}

export interface VaultData {
  transactions: Transaction[];
  cards: PaymentCard[];
  giftCards: GiftCard[];
  merchants: Merchant[];
  settings: Settings;
  /** User-uploaded brand/bank logos (PNG data URLs), keyed by logoKey(name). */
  logos: Record<string, string>;
  rules: SmsRule[];
  smsSeen: string[]; // hashes of imported messages, to skip duplicates
  todos: Todo[];
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  currency: 'INR',
  monthlyBudget: 0,
  categoryBudgets: {},
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
  logos: {},
  rules: [],
  smsSeen: [],
  todos: [],
});
