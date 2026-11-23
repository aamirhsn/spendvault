import { useMemo, useState, type ReactNode } from 'react';
import type { GiftCard, PaymentCard, Transaction } from '../lib/types';
import { categoryIcon, giftName } from '../lib/categories';
import { daysUntil, monthLabel, parseISO, prettyDate, todayISO } from '../lib/format';

type Fmt = (n: number) => string;

/* ============ Safe to spend today ============ */

export function SafeToSpend(p: {
  limit: number; // budget for the month (0 = not set)
  spent: number; // spent this month within the budget's scope
  spentToday: number; // spent today within the budget's scope
  fmt: Fmt;
  onBudget(): void;
}) {
  const now = new Date();
  const dom = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = dim - dom + 1;
  const remaining = p.limit - p.spent;
  const allowance = Math.max(0, p.limit - (p.spent - p.spentToday)) / daysLeft;
  const leftToday = allowance - p.spentToday;
  const expected = (p.limit * dom) / dim;
  const tone = !p.limit ? 'none' : remaining < 0 ? 'bad' : p.spent > expected * 1.1 ? 'warn' : 'good';
  const label = { none: '', bad: 'Over budget', warn: 'Spending fast', good: 'On track' }[tone];
  const used = p.limit ? Math.min(1, p.spent / p.limit) : 0;

  if (!p.limit) {
    return (
      <button className="card safe tone-none" onClick={p.onBudget}>
        <span className="label-xs">Safe to spend today</span>
        <div className="safe-hero muted">—</div>
        <div className="safe-foot"><span>Set a monthly budget to see a daily amount</span><b className="safe-link">Set budget ›</b></div>
      </button>
    );
  }

  return (
    <button className={`card safe tone-${tone}`} onClick={p.onBudget} aria-label="Safe to spend today, edit budget">
      <div className="safe-head">
        <span className="label-xs">Safe to spend today</span>
        <span className="safe-pill">{label}</span>
      </div>
      <div className={`safe-hero${leftToday < 0 ? ' neg' : ''}`}>
        {p.fmt(Math.abs(leftToday))}
        {leftToday < 0 && <small> over</small>}
      </div>
      <div className="safe-track" role="img" aria-label={`${Math.round(used * 100)}% of budget used; even pace would be ${Math.round((dom / dim) * 100)}%`}>
        <i style={{ width: `${Math.max(used > 0 ? 2 : 0, used * 100)}%` }} />
        <b style={{ left: `${(dom / dim) * 100}%` }} />
      </div>
      <div className="safe-foot">
        <span><strong>{p.fmt(Math.abs(remaining))}</strong> {remaining < 0 ? 'over' : 'left'} of {p.fmt(p.limit)}</span>
        <span>{daysLeft === 1 ? 'Last day' : `${daysLeft} days left`}</span>
      </div>
    </button>
  );
}

/* ============ Insight cards ============ */

interface Insight {
  key: string;
  bg: string;
  emoji: string;
  title: string;
  sub: string;
  viz?: ReactNode;
  onClick?(): void;
}

const BG = {
  orange: 'linear-gradient(145deg,#ff9f0a,#ff6b00)',
  green: 'linear-gradient(145deg,#34c759,#0f9a63)',
  indigo: 'linear-gradient(145deg,#5e5ce6,#3634a3)',
  blue: 'linear-gradient(145deg,#0a84ff,#0058d0)',
  pink: 'linear-gradient(145deg,#ff375f,#c9003c)',
  purple: 'linear-gradient(145deg,#bf5af2,#7d2ae8)',
  teal: 'linear-gradient(145deg,#30b0c7,#0b7285)',
};

const addDays = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

function Bars({ vals }: { vals: number[] }) {
  const m = Math.max(...vals, 1);
  return (
    <div className="ins-bars">
      {vals.map((v, i) => <i key={i} style={{ height: `${Math.max(10, (v / m) * 100)}%`, opacity: i === vals.length - 1 ? 0.95 : 0.4 }} />)}
    </div>
  );
}

export function buildInsights(o: {
  txns: Transaction[];
  giftCards: GiftCard[];
  dues: { c: PaymentCard; days: number; owed: number }[];
  monthTotal: number;
  lastToDate: number;
  top?: [string, number];
  fmt: Fmt;
  go: { cards(): void; gifts(): void; spends(): void };
}): Insight[] {
  const { txns, fmt } = o;
  const today = todayISO();
  const month = today.slice(0, 7);
  const out: Insight[] = [];

  // Card bills: overdue or due within a week.
  for (const d of o.dues.filter((d) => (d.c.overdue ?? 0) > 0 || d.days <= 7).slice(0, 2)) {
    const over = (d.c.overdue ?? 0) > 0;
    out.push({
      key: 'due' + d.c.id,
      bg: over ? BG.pink : BG.blue,
      emoji: '💳',
      title: `${d.c.name || d.c.bank} bill ${over ? 'is overdue' : d.days <= 0 ? 'due today' : d.days === 1 ? 'due tomorrow' : `due in ${d.days} days`}`,
      sub: `${fmt(d.owed)} to pay`,
      onClick: o.go.cards,
    });
  }

  // Category trend: last 7 days vs the 7 before.
  const from = addDays(today, -6), prevFrom = addDays(today, -13);
  const cur = new Map<string, number>(), prev = new Map<string, number>();
  for (const t of txns) {
    if (t.date > today || t.date < prevFrom) continue;
    const m = t.date >= from ? cur : prev;
    m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  }
  let best: { cat: string; a: number; b: number; pct: number } | null = null;
  for (const cat of new Set([...cur.keys(), ...prev.keys()])) {
    const a = cur.get(cat) ?? 0, b = prev.get(cat) ?? 0;
    if (!b || Math.max(a, b) < 500) continue;
    const pct = ((a - b) / b) * 100;
    if (Math.abs(pct) >= 20 && (!best || Math.abs(pct) > Math.abs(best.pct))) best = { cat, a, b, pct };
  }
  if (best) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const vals = days.map((d) => txns.filter((t) => t.date === d && t.category === best!.cat).reduce((s, t) => s + t.amount, 0));
    const byDesc = new Map<string, number>();
    for (const t of txns) if (t.date >= from && t.date <= today && t.category === best.cat) byDesc.set(t.description, (byDesc.get(t.description) ?? 0) + t.amount);
    const lead = [...byDesc.entries()].sort((x, y) => y[1] - x[1])[0];
    const up = best.pct > 0;
    out.push({
      key: 'trend',
      bg: up ? BG.orange : BG.green,
      emoji: categoryIcon(best.cat),
      title: `${best.cat} is ${up ? 'up' : 'down'} ${Math.abs(best.pct).toFixed(0)}% this week`,
      sub: `${fmt(best.a)} vs ${fmt(best.b)} last week${lead && lead[1] > best.a / 2 && lead[0] ? ` · mostly ${lead[0]}` : ''}`,
      viz: <Bars vals={vals} />,
      onClick: o.go.spends,
    });
  }

  // No-spend streak (only meaningful once there is some recent activity).
  const spentOn = new Set(txns.map((t) => t.date));
  if (txns.some((t) => t.date >= addDays(today, -30))) {
    let streak = 0;
    for (let d = today; !spentOn.has(d) && streak < 60; d = addDays(d, -1)) streak++;
    if (streak >= 2) {
      const last7 = Array.from({ length: 7 }, (_, i) => !spentOn.has(addDays(today, i - 6)));
      out.push({
        key: 'streak',
        bg: BG.green,
        emoji: '🔥',
        title: `${streak} no-spend days in a row`,
        sub: streak >= 5 ? 'Impressive. Keep it going!' : 'Nice. Keep it going!',
        viz: <div className="ins-sq">{last7.map((z, i) => <i key={i} style={{ opacity: z ? 0.95 : 0.3 }} />)}</div>,
      });
    }
  }

  // Gift card expiring soon.
  const exp = o.giftCards
    .filter((g) => !g.archived && g.balance > 0 && g.expiry)
    .map((g) => ({ g, days: daysUntil(parseISO(g.expiry)) }))
    .filter((x) => x.days >= 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days)[0];
  if (exp) {
    out.push({
      key: 'gift',
      bg: BG.indigo,
      emoji: '🎁',
      title: `${giftName(exp.g)} expires ${exp.days === 0 ? 'today' : exp.days === 1 ? 'tomorrow' : `in ${exp.days} days`}`,
      sub: `${fmt(exp.g.balance)} unused`,
      onClick: o.go.gifts,
    });
  }

  // Pace vs last month.
  if (o.lastToDate > 0 && o.monthTotal > 0) {
    const pct = ((o.monthTotal - o.lastToDate) / o.lastToDate) * 100;
    if (Math.abs(pct) >= 5) {
      const lm = parseISO(today);
      lm.setDate(1);
      lm.setMonth(lm.getMonth() - 1);
      out.push({
        key: 'pace',
        bg: pct < 0 ? BG.green : BG.orange,
        emoji: pct < 0 ? '📉' : '📈',
        title: `${Math.abs(pct).toFixed(0)}% ${pct < 0 ? 'less' : 'more'} than last month`,
        sub: `${fmt(o.monthTotal)} so far vs ${fmt(o.lastToDate)} by this date in ${lm.toLocaleDateString(undefined, { month: 'long' })}`,
      });
    }
  }

  // Top category.
  if (o.top && o.monthTotal > 0) {
    out.push({
      key: 'top',
      bg: BG.purple,
      emoji: categoryIcon(o.top[0]),
      title: `${o.top[0]} leads ${monthLabel(month).split(' ')[0]}`,
      sub: `${fmt(o.top[1])} · ${((o.top[1] / o.monthTotal) * 100).toFixed(0)}% of your spending`,
      onClick: o.go.spends,
    });
  }

  // Biggest spend this month.
  const big = txns.filter((t) => t.date.startsWith(month)).sort((a, b) => b.amount - a.amount)[0];
  if (big) {
    out.push({
      key: 'big',
      bg: BG.teal,
      emoji: '💸',
      title: `Biggest spend: ${big.description || big.category}`,
      sub: `${fmt(big.amount)} · ${prettyDate(big.date)}`,
      onClick: o.go.spends,
    });
  }

  if (!out.length) {
    out.push({ key: 'empty', bg: BG.green, emoji: '✨', title: 'Insights will appear here', sub: 'Add a few spends and Fiscus will spot patterns for you.' });
  }
  return out;
}

export function Insights({ items }: { items: Insight[] }) {
  const [idx, setIdx] = useState(0);
  const list = useMemo(() => items, [items]);
  return (
    <div>
      <div
        className="ins"
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
          setIdx(Math.min(list.length - 1, Math.round(el.scrollLeft / (w + 10))));
        }}
      >
        {list.map((i) => (
          <button key={i.key} className="ins-card" style={{ background: i.bg }} onClick={i.onClick} disabled={!i.onClick}>
            <span className="ins-e">{i.emoji}</span>
            <h4>{i.title}</h4>
            <p>{i.sub}</p>
            {i.viz}
          </button>
        ))}
      </div>
      {list.length > 1 && (
        <div className="ins-dots" aria-hidden>
          {list.map((i, n) => <i key={i.key} className={n === idx ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}
