import { useMemo, useState } from 'react';
import type { Transaction } from '../lib/types';
import { parseISO, todayISO } from '../lib/format';

type Fmt = (n: number) => string;

/* Mini month calendar for the top of Home.
   Each day is coloured green → red by everyday spending against a daily budget (everyday budget ÷ days in
   the month). Fixed lump sums (rent, EMIs…) never colour a day; they show as a small dot instead. */

const LEVELS = 5;
/** 0 = no spend, 1…5 = light green → red. `r` is the day's spend as a multiple of the daily budget. */
const levelOf = (r: number) => (r <= 0 ? 0 : r <= 0.5 ? 1 : r <= 1 ? 2 : r <= 1.5 ? 3 : r <= 2.5 ? 4 : 5);

export function MonthCal(p: {
  txns: Transaction[];
  isFixed: (category: string) => boolean;
  limit: number; // everyday budget for the month (0 = none)
  spent: number; // everyday spent this month
  hasBudget: boolean;
  fixed?: { reserved: number; paid: number };
  fmt: Fmt;
  onBudget(): void;
}) {
  const today = todayISO();
  const [sel, setSel] = useState(today);
  const now = parseISO(today);
  const y = now.getFullYear(), m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const dom = now.getDate();
  const daysLeft = dim - dom + 1;
  const monthKey = today.slice(0, 7);

  const { daily, fixedDays, counts, scale } = useMemo(() => {
    const daily = new Map<string, number>();
    const counts = new Map<string, number>();
    const fixedDays = new Map<string, number>();
    const recent: number[] = [];
    const from60 = todayISO(new Date(y, m, dom - 60));
    const recentDaily = new Map<string, number>();
    for (const t of p.txns) {
      if (p.isFixed(t.category)) {
        if (t.date.startsWith(monthKey)) fixedDays.set(t.date, (fixedDays.get(t.date) ?? 0) + t.amount);
        continue;
      }
      if (t.date.startsWith(monthKey)) {
        daily.set(t.date, (daily.get(t.date) ?? 0) + t.amount);
        counts.set(t.date, (counts.get(t.date) ?? 0) + 1);
      }
      if (t.date >= from60 && t.date <= today) recentDaily.set(t.date, (recentDaily.get(t.date) ?? 0) + t.amount);
    }
    for (const v of recentDaily.values()) if (v > 0) recent.push(v);
    recent.sort((a, b) => a - b);
    // Daily yardstick: the everyday budget spread over the month, or (no budget) your typical spending day.
    const scale = p.limit > 0 ? p.limit / dim : recent[Math.floor(recent.length / 2)] ?? 0;
    return { daily, fixedDays, counts, scale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.txns, p.limit, monthKey, today]);

  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const iso = (d: number) => `${monthKey}-${String(d).padStart(2, '0')}`;
  const remaining = p.limit - p.spent;
  const expected = (p.limit * dom) / dim;
  const tone = !p.limit ? 'none' : remaining < 0 ? 'bad' : p.spent > expected * 1.1 ? 'warn' : 'good';
  const label = { none: '', bad: 'Over budget', warn: 'Spending fast', good: 'On track' }[tone];

  const selDate = parseISO(sel);
  const selSpend = daily.get(sel) ?? 0;
  const selFixed = fixedDays.get(sel) ?? 0;
  const selCount = counts.get(sel) ?? 0;
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });

  return (
    <div className={`card mcal tone-${tone}`}>
      <div className="mcal-head">
        <div>
          <span className="label-xs">{monthName} · everyday spending</span>
          <div className="mcal-total">
            {p.fmt(p.spent)}
            {p.limit > 0 && <small> of {p.fmt(p.limit)}</small>}
          </div>
        </div>
        {label ? <span className="safe-pill">{label}</span> : <button className="safe-link" onClick={p.onBudget}>Set budget ›</button>}
      </div>

      <div className="mcal-grid" role="grid" aria-label={`${monthName} daily spending`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="mcal-wd">{d}</span>)}
        {cells.map((d, i) => {
          if (d == null) return <span key={`e${i}`} />;
          const key = iso(d);
          const future = d > dom;
          const v = daily.get(key) ?? 0;
          const lvl = future ? -1 : scale > 0 ? levelOf(v / scale) : v > 0 ? 2 : 0;
          return (
            <button
              key={key}
              className={`mcal-d${key === today ? ' today' : ''}${key === sel ? ' sel' : ''}${future ? ' fut' : ''}`}
              data-l={lvl}
              disabled={future}
              onClick={() => setSel(key)}
              aria-label={`${d} ${monthName}: ${p.fmt(v)}${fixedDays.has(key) ? ' plus fixed costs' : ''}`}
            >
              <span>{d}</span>
              {fixedDays.has(key) && <i className="mcal-fx" />}
            </button>
          );
        })}
      </div>

      <div className="mcal-legend">
        <span>Less</span>
        {Array.from({ length: LEVELS }, (_, i) => <i key={i} data-l={i + 1} />)}
        <span>More</span>
        {scale > 0 && <span className="mcal-scale">{p.limit > 0 ? 'Daily budget' : 'Typical day'} {p.fmt(scale)}</span>}
      </div>

      <div className="mcal-foot">
        <div className="mcal-sel">
          <b>{sel === today ? 'Today' : selDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          <span>
            {selSpend > 0 ? `${p.fmt(selSpend)} · ${selCount} spend${selCount === 1 ? '' : 's'}` : 'No everyday spends'}
            {selFixed > 0 && ` · ${p.fmt(selFixed)} fixed`}
          </span>
        </div>
        {p.limit > 0 && (
          <div className="mcal-left">
            <b className={remaining < 0 ? 'neg' : ''}>{p.fmt(Math.abs(remaining))}</b>
            <span>{remaining < 0 ? 'over' : 'left'} · {daysLeft === 1 ? 'last day' : `${daysLeft} days`}</span>
          </div>
        )}
      </div>

      {p.fixed && (
        <button className="safe-fixed" onClick={p.onBudget}>
          <i className="mcal-fx inline" /> {p.fmt(p.fixed.reserved)} set aside for fixed costs · {p.fixed.paid >= p.fixed.reserved ? 'all paid' : `${p.fmt(p.fixed.paid)} paid`}
        </button>
      )}
    </div>
  );
}
