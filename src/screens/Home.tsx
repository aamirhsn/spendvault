import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { addMonths, daysUntil, last4, money, monthKey, monthLabel, nextDayOfMonth, parseISO, todayISO } from '../lib/format';
import { SERIES, SERIES_OTHER, categoryIcon } from '../lib/categories';
import { AreaChart, Bars, Donut, ShareBars, type Point } from '../components/Charts';
import { TxnRow, paymentLabel } from '../components/TxnRow';
import { IAlert, ICard, IGift, IPlus, IScan, ISettings, IStore, IReceipt, IEye, IEyeOff, IFace } from '../components/Icons';
import { Segmented } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const { data, updateSettings, biometricEnabled } = useStore();
  const nav = useNav();
  const { transactions: txns, cards, giftCards, settings } = data;
  const cur = settings.currency;
  const hide = settings.hideAmounts;
  const fmt = (n: number) => money(n, cur, { hide, decimals: false });
  const fmtC = (n: number) => money(n, cur, { hide, compact: true });
  const [range, setRange] = useState<'30' | '90'>('30');

  const today = todayISO();
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);

  const stats = useMemo(() => {
    const dayOfMonth = Number(today.slice(8, 10));
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
        if (Number(t.date.slice(8, 10)) <= dayOfMonth) lastToDate += t.amount;
      }
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const top = cats.slice(0, 4).map(([label, value], i) => ({ label, value, color: SERIES[i], icon: categoryIcon(label) }));
    const rest = cats.slice(4).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) top.push({ label: 'Other', value: rest, color: SERIES_OTHER, icon: '•' });
    const pays = [...byPay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
    return { month, lastToDate, lastFull, count, giftUsed, slices: top, pays, avg: month / dayOfMonth };
  }, [txns, cards, thisMonth, lastMonth, today]);

  const daily = useMemo<Point[]>(() => {
    const days = Number(range);
    const map = new Map<string, number>();
    for (const t of txns) map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
    const out: Point[] = [];
    const end = parseISO(today);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const iso = todayISO(d);
      const tickEvery = days === 30 ? 7 : 30;
      out.push({
        label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        tick: (days - 1 - i) % tickEvery === 0 || i === 0 ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : undefined,
        value: map.get(iso) ?? 0,
      });
    }
    return out;
  }, [txns, today, range]);

  const monthly = useMemo<Point[]>(() => {
    const out: Point[] = [];
    for (let i = 5; i >= 0; i--) {
      const k = addMonths(thisMonth, -i);
      out.push({ label: monthLabel(k), tick: monthLabel(k, true), value: txns.filter((t) => monthKey(t.date) === k).reduce((a, t) => a + t.amount, 0) });
    }
    return out;
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

  const actions = [
    { label: 'Add spend', Icon: IPlus, bg: 'linear-gradient(135deg,#5b8cff,#8a5bff)', on: () => nav.newSpend() },
    { label: 'Scan QR', Icon: IScan, bg: 'linear-gradient(135deg,#00c6fb,#005bea)', on: () => nav.go('scan') },
    { label: 'Gift cards', Icon: IGift, bg: 'linear-gradient(135deg,#ff6a88,#ff99ac)', on: () => nav.go('gifts') },
    { label: 'Cards', Icon: ICard, bg: 'linear-gradient(135deg,#f6a23a,#f05c5c)', on: () => nav.go('cards') },
    { label: 'Spends', Icon: IReceipt, bg: 'linear-gradient(135deg,#11998e,#38ef7d)', on: () => nav.go('spends') },
    { label: 'Merchants', Icon: IStore, bg: 'linear-gradient(135deg,#7f53ac,#647dee)', on: () => nav.go('scan') },
    { label: hide ? 'Show' : 'Hide', Icon: hide ? IEye : IEyeOff, bg: 'linear-gradient(135deg,#434343,#7a7a7a)', on: () => updateSettings({ hideAmounts: !hide }) },
    { label: 'Settings', Icon: ISettings, bg: 'linear-gradient(135deg,#606c88,#3f4c6b)', on: () => nav.openSettings() },
  ];

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <div className="sub" style={{ marginTop: 0, marginBottom: 4 }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting()}{settings.displayName ? `, ${settings.displayName}` : ''}</h1>
        </div>
        <button className="icon-btn" onClick={nav.openSettings} aria-label="Settings"><ISettings /></button>
      </header>

      <div className="stack-lg">
        {!biometricEnabled && (
          <button className="glass tight interactive row" style={{ textAlign: 'left' }} onClick={nav.openSettings}>
            <span className="icon-btn sm" style={{ color: 'var(--accent)' }}><IFace width={18} /></span>
            <span className="grow small"><b>Turn on biometric unlock</b><div className="muted tiny">Unlock with Face ID or fingerprint — set up in Settings.</div></span>
          </button>
        )}

        <section className="glass hero">
          <div className="row between">
            <span className="label">{monthLabel(thisMonth)} spend</span>
            {delta != null && (
              <span className={`delta ${delta > 0 ? 'up' : 'down'}`} title="Compared with the same point last month">
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="big num">{fmt(stats.month)}</div>
          <div className="small muted">
            {stats.count} transaction{stats.count === 1 ? '' : 's'} · last month {fmt(stats.lastFull)}
          </div>
          {budget > 0 && (
            <>
              <div className={`budget-bar ${budgetPct > 100 ? 'over' : ''}`}><div style={{ width: `${Math.min(100, budgetPct)}%` }} /></div>
              <div className="row between tiny muted" style={{ marginTop: 6 }}>
                <span>{budgetPct.toFixed(0)}% of {fmt(budget)} budget</span>
                <span>{budget - stats.month >= 0 ? `${fmt(budget - stats.month)} left` : `${fmt(stats.month - budget)} over`}</span>
              </div>
            </>
          )}
        </section>

        <section className="glass" style={{ padding: 8 }}>
          <div className="grid4">
            {actions.map(({ label, Icon, bg, on }) => (
              <button key={label} className="action" onClick={on}>
                <span className="ic" style={{ background: bg }}><Icon /></span>
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid2">
          <div className="glass stat">
            <div className="k">Daily average</div>
            <div className="v num">{fmt(stats.avg)}</div>
            <div className="s">this month</div>
          </div>
          <div className="glass stat">
            <div className="k">Card dues</div>
            <div className={`v num ${totalDue > 0 ? 'warn' : ''}`}>{fmt(totalDue)}</div>
            <div className="s">{dues.length} card{dues.length === 1 ? '' : 's'} pending</div>
          </div>
          <div className="glass stat">
            <div className="k">Gift card balance</div>
            <div className="v num">{fmt(giftBal)}</div>
            <div className="s">{activeGift.length} active</div>
          </div>
          <div className="glass stat">
            <div className="k">Paid via gift cards</div>
            <div className="v num good">{fmt(stats.giftUsed)}</div>
            <div className="s">this month</div>
          </div>
        </div>

        <section className="glass pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Daily spending</div>
              <div className="tiny muted">Last {range} days</div>
            </div>
            <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30D' }, { value: '90', label: '90D' }]} />
          </div>
          <AreaChart data={daily} format={fmt} />
        </section>

        <section className="glass pad">
          <div style={{ fontWeight: 700, marginBottom: 14 }}>By category <span className="tiny muted">· {monthLabel(thisMonth, true)}</span></div>
          {stats.slices.length ? <Donut slices={stats.slices} format={fmt} centerLabel="Total" /> : <p className="small muted" style={{ margin: 0 }}>No spends this month yet.</p>}
        </section>

        <div className="stack-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <section className="glass pad">
            <div style={{ fontWeight: 700, marginBottom: 20 }}>Last 6 months</div>
            <Bars data={monthly} format={fmtC} highlight={monthly.length - 1} />
          </section>
          <section className="glass pad">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Paid with <span className="tiny muted">· {monthLabel(thisMonth, true)}</span></div>
            {stats.pays.length ? <ShareBars rows={stats.pays} format={fmt} /> : <p className="small muted" style={{ margin: 0 }}>Nothing yet.</p>}
          </section>
        </div>

        {(dues.length > 0 || expiring.length > 0) && (
          <section>
            <div className="section-title"><h2>Upcoming</h2></div>
            <div className="glass list" style={{ marginTop: 8 }}>
              {dues.map(({ c, due, days }) => (
                <button key={c.id} className="list-item" onClick={() => nav.go('cards')}>
                  <span className="emoji">{(c.overdue ?? 0) > 0 ? <IAlert style={{ color: 'var(--bad)' }} /> : '💳'}</span>
                  <span className="grow">
                    <div className="t ellipsis">{c.bank} {c.name} •{last4(c.number)}</div>
                    <div className="d">
                      {(c.overdue ?? 0) > 0 ? <span className="bad">Overdue {fmt(c.overdue!)} · </span> : null}
                      Due {due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </div>
                  </span>
                  <span>
                    <div className="amt num">{fmt((c.totalDue ?? 0) + (c.overdue ?? 0))}</div>
                    <div className={`tiny ${days <= 3 ? 'bad' : days <= 7 ? 'warn' : 'muted'}`} style={{ textAlign: 'right' }}>{days === 0 ? 'Today' : `in ${days}d`}</div>
                  </span>
                </button>
              ))}
              {expiring.map((g) => {
                const d = daysUntil(parseISO(g.expiry));
                return (
                  <button key={g.id} className="list-item" onClick={() => nav.go('gifts')}>
                    <span className="emoji">🎁</span>
                    <span className="grow">
                      <div className="t ellipsis">{g.brand} gift card</div>
                      <div className="d warn">Expires {d === 0 ? 'today' : `in ${d} days`}</div>
                    </span>
                    <span className="amt num">{fmt(g.balance)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="section-title">
            <h2>Recent</h2>
            {txns.length > 0 && <button className="small" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => nav.go('spends')}>See all</button>}
          </div>
          {txns.length ? (
            <div className="glass list" style={{ marginTop: 8 }}>
              {txns.slice(0, 5).map((t) => <TxnRow key={t.id} t={t} cards={cards} settings={settings} onClick={() => nav.editSpend(t)} />)}
            </div>
          ) : (
            <div className="glass empty" style={{ marginTop: 8 }}>
              <div className="big-ic">🧾</div>
              <h3>No spends yet</h3>
              <p className="small" style={{ margin: '0 0 16px' }}>Log your first transaction to see insights here.</p>
              <button className="btn primary" onClick={() => nav.newSpend()}><IPlus /> Add spend</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
