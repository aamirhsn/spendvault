import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { CATEGORIES } from '../lib/categories';
import { addMonths, money, monthKey, monthLabel, prettyDate, todayISO } from '../lib/format';
import { TxnRow, paymentLabel } from '../components/TxnRow';
import { IBack, IChevron, IMessage, IPlus, ISearch } from '../components/Icons';
import { Empty, CBtn } from '../components/ui';

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
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  const total = filtered.reduce((a, t) => a + t.amount, 0);
  const usedCats = new Set(transactions.map((t) => t.category));
  const fmt = (n: number) => money(n, settings.currency, { hide: settings.hideAmounts });

  return (
    <div className="screen">
      <div className="wash" style={{ ['--wash' as string]: '#ffdcc2' }} />
      <header className="topbar">
        <h1>Spends</h1>
        <div className="actions"><CBtn variant="glass" size="lg" icon={<IMessage />} label="Add from messages" onClick={() => nav.openMessages()} /><CBtn variant="glass" size="lg" icon={<IPlus strokeWidth={2.4} />} label="Add spend" onClick={() => nav.newSpend()} /></div>
      </header>

      <div className="stack">
        <div className="card row between" style={{ padding: '6px 8px' }}>
          <button className="glass-btn" style={{ width: 36, height: 36, color: 'var(--tint)', opacity: month === 'all' ? 0.3 : 1 }} disabled={month === 'all'} aria-label="Previous month" onClick={() => month !== 'all' && setMonth(addMonths(month, -1))}><IBack width={18} /></button>
          <button className="center" onClick={() => setMonth(month === 'all' ? monthKey(todayISO()) : 'all')}>
            <div style={{ fontWeight: 600 }}>{month === 'all' ? 'All time' : monthLabel(month)}</div>
            <div className="foot muted num">{filtered.length} spends · {fmt(total)}</div>
          </button>
          <button className="glass-btn" style={{ width: 36, height: 36, color: 'var(--tint)', opacity: month === 'all' ? 0.3 : 1 }} disabled={month === 'all'} aria-label="Next month" onClick={() => month !== 'all' && setMonth(addMonths(month, 1))}><IChevron width={18} /></button>
        </div>

        <div className="search">
          <ISearch />
          <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search spends" />
        </div>

        {usedCats.size > 1 && (
          <div className="chips">
            <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>All</button>
            {CATEGORIES.filter((c) => usedCats.has(c.name)).map((c) => (
              <button key={c.name} className={`chip ${cat === c.name ? 'on' : ''}`} onClick={() => setCat(cat === c.name ? null : c.name)}>{c.icon} {c.name}</button>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <Empty icon="🧾" title={transactions.length ? 'No results' : 'No spends yet'} text={transactions.length ? 'Try another month, category or search.' : 'Log purchases made by card, UPI, cash or gift cards.'} action={<button className="btn primary" onClick={() => nav.newSpend()}>Add spend</button>} />
        ) : (
          <div>
            {groups.map(([date, list]) => (
              <section key={date}>
                <div className="date-h"><span>{prettyDate(date)}</span><span className="num">{fmt(list.reduce((a, t) => a + t.amount, 0))}</span></div>
                <div className="group">{list.map((t) => <TxnRow key={t.id} t={t} cards={cards} merchants={data.merchants} settings={settings} onClick={() => nav.editSpend(t)} />)}</div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
