import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { addMonths, daysUntil, money, monthKey, monthLabel, nextDayOfMonth, parseISO, todayISO } from '../lib/format';
import { SERIES, SERIES_OTHER, categoryIcon } from '../lib/categories';
import { AreaChart, Bars, Donut, ShareBars, type Point } from '../components/Charts';
import { TxnRow, paymentLabel } from '../components/TxnRow';
import { BudgetsSheet, budgetColor } from '../components/Budgets';
import { IFace, ISettings } from '../components/Icons';
import { Group, NavRow, Segmented } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const { data, biometricEnabled } = useStore();
  const nav = useNav();
  const { transactions: txns, cards, giftCards, settings } = data;
  const cur = settings.currency;
  const hide = settings.hideAmounts;
  const fmt = (n: number) => money(n, cur, { hide, decimals: false });
  const fmtC = (n: number) => money(n, cur, { hide, compact: true });
  const [range, setRange] = useState<'30' | '90'>('30');
  const [budgets, setBudgets] = useState(false);

  const today = todayISO();
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);

  const stats = useMemo(() => {
    const dom = Number(today.slice(8, 10));
    let month = 0, lastToDate = 0, lastFull = 0, count = 0, giftUsed = 0;
    const byCat = new Map<string, number>();
    const byPay = new Map<string, number>();
    for (const t of txns) {
      const mk = monthKey(t.date);
      if (mk === thisMonth) {
        month += t.amount;
        count++;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
        const gift = t.giftCards.reduce((a, g) => a + g.amount, 0);
        giftUsed += gift;
        const lbl = paymentLabel(t, cards);
        if (t.amount - gift > 0) byPay.set(lbl, (byPay.get(lbl) ?? 0) + t.amount - gift);
        if (gift > 0) byPay.set('Gift cards', (byPay.get('Gift cards') ?? 0) + gift);
      } else if (mk === lastMonth) {
        lastFull += t.amount;
        if (Number(t.date.slice(8, 10)) <= dom) lastToDate += t.amount;
      }
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const slices = cats.slice(0, 4).map(([label, value], i) => ({ label, value, color: SERIES[i], icon: categoryIcon(label) }));
    const rest = cats.slice(4).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) slices.push({ label: 'Other', value: rest, color: SERIES_OTHER, icon: '•' });
    const pays = [...byPay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
    return { month, lastToDate, lastFull, count, giftUsed, slices, pays, byCat, avg: month / dom };
  }, [txns, cards, thisMonth, lastMonth, today]);

  const daily = useMemo<Point[]>(() => {
    const days = Number(range);
    const map = new Map<string, number>();
    for (const t of txns) map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
    const out: Point[] = [];
    const end = parseISO(today);
    const every = days === 30 ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const lbl = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      out.push({ label: lbl, tick: (days - 1 - i) % every === 0 ? lbl : undefined, value: map.get(todayISO(d)) ?? 0 });
    }
    return out;
  }, [txns, today, range]);

  const monthly = useMemo<Point[]>(() => {
    const totals = new Map<string, number>();
    for (const t of txns) totals.set(monthKey(t.date), (totals.get(monthKey(t.date)) ?? 0) + t.amount);
    return Array.from({ length: 6 }, (_, i) => {
      const k = addMonths(thisMonth, i - 5);
      return { label: monthLabel(k), tick: monthLabel(k, true), value: totals.get(k) ?? 0 };
    });
  }, [txns, thisMonth]);

  const dues = useMemo(
    () =>
      cards
        .filter((c) => c.kind === 'credit' && c.dueDay && ((c.totalDue ?? 0) > 0 || (c.overdue ?? 0) > 0))
        .map((c) => {
          const due = nextDayOfMonth(c.dueDay!);
          return { c, due, days: daysUntil(due) };
        })
        .sort((a, b) => (b.c.overdue ?? 0) - (a.c.overdue ?? 0) || a.days - b.days),
    [cards],
  );
  const totalDue = cards.reduce((a, c) => a + (c.kind === 'credit' ? (c.totalDue ?? 0) + (c.overdue ?? 0) : 0), 0);
  const activeGift = giftCards.filter((g) => !g.archived && g.balance > 0);
  const giftBal = activeGift.reduce((a, g) => a + g.balance, 0);
  const expiring = activeGift.filter((g) => g.expiry && daysUntil(parseISO(g.expiry)) <= 30 && daysUntil(parseISO(g.expiry)) >= 0);

  const delta = stats.lastToDate > 0 ? ((stats.month - stats.lastToDate) / stats.lastToDate) * 100 : null;
  const budget = settings.monthlyBudget;
  const budgetPct = budget > 0 ? (stats.month / budget) * 100 : 0;
  const catBudgets = Object.entries(settings.categoryBudgets ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, limit]) => ({ name, limit, spent: stats.byCat.get(name) ?? 0 }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{settings.displayName ? `Hi, ${settings.displayName}` : greeting()}</h1>
        </div>
        <div className="actions">
          <button className="glass-btn liquid" onClick={nav.openSettings} aria-label="Settings"><ISettings /></button>
        </div>
      </header>

      <div className="stack-lg">
        {!biometricEnabled && (
          <div className="group">
            <NavRow icon={<IFace />} iconBg="var(--green)" title="Turn on Face ID / Touch ID" subtitle="Unlock faster and reveal cards securely" onClick={nav.openSettings} />
          </div>
        )}

        <div className="card hero">
          <div className="row between">
            <span className="k">Spent in {monthLabel(thisMonth, true)}</span>
            {delta != null && <span className={`pill ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs last month</span>}
          </div>
          <div className="big num">{fmt(stats.month)}</div>
          <div className="foot muted">{stats.count} transaction{stats.count === 1 ? '' : 's'} · {fmt(stats.avg)}/day</div>
          {budget > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="bar"><div style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetColor(budgetPct) }} /></div>
              <div className="row between foot muted" style={{ marginTop: 6 }}>
                <span>{budgetPct.toFixed(0)}% of {fmt(budget)}</span>
                <span>{budget >= stats.month ? `${fmt(budget - stats.month)} left` : <span className="bad">{fmt(stats.month - budget)} over</span>}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid2">
          <button className="card stat" style={{ textAlign: 'left' }} onClick={() => nav.go('cards')}>
            <div className="k">Card dues</div>
            <div className={`v num ${totalDue > 0 ? 'warn' : ''}`}>{fmt(totalDue)}</div>
            <div className="s">{dues.length ? `${dues.length} card${dues.length === 1 ? '' : 's'} to pay` : 'All clear'}</div>
          </button>
          <button className="card stat" style={{ textAlign: 'left' }} onClick={() => nav.go('gifts')}>
            <div className="k">Gift cards</div>
            <div className="v num">{fmt(giftBal)}</div>
            <div className="s">{stats.giftUsed > 0 ? `${fmt(stats.giftUsed)} used this month` : `${activeGift.length} active`}</div>
          </button>
        </div>

        <section>
          <div className="section-h"><h2>Budgets</h2><button className="link" onClick={() => setBudgets(true)}>{catBudgets.length ? 'Edit' : 'Set up'}</button></div>
          {catBudgets.length ? (
            <div className="card pad stack" style={{ gap: 14 }}>
              {catBudgets.map((b) => {
                const pct = (b.spent / b.limit) * 100;
                return (
                  <div key={b.name}>
                    <div className="row between" style={{ marginBottom: 6, fontSize: 15 }}>
                      <span className="ellipsis">{categoryIcon(b.name)} {b.name}</span>
                      <span className="num" style={{ whiteSpace: 'nowrap' }}><b>{fmt(b.spent)}</b> <span className="muted">/ {fmt(b.limit)}</span></span>
                    </div>
                    <div className="bar"><div style={{ width: `${Math.min(100, pct)}%`, background: budgetColor(pct) }} /></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="group"><NavRow title="Set monthly budgets per category" subtitle="Track Food, Shopping, Fuel and more against a limit" onClick={() => setBudgets(true)} /></div>
          )}
        </section>

        <section>
          <div className="section-h"><h2>Spending</h2><Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30D' }, { value: '90', label: '90D' }]} /></div>
          <div className="card pad"><AreaChart data={daily} format={fmt} /></div>
        </section>

        <div className="cols">
          <section>
            <div className="section-h"><h2>Categories</h2></div>
            <div className="card pad">
              {stats.slices.length ? <Donut slices={stats.slices} format={fmt} centerLabel={monthLabel(thisMonth, true)} size={132} /> : <p className="muted small" style={{ margin: 0 }}>No spends this month yet.</p>}
            </div>
          </section>
          <section>
            <div className="section-h"><h2>Monthly</h2></div>
            <div className="card pad" style={{ paddingTop: 26 }}><Bars data={monthly} format={fmtC} highlight={monthly.length - 1} height={132} /></div>
          </section>
        </div>

        {stats.pays.length > 0 && (
          <section>
            <div className="section-h"><h2>Paid with</h2></div>
            <div className="card pad"><ShareBars rows={stats.pays} format={fmt} /></div>
          </section>
        )}

        {(dues.length > 0 || expiring.length > 0) && (
          <Group header="Upcoming">
            {dues.map(({ c, due, days }) => (
              <NavRow key={c.id} title={`${c.name || c.bank} bill`} subtitle={(c.overdue ?? 0) > 0 ? <span className="bad">{fmt(c.overdue!)} overdue</span> : `Due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                value={<span><b style={{ color: 'var(--label)' }}>{fmt((c.totalDue ?? 0) + (c.overdue ?? 0))}</b><div className={`foot ${days <= 3 ? 'bad' : days <= 7 ? 'warn' : ''}`}>{days === 0 ? 'Today' : `in ${days}d`}</div></span>}
                onClick={() => nav.go('cards')} />
            ))}
            {expiring.map((g) => {
              const d = daysUntil(parseISO(g.expiry));
              return <NavRow key={g.id} title={`${g.brand} gift card`} subtitle={<span className="warn">Expires {d === 0 ? 'today' : `in ${d} days`}</span>} value={fmt(g.balance)} onClick={() => nav.go('gifts')} />;
            })}
          </Group>
        )}

        <section>
          <div className="section-h"><h2>Recent</h2>{txns.length > 0 && <button className="link" onClick={() => nav.go('spends')}>See all</button>}</div>
          {txns.length ? (
            <div className="group">{txns.slice(0, 5).map((t) => <TxnRow key={t.id} t={t} cards={cards} settings={settings} onClick={() => nav.editSpend(t)} />)}</div>
          ) : (
            <div className="group"><NavRow title="Add your first spend" subtitle="Your insights will appear here" onClick={() => nav.newSpend()} /></div>
          )}
        </section>
      </div>
      <BudgetsSheet open={budgets} onClose={() => setBudgets(false)} />
    </div>
  );
}
