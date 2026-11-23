import { useLayoutEffect, useRef, useState } from 'react';
import type { PaymentCard } from '../lib/types';
import { cardFinishKey, finishFor } from '../lib/finishes';

interface Item { c: PaymentCard; spent: number; count: number }
interface Rect { it: Item; x: number; y: number; w: number; h: number }

const TEX: Record<string, string> = {
  brushed: 'repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px), ',
  carbon: 'repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 2px,transparent 2px 6px), ',
  wave: 'radial-gradient(140% 100% at 110% 120%,rgba(255,255,255,.12) 0 30%,transparent 30.5%), ',
  pearl: 'radial-gradient(120% 80% at 20% 10%,rgba(255,255,255,.6),transparent 50%), ',
};

/** Recursive binary split: halves of roughly equal spend, cut across the longer side. */
function layout(items: Item[], x: number, y: number, w: number, h: number, out: Rect[] = []): Rect[] {
  if (!items.length) return out;
  if (items.length === 1) {
    out.push({ it: items[0], x, y, w, h });
    return out;
  }
  const total = items.reduce((a, i) => a + i.spent, 0);
  let acc = 0, k = 0;
  while (k < items.length - 1 && acc + items[k].spent / 2 < total / 2) acc += items[k++].spent;
  k = Math.max(1, k);
  const a = items.slice(0, k), b = items.slice(k);
  const r = a.reduce((s, i) => s + i.spent, 0) / total;
  if (w >= h) {
    layout(a, x, y, w * r, h, out);
    layout(b, x + w * r, y, w * (1 - r), h, out);
  } else {
    layout(a, x, y, w, h * r, out);
    layout(b, x, y + h * r, w, h * (1 - r), out);
  }
  return out;
}

export function CardMap({ items, total, fmt, onOpen }: { items: Item[]; total: number; fmt: (n: number) => string; onOpen(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(300, 170 + items.length * 12));
  const rects = W ? layout(items, 0, 0, W, H) : [];
  const G = 3; // gap

  return (
    <div className="card cmap">
      <div className="cmap-head">
        <span className="label-xs">{items.length} card{items.length === 1 ? '' : 's'} · share of spend</span>
        <b>{fmt(total)}</b>
      </div>
      <div ref={ref} className="cmap-area" style={{ height: H }}>
        {rects.map(({ it, x, y, w, h }) => {
          const f = finishFor(cardFinishKey(it.c));
          const pct = total ? Math.round((it.spent / total) * 100) : 0;
          const tw = w - G, th = h - G;
          const showAmt = tw >= 56 && th >= 40;
          const showName = showAmt && tw >= 60 && th >= 64;
          const wide = tw >= 92;
          const small = !showAmt && tw >= 30 && th >= 22;
          const name = it.c.name || it.c.bank;
          return (
            <button
              key={it.c.id}
              className="cmap-tile"
              onClick={onOpen}
              title={`${name} ••${it.c.last4}: ${fmt(it.spent)} · ${pct}% · ${it.count} spend${it.count === 1 ? '' : 's'}`}
              aria-label={`${name} ending ${it.c.last4}, ${fmt(it.spent)}, ${pct} percent of card spending`}
              style={{ left: x + G / 2, top: y + G / 2, width: tw, height: th, background: (f.texture ? TEX[f.texture] : '') + f.bg, color: f.ink }}
            >
              {showAmt && (
                <>
                  <span className={`cmap-pct${wide ? '' : ' sm'}`}>{pct}%</span>
                  {showName && <span className="cmap-name">{name}</span>}
                  <span className={`cmap-amt${tw < 80 ? ' sm' : ''}`}>{fmt(it.spent)}</span>
                </>
              )}
              {small && <span className="cmap-only">{pct}%</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
