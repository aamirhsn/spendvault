import type { PaymentCard, PaymentType, SmsRule, Transaction } from './types';
import { round2, todayISO, uid } from './format';

// Parser for Indian bank / card / UPI transaction alerts, e.g.
//   "Rs.1,250.00 debited from A/c XX1234 on 19-11-26 to VPA swiggy@icici. UPI Ref 4321"
//   "INR 499.00 spent on HDFC Bank Card x1111 at AMAZON on 2026-11-19"
//   "You've spent Rs 320 on your ICICI Bank Credit Card XX0001 at BLUE TOKAI on 19-Nov-26"

export interface ParsedSms {
  raw: string;
  hash: string;
  amount: number;
  kind: 'debit' | 'credit';
  date: string;
  last4?: string;
  merchant?: string;
  vpa?: string;
  isCard: boolean;
  isUpi: boolean;
}

export function hashText(s: string) {
  let h = 0x811c9dc5;
  const t = s.replace(/\s+/g, ' ').trim().toLowerCase();
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + t.length.toString(36);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(text: string): string | null {
  // 2026-11-19
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  // 19-Nov-26 / 19 Nov 2026 / 19Nov26
  m = text.match(/\b(\d{1,2})[-\s/]?([A-Za-z]{3})[a-z]*[-\s/,]*(\d{2,4})\b/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(year(m[3]), MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  // 19-11-26 / 19/11/2026 (day first, Indian format)
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) return iso(year(m[3]), +m[2], +m[1]);
  return null;
}
const year = (y: string) => (y.length === 2 ? 2000 + +y : +y);
function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const s = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return s > todayISO() ? todayISO() : s;
}

const clean = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/^(vpa|the|merchant|m\/s)\s+/i, '').replace(/[.,;:\-\s]+$/, '').trim();

export function parseSms(text: string): ParsedSms | null {
  const raw = text.trim();
  if (!raw) return null;
  if (/\b(otp|one[\s-]?time password|verification code)\b/i.test(raw)) return null;
  const amt = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ?? raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i);
  if (!amt) return null;
  const amount = round2(Number(amt[1].replace(/,/g, '')));
  if (!(amount > 0)) return null;

  const debit = /\b(debited|spent|paid|purchase|purchased|withdrawn|sent|txn|transaction|charged|used|dr\.?)\b/i.test(raw);
  const credit = /\b(credited|received|refund(ed)?|reversed|deposited|cashback|cr\.?)\b/i.test(raw);
  if (!debit && !credit) return null;
  if (/\b(will be|due|is due|minimum amount|statement|offer|get up to|apply now)\b/i.test(raw) && !/\b(debited|spent)\b/i.test(raw)) return null;
  const kind: 'debit' | 'credit' = debit && (!credit || raw.search(/debited|spent|paid|sent|purchase/i) < raw.search(/credited|received|refund/i)) ? 'debit' : 'credit';

  const l4 = raw.match(/(?:card|a\/c|acct|account|ac)\b[^\d]{0,25}?(?:[x*•.]+\s*)?(\d{4})\b/i) ?? raw.match(/[xX*•]{2,}\s?(\d{4})\b/);
  const vpa = raw.match(/\b([\w.\-]{2,}@[a-z]{2,})\b/i)?.[1];
  let merchant: string | undefined;
  const STOP = String.raw`(?=\s+(?:on|via|ref|upi|using|from|for|avl|avbl|info|txn|dated|at|is|has)\b|[.,;(:]|$)`;
  const bad = (m: string) => /\b(a\/c|acct|account|card|bank|vpa|your|ref|avl|limit)\b/i.test(m) || /^\d/.test(m) || /^(rs|inr|₹)\b/i.test(m);
  for (const prep of ['at', 'to', 'towards', 'for']) {
    const m = raw.match(new RegExp(String.raw`\b${prep}\s+([A-Za-z0-9&'._*\- ]{2,40}?)` + STOP, 'i'));
    if (m && !bad(m[1]) && !m[1].includes('@')) { merchant = clean(m[1]); break; }
  }
  if (!merchant) {
    const m = raw.match(/[;,.]\s*([A-Za-z][A-Za-z0-9 &.'-]{2,30}?)\s+credited\b/i);
    if (m && !bad(m[1])) merchant = clean(m[1]);
  }
  const info = raw.match(/(?:UPI|IMPS|NEFT|POS)\/(?:P2[MA]\/)?\d*\/?([A-Za-z][A-Za-z0-9 &.'-]{2,30})/i);
  if (!merchant && info) merchant = clean(info[1]);
  if (!merchant && vpa) merchant = vpa.split('@')[0].replace(/[._-]?\d+$/, '').replace(/[._-]/g, ' ');
  if (merchant) {
    merchant = merchant.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(Pvt|Ltd|Limited|India|Private|Stores?)\b\.?/gi, '').replace(/\s+/g, ' ').trim() || undefined;
  }

  return {
    raw,
    hash: hashText(raw),
    amount,
    kind,
    date: parseDate(raw) ?? todayISO(),
    last4: l4?.[1],
    merchant,
    vpa,
    isCard: /\bcard\b/i.test(raw),
    isUpi: /\bupi\b|\bvpa\b/i.test(raw) || !!vpa,
  };
}

export const DEFAULT_RULES: Omit<SmsRule, 'id'>[] = [
  { match: 'swiggy', name: 'Swiggy', category: 'Food & Dining' },
  { match: 'zomato', name: 'Zomato', category: 'Food & Dining' },
  { match: 'blinkit', name: 'Blinkit', category: 'Groceries' },
  { match: 'zepto', name: 'Zepto', category: 'Groceries' },
  { match: 'bigbasket', name: 'BigBasket', category: 'Groceries' },
  { match: 'amazon', name: 'Amazon', category: 'Shopping' },
  { match: 'flipkart', name: 'Flipkart', category: 'Shopping' },
  { match: 'myntra', name: 'Myntra', category: 'Shopping' },
  { match: 'uber', name: 'Uber', category: 'Travel' },
  { match: 'ola', name: 'Ola', category: 'Travel' },
  { match: 'irctc', name: 'IRCTC', category: 'Travel' },
  { match: 'makemytrip', name: 'MakeMyTrip', category: 'Travel' },
  { match: 'petrol', category: 'Fuel' },
  { match: 'fuel', category: 'Fuel' },
  { match: 'netflix', name: 'Netflix', category: 'Subscriptions' },
  { match: 'spotify', name: 'Spotify', category: 'Subscriptions' },
  { match: 'airtel', name: 'Airtel', category: 'Bills & Utilities' },
  { match: 'jio', name: 'Jio', category: 'Bills & Utilities' },
  { match: 'electricity', category: 'Bills & Utilities' },
  { match: 'pharmacy', category: 'Health' },
  { match: 'zerodha', name: 'Zerodha', category: 'Investments' },
  { match: 'groww', name: 'Groww', category: 'Investments' },
  { match: 'mutual fund', category: 'Investments' },
];
export const seedRules = (): SmsRule[] => DEFAULT_RULES.map((r) => ({ ...r, id: uid() }));

export type Draft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { _hash: string; _parsed: ParsedSms; _ignored?: boolean; _dupe?: boolean };

/** Turn a parsed SMS into a spend draft using the user's rules and cards. */
export function toDraft(p: ParsedSms, rules: SmsRule[], cards: PaymentCard[]): Draft {
  const hay = `${p.raw} ${p.merchant ?? ''} ${p.vpa ?? ''}`.toLowerCase();
  const rule = rules.find((r) => r.match.trim() && hay.includes(r.match.trim().toLowerCase()));
  const card = p.last4 ? cards.find((c) => (c.last4 || c.number.slice(-4)) === p.last4) : undefined;
  let ptype: PaymentType = card ? 'card' : p.isUpi ? 'upi' : p.isCard ? 'card' : 'netbanking';
  if (ptype === 'card' && !card) ptype = 'other';
  if (rule?.paymentType) ptype = rule.paymentType;
  const cardId = rule?.cardId ?? card?.id;
  return {
    amount: p.amount,
    date: p.date,
    description: rule?.name || p.merchant || 'Bank SMS',
    category: rule?.category || 'Other',
    payment: ptype === 'card' && cardId ? { type: 'card', cardId } : { type: ptype === 'card' ? 'other' : ptype },
    giftCards: [],
    notes: `From SMS${p.last4 ? ` ··${p.last4}` : ''}`,
    _hash: p.hash,
    _parsed: p,
    _ignored: !!rule?.ignore,
  };
}

/** Split pasted text into individual messages (blank lines, or one alert per line). */
export function splitMessages(text: string): string[] {
  const blocks = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const amountLines = lines.filter((l) => /(?:rs\.?|inr|₹)\s*[\d,]/i.test(l));
  return amountLines.length > 1 && amountLines.length === lines.length ? lines : [text.trim()].filter(Boolean);
}
