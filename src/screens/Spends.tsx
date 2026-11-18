import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { CATEGORIES } from '../lib/categories';
import { addMonths, money, monthKey, monthLabel, prettyDate, todayISO } from '../lib/format';
import { TxnRow, paymentLabel } from '../components/TxnRow';
import { IBack, IChevron, IPlus, ISearch } from '../components/Icons';
import { Empty } from '../components/ui';

export function Spends() {
  const { data } = useStore();
  const nav = useNav();
  const { transactions, cards, settings } = data;
  const [month, setMonth] = useState<string | 'all'>(monthKey(todayISO()));
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (month === 'all' || monthKey(t.date) === month) &&
        (!cat || t.category === cat) &&
        (!s || [t.description, t.notes, t.category, paymentLabel(t, cards), String(t.amount)].some((x) => x.toLowerCase().includes(s))),
    );
  }, [transactions, cards, month, cat, q]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    }
    return [...m.entries()];
  }, [filtered]);

  const total = filtered.reduce((a, t) => a + t.amount, 0);
  const usedCats = new Set(transactions.map((t) => t.category));
  const fmt = (n: number) => money(n, settings.currency, { hide: settings.hideAmounts });

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <h1>Spends</h1>
          <div className="sub">{filtered.length} transactions · <b className="num">{fmt(total)}</b></div>
        </div>
        <button className="icon-btn" onClick={() => nav.newSpend()} aria-label="Add spend" style={{ color: 'var(--accent)' }}><IPlus /></button>
      </header>

      <div className="stack">
        <div className="glass row between" style={{ padding: 6, borderRadius: 999 }}>
          <button className="icon-btn sm" aria-label="Previous month" disabled={month === 'all'} onClick={() => month !== 'all' && setMonth(addMonths(month, -1))}><IBack width={18} /></button>
          <button className="small" style={{ fontWeight: 650 }} onClick={() => setMonth(month === 'all' ? monthKey(todayISO()) : 'all')}>
            {month === 'all' ? 'All time' : monthLabel(month)} <span className="faint tiny">· tap for {month === 'all' ? 'this month' : 'all'}</span>
          </button>
          <button className="icon-btn sm" aria-label="Next month" disabled={month === 'all'} onClick={() => month !== 'all' && setMonth(addMonths(month, 1))}><IChevron width={18} /></button>
        </div>

        <div className="input-wrap">
          <input className="input" style={{ paddingLeft: 42, borderRadius: 999 }} placeholder="Search description, notes, card…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search spends" />
          <ISearch style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-3)' }} width={20} />
        </div>

        <div className="chips">
          <button className={`filter-chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>All</button>
          {CATEGORIES.filter((c) => usedCats.has(c.name)).map((c) => (
            <button key={c.name} className={`filter-chip ${cat === c.name ? 'on' : ''}`} onClick={() => setCat(cat === c.name ? null : c.name)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <Empty
            icon="🧾"
            title={transactions.length ? 'Nothing matches' : 'No spends yet'}
            text={transactions.length ? 'Try a different month, category or search.' : 'Track purchases with card, UPI, cash or gift cards.'}
            action={<button className="btn primary" onClick={() => nav.newSpend()}><IPlus /> Add spend</button>}
          />
        ) : (
          groups.map(([date, list]) => (
            <div key={date}>
              <div className="date-head">
                <span>{prettyDate(date)}</span>
                <span className="num">{fmt(list.reduce((a, t) => a + t.amount, 0))}</span>
              </div>
              <div className="glass list">
                {list.map((t) => <TxnRow key={t.id} t={t} cards={cards} settings={settings} onClick={() => nav.editSpend(t)} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
