import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { addMonths, daysUntil, money, monthKey, monthLabel, nextDayOfMonth, todayISO } from '../lib/format';
import { SERIES, SERIES_OTHER } from '../lib/categories';
import { Bars, type Point } from '../components/Charts';
import { BudgetsSheet, budgetColor, fixedCats } from '../components/Budgets';
import { CatIcon } from '../components/CatIcon';
import { IChevron, IFace, IMessage, IPie, ISettings } from '../components/Icons';
import { CBtn, NavRow, bioName } from '../components/ui';
import { Insights, buildInsights } from '../components/Pulse';
import { MonthCal } from '../components/MonthCal';
import { UtilMatrix } from '../components/UtilMatrix';
import { TodoEditor, TodoFab, TodoSheet, sortTodos } from '../components/Todos';
import type { Todo } from '../lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good Night' : h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

export function Home() {
  const { data, biometricEnabled, vault, requestUnlock } = useStore();
  const nav = useNav();
  const { transactions: txns, cards, giftCards, settings } = data;
  const cur = settings.currency;
  const hide = settings.hideAmounts;
  const fmt = (n: number) => money(n, cur, { hide, decimals: false });
  const fmtC = (n: number) => money(n, cur, { hide, compact: true });
  const [budgets, setBudgets] = useState(false);
  const [todoSheet, setTodoSheet] = useState(false);
  const [todoEdit, setTodoEdit] = useState<Todo | null>(null);
  const openTodos = useMemo(() => sortTodos((data.todos ?? []).filter((t) => !t.done)), [data.todos]);

  const today = todayISO();
  const now = new Date();
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);

  const stats = useMemo(() => {
    const dom = Number(today.slice(8, 10));
    let month = 0, lastToDate = 0, count = 0;
    const byCat = new Map<string, number>();
    for (const t of txns) {
      const mk = monthKey(t.date);
      if (mk === thisMonth) {
        month += t.amount;
        count++;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
      } else if (mk === lastMonth && Number(t.date.slice(8, 10)) <= dom) lastToDate += t.amount;
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const slices = cats.slice(0, 4).map(([label, value], i) => ({ label, value, color: SERIES[i] }));
    const rest = cats.slice(4).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) slices.push({ label: 'Other', value: rest, color: SERIES_OTHER });
    return { month, lastToDate, count, byCat, top: cats[0], slices };
  }, [txns, thisMonth, lastMonth, today]);

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
        .map((c) => ({ c, due: nextDayOfMonth(c.dueDay!), days: daysUntil(nextDayOfMonth(c.dueDay!)), owed: (c.totalDue ?? 0) + (c.overdue ?? 0) }))
        .sort((a, b) => (b.c.overdue ?? 0) - (a.c.overdue ?? 0) || a.days - b.days),
    [cards],
  );

  const budget = settings.monthlyBudget;
  const catBudgets = Object.entries(settings.categoryBudgets ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, limit]) => ({ name, limit, spent: stats.byCat.get(name) ?? 0 }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const limitTotal = budget || catBudgets.reduce((a, b) => a + b.limit, 0);

  // Safe to spend works on everyday spending only: fixed lump sums (rent, EMIs…) are set aside first.
  const fixed = fixedCats(settings);
  const catBudget = settings.categoryBudgets ?? {};
  const spentIn = (c: string) => stats.byCat.get(c) ?? 0;
  const fixedScope = [...fixed].filter((c) => (budget ? true : (catBudget[c] ?? 0) > 0));
  const fixedPaid = fixedScope.reduce((a, c) => a + spentIn(c), 0);
  const fixedReserved = fixedScope.reduce((a, c) => a + Math.max(catBudget[c] ?? 0, spentIn(c)), 0);
  const varLimit = budget ? Math.max(0, budget - fixedReserved) : catBudgets.filter((b) => !fixed.has(b.name)).reduce((a, b) => a + b.limit, 0);
  // Everyday spending = everything that isn't a fixed cost, budgeted category or not.
  const varSpent = [...stats.byCat.entries()].filter(([c]) => !fixed.has(c)).reduce((a, [, v]) => a + v, 0);
  const insights = useMemo(
    () => buildInsights({ txns, giftCards, dues, monthTotal: stats.month, lastToDate: stats.lastToDate, top: stats.top, fmt, go: { cards: () => nav.go('cards'), gifts: () => nav.go('gifts'), spends: () => nav.go('spends') } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, giftCards, dues, stats, hide, cur],
  );


  return (
    <div className="screen">
      <TodoFab open={openTodos.length} due={openTodos.filter((t) => t.due && t.due <= today).length} onClick={() => setTodoSheet(true)} />
      <div className="wash" style={{ ['--wash' as string]: '#c9dcff' }} />
      <header className="topbar" style={{ minHeight: 44, margin: '0 0 6px' }}>
        <span />
        <div className="actions">
          <CBtn variant="glass" size="lg" icon={<IMessage />} label="Paste bank SMS" onClick={nav.pasteMessages} />
          <CBtn variant="glass" size="lg" icon={<ISettings />} label="Settings" onClick={nav.openSettings} />
        </div>
      </header>

      <div className="greet" style={{ margin: '0 4px 20px' }}>
        <h1>{greeting()}{settings.displayName ? `, ${settings.displayName}` : ''}</h1>
        <p>Today is {ordinal(now.getDate())} {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.</p>
      </div>

      <div className="stack-lg">
        <MonthCal txns={txns} isFixed={(c) => fixed.has(c)} limit={varLimit} spent={varSpent} hasBudget={limitTotal > 0} fixed={fixedReserved > 0 ? { reserved: fixedReserved, paid: fixedPaid } : undefined} fmt={fmt} onBudget={() => setBudgets(true)} />
        <Insights items={insights} />

        {vault === 'none' && (data.cards.length > 0 || data.giftCards.length > 0) && (
          <div className="group"><NavRow icon={<IFace />} iconBg="var(--tint)" title="Protect your cards with a PIN" subtitle="Keeps card numbers and gift codes private" onClick={() => requestUnlock('Create a PIN for your cards')} /></div>
        )}
        {vault !== 'none' && !biometricEnabled && (
          <div className="group"><NavRow icon={<IFace />} iconBg="var(--tint)" title={`Use ${bioName()} for your cards`} subtitle="Faster than typing your PIN" onClick={nav.openSettings} /></div>
        )}

        <section>
          <div className="section-label">Budgets <button className="link" onClick={() => setBudgets(true)}>{limitTotal ? 'Edit' : 'Set up'} <IChevron width={13} /></button></div>
          {catBudgets.length ? (
            <div className="card">
              {catBudgets.map((b) => {
                const p = (b.spent / b.limit) * 100;
                return (
                  <div key={b.name} className="cell" style={{ ['--inset' as string]: '68px' }}>
                    <CatIcon name={b.name} size={40} />
                    <span className="grow">
                      <div className="t ellipsis" style={{ fontWeight: 500 }}>{b.name}</div>
                      <div className="bud-prog">
                        <div className="bar"><div style={{ width: `${Math.min(100, Math.max(p, p > 0 ? 3 : 0))}%`, background: budgetColor(p) }} /></div>
                        <span style={{ color: p > 100 ? 'var(--red)' : undefined }}>{p.toFixed(0)}%</span>
                      </div>
                    </span>
                    <span className="amt-col">
                      <div className="a" style={{ color: b.limit - b.spent < 0 ? 'var(--red)' : undefined }}>{fmt(Math.abs(b.limit - b.spent))}</div>
                      <div className="b">{b.limit - b.spent >= 0 ? `left of ${fmt(b.limit)}` : `over ${fmt(b.limit)}`}</div>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="group"><NavRow icon={<IPie />} iconBg="var(--tint)" title={limitTotal ? 'Add category budgets' : 'Set monthly budgets'} subtitle={limitTotal ? 'Track Food, Fuel, Shopping… separately' : 'Overall and per category — Food, Fuel, Shopping…'} onClick={() => setBudgets(true)} /></div>
          )}
        </section>

        {cards.some((c) => c.kind === 'credit') && (
          <section>
            <div className="section-label">Card utilisation <button className="link" onClick={() => nav.go('cards')}>Cards <IChevron width={13} /></button></div>
            <UtilMatrix cards={cards} txns={txns} fmt={fmt} onOpen={() => nav.go('cards')} />
          </section>
        )}

        <section>
          <div className="section-label">Last 6 months</div>
          <div className="card pad" style={{ paddingTop: 26 }}><Bars data={monthly} format={fmtC} highlight={monthly.length - 1} height={128} /></div>
        </section>
      </div>
      <BudgetsSheet open={budgets} onClose={() => setBudgets(false)} />
      {todoSheet && <TodoSheet onClose={() => setTodoSheet(false)} />}
      {todoEdit && <TodoEditor todo={todoEdit} onClose={() => setTodoEdit(null)} />}
    </div>
  );
}
