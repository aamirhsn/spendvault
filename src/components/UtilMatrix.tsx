import { useMemo } from 'react';
import type { PaymentCard, Transaction } from '../lib/types';
import { parseISO, todayISO } from '../lib/format';
import { cardFinishKey, finishFor } from '../lib/finishes';

/* Card × day utilisation heatmap.
   Rows are credit cards, columns are the last 14 days plus the next 7. A cell's colour is the card's
   estimated utilisation that day: spends logged since the card's last statement, plus any billed amount
   still unpaid, divided by the credit limit. A flag marks each card's payment due date so you can see a bill
   coming. (Cycles still follow the statement date — the day bureaus
   usually snapshot utilisation — so you can pay down a card just before it. */

const BACK = 13;
const AHEAD = 7;
const DAYS = BACK + 1 + AHEAD;

const level = (u: number) => (u <= 0 ? 0 : u < 0.15 ? 1 : u < 0.3 ? 2 : u < 0.5 ? 3 : 4);
const LEVEL_TXT = ['', '<15%', '15–30%', '30–50%', '>50%'];

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
/** True when `d` is the given day of the month (clamped for short months). */
const isDay = (d: Date, day?: number) => !!day && d.getDate() === Math.min(day, dim(d.getFullYear(), d.getMonth()));

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
        return { iso: todayISO(d), future, u: bal / limit, bal, flag: isDay(d, c.dueDay), stmt: isDay(d, c.statementDay) };
      });
      const now = cells[BACK];
      // Next statement (for the under-30% tip) and next due date (for the header) within the window.
      const nextIdx = cells.findIndex((x, i) => i > BACK && x.stmt);
      const dueIdx = cells.findIndex((x, i) => i >= BACK && x.flag);
      return { c, cells, now, limit, nextStmt: nextIdx > 0 ? days[nextIdx] : null, nextDue: dueIdx >= 0 ? days[dueIdx] : null };
    }).sort((a, b) => b.now.u - a.now.u);

    // Most useful action: a card with a statement coming up while it would report 30%+.
    const urgent = rows
      .filter((r) => r.nextStmt && r.now.u >= 0.3)
      .sort((a, b) => a.nextStmt!.getTime() - b.nextStmt!.getTime())[0];
    const tip = urgent
      ? { r: urgent, pay: Math.ceil((urgent.now.bal - urgent.limit * 0.29) / 100) * 100 }
      : null;
    const totBal = rows.reduce((a, r) => a + r.now.bal, 0);
    const totLim = rows.reduce((a, r) => a + r.limit, 0);
    const bands = [0, 0, 0, 0, 0];
    for (const r of rows) bands[level(r.now.u)]++;
    const nextAny = rows.filter((r) => r.nextDue).sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime())[0];
    return { days, rows, missing: credit.length - withLimit.length, tip, today, totBal, totLim, bands, nextAny };
  }, [cards, txns]);

  const { days, rows, missing, tip, totBal, totLim, bands, nextAny, today } = model;
  if (!rows.length) {
    return missing ? (
      <div className="card umx">
        <p className="foot muted" style={{ margin: 0 }}>Add a credit limit, statement day and due day to your credit cards to see daily utilisation here.</p>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={onOpen}>Open Cards</button>
      </div>
    ) : null;
  }
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const overall = totLim ? totBal / totLim : 0;
  const daysTo = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const BAND = ['', 'healthy', 'fine', 'watch', 'high'];

  return (
    <div className="card umx">
      <div className="umx-top">
        <div>
          <div className="label-xs">Overall utilisation</div>
          <div className="umx-big" data-l={level(overall)}>{Math.round(overall * 100)}<small>%</small></div>
          <div className="foot muted">{fmt(totBal)} of {fmt(totLim)}</div>
        </div>
        <div className="umx-bands">
          <div className="umx-stack">
            {[4, 3, 2, 1, 0].map((l) => bands[l] > 0 && <i key={l} data-l={l} style={{ flex: bands[l] }} />)}
          </div>
          <div className="umx-bl">
            {[4, 3].map((l) => bands[l] > 0 && <span key={l}><i data-l={l} />{bands[l]} {BAND[l]}</span>)}
            {bands[0] + bands[1] + bands[2] > 0 && <span><i data-l={2} />{bands[0] + bands[1] + bands[2]} under 30%</span>}
          </div>
          {nextAny && (
            <div className="umx-next">
              Next bill due: <b>{nextAny.c.name || nextAny.c.bank}</b> {daysTo(nextAny.nextDue!) === 0 ? 'today' : daysTo(nextAny.nextDue!) === 1 ? 'tomorrow' : `in ${daysTo(nextAny.nextDue!)} days`}
            </div>
          )}
        </div>
      </div>

      <div className="umx-grid" style={{ gridTemplateColumns: `94px repeat(${DAYS}, minmax(0, 1fr)) 40px` }}>
        <span className="umx-band" style={{ gridColumn: `${BACK + 2} / span 1`, gridRow: `1 / span ${rows.length + 1}` }} aria-hidden />
        <span />
        {days.map((d, i) => (
          <span key={i} className={`umx-h${i === BACK ? ' today' : ''}`}>{i === BACK ? 'Today' : i === 0 || i === 7 || i === DAYS - 1 ? fmtDay(d) : ''}</span>
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
                  className={`umx-c${x.future ? ' fut' : ''}${x.flag ? ' due' : ''}${x.flag && i >= BACK && i - BACK <= 3 ? ' soon' : ''}`}
                  data-l={x.future ? undefined : level(x.u)}
                  title={`${c.name || c.bank} · ${fmtDay(days[i])}: ${x.future ? 'upcoming' : `${Math.round(x.u * 100)}% (${fmt(x.bal)})`}${x.flag ? ' · payment due' : ''}${x.stmt ? ' · statement' : ''}`}
                >
                  {x.flag && <svg viewBox="0 0 12 14" className="umx-flag" aria-label="Payment due date"><path d="M2 13.5V1.2" /><path className="pen" d="M2.4 1.5h7.4l-1.8 2.6 1.8 2.6H2.4z" /></svg>}
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
          <svg viewBox="0 0 12 14" className="umx-flag inline"><path d="M2 13.5V1.2" /><path className="pen" d="M2.4 1.5h7.4l-1.8 2.6 1.8 2.6H2.4z" /></svg>Due date
        </span>
      </div>

      {tip && (
        <div className="umx-tip">
          <span className="umx-tip-ic" aria-hidden>
            <svg viewBox="0 0 24 24"><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></svg>
          </span>
          <span>
            <b>Pay {fmt(tip.pay)} on {tip.r.c.name || tip.r.c.bank}</b>
            <span className="muted"> before its {fmtDay(tip.r.nextStmt!)} statement ({daysTo(tip.r.nextStmt!) === 1 ? 'tomorrow' : `in ${daysTo(tip.r.nextStmt!)} days`}) to report under 30%.</span>
          </span>
        </div>
      )}
      {missing > 0 && <p className="foot muted" style={{ margin: '8px 2px 0' }}>{missing} credit card{missing === 1 ? '' : 's'} hidden: add a credit limit to include {missing === 1 ? 'it' : 'them'}.</p>}
    </div>
  );
}
