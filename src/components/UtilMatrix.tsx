import { useMemo } from 'react';
import type { PaymentCard, Transaction } from '../lib/types';
import { parseISO, todayISO } from '../lib/format';
import { cardFinishKey, finishFor } from '../lib/finishes';

/* Card × day utilisation heatmap.
   Rows are credit cards, columns are the last 14 days plus the next 7. A cell's colour is the card's
   estimated utilisation that day: spends logged since the card's last statement, plus any billed amount
   still unpaid, divided by the credit limit. A flag marks each card's statement date — the day bureaus
   usually snapshot utilisation — so you can pay down a card just before it. */

const BACK = 13;
const AHEAD = 7;
const DAYS = BACK + 1 + AHEAD;

const level = (u: number) => (u <= 0 ? 0 : u < 0.15 ? 1 : u < 0.3 ? 2 : u < 0.5 ? 3 : 4);
const LEVEL_TXT = ['', 'Under 15%', '15–30%', '30–50%', 'Over 50%'];

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** The card's statement date in a given month (clamped for short months). */
const stmtIn = (y: number, m: number, sd: number) => new Date(y, m, Math.min(sd, dim(y, m)));
/** First day of the cycle that contains `d` (the day after the previous statement). */
function cycleStart(d: Date, sd?: number) {
  if (!sd) return new Date(d.getFullYear(), d.getMonth(), 1);
  const here = stmtIn(d.getFullYear(), d.getMonth(), sd);
  const prev = d > here ? here : stmtIn(d.getFullYear(), d.getMonth() - 1, sd);
  return addDays(prev, 1);
}
const isStmt = (d: Date, sd?: number) => !!sd && d.getDate() === Math.min(sd, dim(d.getFullYear(), d.getMonth()));

export function UtilMatrix({ cards, txns, fmt, onOpen }: { cards: PaymentCard[]; txns: Transaction[]; fmt: (n: number) => string; onOpen(): void }) {
  const model = useMemo(() => {
    const today = parseISO(todayISO());
    const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i - BACK));
    const credit = cards.filter((c) => c.kind === 'credit');
    const withLimit = credit.filter((c) => (c.creditLimit ?? 0) > 0);

    const rows = withLimit.map((c) => {
      const spends = new Map<string, number>();
      for (const t of txns) {
        if (t.payment.type !== 'card' || t.payment.cardId !== c.id) continue;
        const net = t.amount - t.giftCards.reduce((a, g) => a + g.amount, 0);
        if (net > 0) spends.set(t.date, (spends.get(t.date) ?? 0) + net);
      }
      const curStart = cycleStart(today, c.statementDay);
      const paid = !!c.lastPaid && parseISO(c.lastPaid) >= curStart;
      const carried = paid ? 0 : (c.totalDue ?? 0) + (c.overdue ?? 0);
      const limit = c.creditLimit!;
      const balanceOn = (d: Date) => {
        const start = cycleStart(d, c.statementDay);
        let sum = 0;
        for (let x = new Date(start); x <= d; x = addDays(x, 1)) sum += spends.get(todayISO(x)) ?? 0;
        return sum + (start.getTime() === curStart.getTime() ? carried : 0);
      };
      const cells = days.map((d) => {
        const future = d > today;
        const bal = future ? 0 : balanceOn(d);
        return { iso: todayISO(d), future, u: bal / limit, bal, flag: isStmt(d, c.statementDay) };
      });
      const now = cells[BACK];
      // Next statement within the visible window, for the repayment tip.
      const nextIdx = cells.findIndex((x, i) => i > BACK && x.flag);
      return { c, cells, now, limit, nextStmt: nextIdx > 0 ? days[nextIdx] : null };
    }).sort((a, b) => b.now.u - a.now.u);

    // Most useful action: a card with a statement coming up while it would report 30%+.
    const urgent = rows
      .filter((r) => r.nextStmt && r.now.u >= 0.3)
      .sort((a, b) => a.nextStmt!.getTime() - b.nextStmt!.getTime())[0];
    const tip = urgent
      ? { r: urgent, pay: Math.ceil((urgent.now.bal - urgent.limit * 0.29) / 100) * 100 }
      : null;
    return { days, rows, missing: credit.length - withLimit.length, tip, today };
  }, [cards, txns]);

  const { days, rows, missing, tip } = model;
  if (!rows.length) {
    return missing ? (
      <div className="card umx">
        <p className="foot muted" style={{ margin: 0 }}>Add a credit limit and statement day to your credit cards to see daily utilisation here.</p>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={onOpen}>Open Cards</button>
      </div>
    ) : null;
  }
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className="card umx">
      <div className="umx-grid" style={{ gridTemplateColumns: `84px repeat(${DAYS}, minmax(0, 1fr)) 38px` }}>
        {/* header */}
        <span />
        {days.map((d, i) => (
          <span key={i} className={`umx-h${i === BACK ? ' today' : ''}`}>{i === BACK ? 'Today' : i === 0 || i === 6 || i === DAYS - 1 ? d.getDate() : ''}</span>
        ))}
        <span className="umx-h now">Now</span>

        {rows.map(({ c, cells, now }) => {
          const f = finishFor(cardFinishKey(c));
          return (
            <div key={c.id} className="umx-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
              <span className="umx-name">
                <i style={{ background: f.bg }} />
                <span className="ellipsis">{c.name || c.bank}</span>
              </span>
              {cells.map((x, i) => (
                <span
                  key={x.iso}
                  className={`umx-c${x.future ? ' fut' : ''}${i === BACK ? ' td' : ''}`}
                  data-l={x.future ? undefined : level(x.u)}
                  title={`${c.name || c.bank} · ${fmtDay(days[i])}: ${x.future ? 'upcoming' : `${Math.round(x.u * 100)}% (${fmt(x.bal)})`}${x.flag ? ' · statement' : ''}`}
                >
                  {x.flag && (
                    <svg viewBox="0 0 10 12" className="umx-flag" aria-label="Statement date">
                      <path d="M1.5 11.5V1M1.5 1.5h6.2l-1.4 2.2 1.4 2.2H1.5" />
                    </svg>
                  )}
                </span>
              ))}
              <span className="umx-now" data-l={level(now.u)}>{Math.round(now.u * 100)}%</span>
            </div>
          );
        })}
      </div>

      <div className="umx-legend">
        {[1, 2, 3, 4].map((l) => <span key={l}><i data-l={l} />{LEVEL_TXT[l]}</span>)}
        <span>
          <svg viewBox="0 0 10 12" className="umx-flag inline"><path d="M1.5 11.5V1M1.5 1.5h6.2l-1.4 2.2 1.4 2.2H1.5" /></svg>Statement
        </span>
      </div>

      {tip && (
        <div className="umx-tip">
          <b>Pay {fmt(tip.pay)} on {tip.r.c.name || tip.r.c.bank}</b> before its {fmtDay(tip.r.nextStmt!)} statement to report under 30%.
        </div>
      )}
      {missing > 0 && <p className="foot muted" style={{ margin: '8px 2px 0' }}>{missing} credit card{missing === 1 ? '' : 's'} hidden: add a credit limit to include {missing === 1 ? 'it' : 'them'}.</p>}
    </div>
  );
}
