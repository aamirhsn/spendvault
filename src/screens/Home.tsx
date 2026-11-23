import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { addMonths, daysUntil, money, monthKey, monthLabel, nextDayOfMonth, parseISO, prettyDate, todayISO } from '../lib/format';
import { SERIES, SERIES_OTHER } from '../lib/categories';
import { Bars, Donut, type Point } from '../components/Charts';
import { useDeleteSpend, TxnRow } from '../components/TxnRow';
import { BudgetsSheet } from '../components/Budgets';
import { CatIcon } from '../components/CatIcon';
import { Logo, hasLogo } from '../lib/logos';
import { IChevron, IFace, IMessage, IPie, ISettings } from '../components/Icons';
import { CBtn, NavRow, bioName } from '../components/ui';
import { Insights, SafeToSpend, buildInsights } from '../components/Pulse';
import { TodoEditor, TodoFab, TodoSheet, sortTodos } from '../components/Todos';
import { cardFinishKey, finishFor } from '../lib/finishes';
import type { Todo } from '../lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good Night' : h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

export function Home() {
  const { data, biometricEnabled, vault, requestUnlock } = useStore();
  const nav = useNav();
  const delSpend = useDeleteSpend();
  const { transactions: txns, cards, giftCards, merchants, settings } = data;
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
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;

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
  const byCard = useMemo(() => {
    const m = new Map<string, { spent: number; count: number }>();
    for (const t of txns) {
      if (monthKey(t.date) !== thisMonth || t.payment.type !== 'card' || !t.payment.cardId) continue;
      const net = t.amount - t.giftCards.reduce((a, g) => a + g.amount, 0);
      if (net <= 0) continue;
      const cur = m.get(t.payment.cardId) ?? { spent: 0, count: 0 };
      m.set(t.payment.cardId, { spent: cur.spent + net, count: cur.count + 1 });
    }
    return cards.filter((c) => c.kind === 'credit' && m.has(c.id)).map((c) => ({ c, ...m.get(c.id)! })).sort((a, b) => b.spent - a.spent);
  }, [txns, cards, thisMonth]);
  const cardTotal = byCard.reduce((a, x) => a + x.spent, 0);
  const dueTotal = dues.reduce((a, d) => a + d.owed, 0);
  const expiring = giftCards.filter((g) => !g.archived && g.balance > 0 && g.expiry && daysUntil(parseISO(g.expiry)) >= 0 && daysUntil(parseISO(g.expiry)) <= 30);

  const budget = settings.monthlyBudget;
  const catBudgets = Object.entries(settings.categoryBudgets ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, limit]) => ({ name, limit, spent: stats.byCat.get(name) ?? 0 }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const limitTotal = budget || catBudgets.reduce((a, b) => a + b.limit, 0);
  const spentTotal = budget ? stats.month : catBudgets.reduce((a, b) => a + b.spent, 0);
  const delta = stats.lastToDate > 0 ? ((stats.month - stats.lastToDate) / stats.lastToDate) * 100 : null;

  const inScope = (cat: string) => !!budget || catBudgets.some((b) => b.name === cat);
  const spentToday = txns.filter((t) => t.date === today && (limitTotal ? inScope(t.category) : true)).reduce((a, t) => a + t.amount, 0);
  const insights = useMemo(
    () => buildInsights({ txns, giftCards, dues, monthTotal: stats.month, lastToDate: stats.lastToDate, top: stats.top, fmt, go: { cards: () => nav.go('cards'), gifts: () => nav.go('gifts'), spends: () => nav.go('spends') } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, giftCards, dues, stats, hide, cur],
  );

  const recent = txns.slice(0, 8);
  const recentGroups: [string, typeof recent][] = [];
  for (const t of recent) {
    const g = recentGroups.find(([d]) => d === t.date);
    if (g) g[1].push(t);
    else recentGroups.push([t.date, [t]]);
  }

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
        <p>Today is {ordinal(now.getDate())} {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.{daysLeft > 1 ? ` ${daysLeft} days left this month.` : ' Last day of the month.'}</p>
      </div>

      <div className="stack-lg">
        <SafeToSpend limit={limitTotal} spent={spentTotal} spentToday={spentToday} monthTotal={stats.month} delta={delta} fmt={fmt} onBudget={() => setBudgets(true)} />
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
                      <div className="st">{daysLeft} days left · <span style={{ color: p > 100 ? 'var(--red)' : undefined }}>{p.toFixed(0)}% spent</span></div>
                    </span>
                    <span className="amt-col">
                      <div className="a" style={{ color: b.limit - b.spent < 0 ? 'var(--red)' : undefined }}>{fmt(Math.abs(b.limit - b.spent))}</div>
                      <div className="b">{b.limit - b.spent >= 0 ? 'left this month' : 'over'}</div>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="group"><NavRow icon={<IPie />} iconBg="var(--tint)" title={limitTotal ? 'Add category budgets' : 'Set monthly budgets'} subtitle={limitTotal ? 'Track Food, Fuel, Shopping… separately' : 'Overall and per category — Food, Fuel, Shopping…'} onClick={() => setBudgets(true)} /></div>
          )}
        </section>

        {byCard.length > 0 && (
          <section>
            <div className="section-label">Spend by card · {monthLabel(thisMonth, true)} <button className="link" onClick={() => nav.go('cards')}>Cards <IChevron width={13} /></button></div>
            <div className="card" style={{ padding: '6px 0' }}>
              {byCard.map(({ c, spent, count }) => (
                <div key={c.id} className="cell" style={{ ['--inset' as string]: '66px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', rowGap: 6 }}>
                  <span className="mini-card" style={{ background: finishFor(cardFinishKey(c)).bg, width: 38, height: 25, gridRow: 'span 2' }} />
                  <span className="ellipsis" style={{ fontWeight: 500 }}>{c.name || c.bank} <span className="muted">••{c.last4}</span></span>
                  <b className="num" style={{ textAlign: 'right' }}>{fmt(spent)}</b>
                  <div className="bar" style={{ gridColumn: '2 / 4', height: 5 }}><div style={{ width: `${(spent / byCard[0].spent) * 100}%`, background: 'var(--s1)' }} /></div>
                  <span />
                  <span className="foot muted" style={{ gridColumn: '2 / 4', marginTop: -2 }}>
                    {count} spend{count === 1 ? '' : 's'} · {Math.round((spent / cardTotal) * 100)}% of card spends{c.creditLimit ? ` · ${((spent / c.creditLimit) * 100).toFixed(1)}% of limit` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(dues.length > 0 || expiring.length > 0) && (
          <section>
            <div className="section-label">Coming up <button className="link" onClick={() => nav.go('cards')}>Cards <IChevron width={13} /></button></div>
            <div className="card">
              {dues.length > 0 && (
                <div style={{ padding: '16px 16px 6px' }}>
                  <div className="label-xs">Card bills due</div>
                  <div className="giant num neg" style={{ fontSize: 34, marginTop: 6 }}>{fmt(dueTotal)}</div>
                </div>
              )}
              {dues.map(({ c, due, days, owed }) => (
                <button key={c.id} className="cell" style={{ ['--inset' as string]: '68px' }} onClick={() => nav.go('cards')}>
                  <span className="logo-round">{hasLogo(c.bank, data.logos) ? <Logo name={c.bank} preferMark /> : <b>{c.bank.slice(0, 1)}</b>}</span>
                  <span className="grow">
                    <div className="t ellipsis" style={{ fontWeight: 500 }}>{c.name || c.bank}</div>
                    <div className="st">Due {due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ••{c.last4}</div>
                  </span>
                  <span className="amt-col">
                    <div className="a neg">{fmt(owed)}</div>
                    <div style={{ marginTop: 3 }}>{(c.overdue ?? 0) > 0 ? <span className="tag bad">Overdue</span> : days <= 1 ? <span className="tag warn">{days === 0 ? 'Today' : 'Tomorrow'}</span> : days <= 7 ? <span className="tag warn">{days} days</span> : <span className="tag gray">{days} days</span>}</div>
                  </span>
                </button>
              ))}
              {expiring.map((g) => (
                <button key={g.id} className="cell" style={{ ['--inset' as string]: '68px' }} onClick={() => nav.go('gifts')}>
                  <span className="logo-round">{hasLogo(g.brand, data.logos) ? <Logo name={g.brand} /> : <b>{g.brand.slice(0, 1)}</b>}</span>
                  <span className="grow"><div className="t ellipsis" style={{ fontWeight: 500 }}>{g.brand} gift card</div><div className="st">Use it before it expires</div></span>
                  <span className="amt-col"><div className="a">{fmt(g.balance)}</div><div style={{ marginTop: 3 }}><span className="tag warn">{daysUntil(parseISO(g.expiry))} days left</span></div></span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="cols">
          <section>
            <div className="section-label">Categories · {monthLabel(thisMonth, true)}</div>
            <div className="card pad">
              {stats.slices.length ? <Donut slices={stats.slices} format={fmt} centerLabel="Total" size={128} /> : <p className="muted small" style={{ margin: 0 }}>No spends this month yet.</p>}
            </div>
          </section>
          <section>
            <div className="section-label">Last 6 months</div>
            <div className="card pad" style={{ paddingTop: 26 }}><Bars data={monthly} format={fmtC} highlight={monthly.length - 1} height={128} /></div>
          </section>
        </div>

        <section>
          <div className="section-label">Recent {txns.length > 0 && <button className="link" onClick={() => nav.go('spends')}>See all <IChevron width={13} /></button>}</div>
          {recentGroups.length ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              {recentGroups.map(([date, list]) => (
                <div key={date}>
                  <div className="row between" style={{ padding: '14px 16px 4px' }}>
                    <b style={{ fontSize: 15 }}>{prettyDate(date)}</b>
                    <span className="foot muted num">{fmt(list.reduce((a, t) => a + t.amount, 0))}</span>
                  </div>
                  {list.map((t) => <TxnRow key={t.id} t={t} cards={cards} merchants={merchants} settings={settings} onClick={() => nav.editSpend(t)} onDelete={() => delSpend(t)} />)}
                </div>
              ))}
            </div>
          ) : (
            <div className="group"><NavRow title="Log your first spend" subtitle="Tap + to add one" onClick={() => nav.newSpend()} /></div>
          )}
        </section>
      </div>
      <BudgetsSheet open={budgets} onClose={() => setBudgets(false)} />
      {todoSheet && <TodoSheet onClose={() => setTodoSheet(false)} />}
      {todoEdit && <TodoEditor todo={todoEdit} onClose={() => setTodoEdit(null)} />}
    </div>
  );
}
