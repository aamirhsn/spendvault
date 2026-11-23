export const uid = () => crypto.randomUUID();

const fmtCache = new Map<string, Intl.NumberFormat>();
export function money(n: number, currency = 'INR', opts: { compact?: boolean; hide?: boolean; decimals?: boolean } = {}) {
  if (opts.hide) return '••••';
  const key = `${currency}|${opts.compact}|${opts.decimals}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : opts.decimals === false ? 0 : 2,
      minimumFractionDigits: 0,
    });
    fmtCache.set(key, f);
  }
  // Hair space (kept unbreakable) after ₹ so the sign never touches the first digit.
  return f.format(n || 0).replace('₹', '₹\u200A\u2060');
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export function prettyDate(iso: string) {
  const d = parseISO(iso);
  const today = parseISO(todayISO());
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: diff < 7 && diff > 0 ? 'long' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthLabel(key: string, short = false) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: short ? 'short' : 'long', year: short ? undefined : 'numeric' });
}

export function addMonths(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Next occurrence (today or later) of a given day-of-month, clamped to month length. */
export function nextDayOfMonth(day: number, from = new Date()) {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 2; i++) {
    const y = base.getFullYear();
    const m = base.getMonth() + i;
    const last = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(day, last));
    if (d >= base) return d;
  }
  return base;
}

export const daysUntil = (d: Date) => {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

export const digits = (s: string) => s.replace(/\D/g, '');
export const last4 = (n: string) => digits(n).slice(-4);

const isAmex = (d: string) => /^3[47]/.test(d);

/** Expected length of a card number, used to keep layout stable while typing. */
export const cardLength = (n: string) => {
  const d = digits(n);
  return isAmex(d) ? 15 : Math.max(16, d.length);
};

/** Group digits 4-4-4-4, or 4-6-5 for Amex (decided by prefix, never by length). */
export function groupCardNumber(n: string) {
  const d = digits(n);
  if (isAmex(d)) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  return d.replace(/(.{4})/g, '$1 ').trim();
}

/** Typed digits padded with dots to the full card length, so a live preview never reflows. */
export function previewCardNumber(n: string) {
  const d = digits(n);
  const full = (d + '•'.repeat(Math.max(0, cardLength(d) - d.length))).slice(0, cardLength(d));
  if (isAmex(d)) return `${full.slice(0, 4)} ${full.slice(4, 10)} ${full.slice(10)}`;
  return full.replace(/(.{4})/g, '$1 ').trim();
}

export function maskCardNumber(n: string) {
  const d = digits(n);
  if (isAmex(d)) return `•••• •••••• •${d.slice(-4)}`;
  return `•••• •••• •••• ${d.slice(-4).padStart(4, '•')}`;
}

export function luhnValid(n: string) {
  const d = digits(n);
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
  }
  return sum % 10 === 0;
}

export function detectNetwork(n: string): string | null {
  const d = digits(n);
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^(36|38|30[0-5])/.test(d)) return 'Diners';
  if (/^6011/.test(d)) return 'Discover';
  if (/^(60|65|81|82|508|353|356)/.test(d)) return 'RuPay';
  return null;
}
