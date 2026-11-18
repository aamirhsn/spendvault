import { useId, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface Point {
  label: string; // tooltip label
  tick?: string; // axis label (shown when set)
  value: number;
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Single-series area chart with crosshair + tooltip. */
export function AreaChart({ data, format, height = 170, color = 'var(--s1)' }: { data: Point[]; format: (n: number) => string; height?: number; color?: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const padL = 4, padR = 4, padT = 12, padB = 22;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const path = useMemo(() => {
    if (!data.length) return '';
    // Monotone-ish smoothing via cardinal spline with low tension.
    const pts = data.map((d, i) => [x(i), y(d.value)] as const);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1] ?? pts[i];
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const [x3, y3] = pts[i + 2] ?? pts[i + 1];
      const t = 0.18;
      const c1x = x1 + (x2 - x0) * t, c1y = Math.min(H - padB, y1 + (y2 - y0) * t);
      const c2x = x2 - (x3 - x1) * t, c2y = Math.min(H - padB, y2 - (y3 - y1) * t);
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, max, H]);

  const onMove = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - padL) / (W - padL - padR)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;
  return (
    <div className="chart" ref={ref} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }} role="img" aria-label="Spending over time">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.38" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <line key={f} className="gridline" x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        <line className="gridline" x1={0} x2={W} y1={H - padB} y2={H - padB} vectorEffect="non-scaling-stroke" />
        {path && <path d={`${path} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`} fill={`url(#g${id})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--text-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* HTML overlays so text and dots don't stretch with the SVG */}
      {data.map((d, i) =>
        d.tick ? (
          <span key={i} className="axis-tick" style={{ position: 'absolute', left: `${(x(i) / W) * 100}%`, bottom: 0, transform: `translateX(${i === 0 ? '0' : i === data.length - 1 ? '-100%' : '-50%'})`, fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {d.tick}
          </span>
        ) : null,
      )}
      <span style={{ position: 'absolute', right: 2, top: `${(y(max) / H) * 100}%`, transform: 'translateY(-110%)', fontSize: 10.5, color: 'var(--text-3)' }}>{format(max)}</span>
      {h && hover != null && (
        <>
          <span style={{ position: 'absolute', left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%`, width: 10, height: 10, borderRadius: 9, background: color, transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 2px var(--bg)' }} />
          <div className="tooltip" style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%`, top: `${(y(h.value) / H) * 100}%` }}>
            <span className="muted">{h.label}</span>
            <b>{format(h.value)}</b>
          </div>
        </>
      )}
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

/** Donut with center total, hover highlight and a legend (identity is never colour-alone). */
export function Donut({ slices, format, centerLabel, size = 150 }: { slices: Slice[]; format: (n: number) => string; centerLabel: string; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 50, r = 36, C = 2 * Math.PI * ((R + r) / 2), sw = R - r;
  let acc = 0;
  const gap = slices.length > 1 ? 1.2 : 0; // surface gap between segments
  const h = hover != null ? slices[hover] : null;
  return (
    <div className="row" style={{ gap: 18, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg viewBox="0 0 110 110" width={size} height={size} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label="Spending by category">
          <circle cx="55" cy="55" r={(R + r) / 2} fill="none" stroke="var(--hair)" strokeWidth={sw} />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={s.label}
                  cx="55" cy="55" r={(R + r) / 2} fill="none" stroke={s.color} strokeWidth={hover === i ? sw + 4 : sw}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-acc}
                  style={{ transition: 'stroke-width .25s', opacity: hover == null || hover === i ? 1 : 0.45, cursor: 'pointer' }}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <div className="tiny muted ellipsis" style={{ maxWidth: size * 0.55 }}>{h ? h.label : centerLabel}</div>
            <div style={{ fontWeight: 740, fontSize: 17, letterSpacing: '-.02em' }}>{format(h ? h.value : total)}</div>
            {h && total > 0 && <div className="tiny faint">{Math.round((h.value / total) * 100)}%</div>}
          </div>
        </div>
      </div>
      <div className="legend grow">
        {slices.map((s, i) => (
          <div key={s.label} className="legend-row" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="sw" style={{ background: s.color }} />
            <span className="nm">{s.icon ? `${s.icon} ` : ''}{s.label}</span>
            <span className="vl num">{format(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vertical bars (e.g. last 6 months). The highlighted bar marks the current period. */
export function Bars({ data, format, highlight, height = 150 }: { data: Point[]; format: (n: number) => string; highlight?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  return (
    <div className="chart" style={{ height: height + 22 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height, borderBottom: '1px solid var(--grid)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed var(--grid)' }} />
        <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 10.5, color: 'var(--text-3)' }}>{format(max)}</span>
      </div>
      <div style={{ position: 'absolute', inset: `0 0 22px 0`, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const on = highlight === i;
          return (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
              <div style={{
                width: 'min(34px, 62%)', height: `${Math.max(d.value > 0 ? 2 : 0, pct)}%`, borderRadius: '4px 4px 0 0',
                background: on ? 'linear-gradient(180deg, var(--accent-2), var(--accent))' : 'var(--s1)',
                opacity: hover == null || hover === i ? (on ? 1 : 0.75) : 0.4, transition: 'height .7s var(--ease), opacity .2s',
              }} />
              {hover === i && (
                <div className="tooltip" style={{ left: '50%', top: `${100 - pct}%` }}>
                  <span className="muted">{d.label}</span>
                  <b>{format(d.value)}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 2 }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: highlight === i ? 'var(--text)' : 'var(--text-3)', fontWeight: highlight === i ? 650 : 400 }}>{d.tick ?? ''}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars, labelled — used for payment-method / card split. */
export function ShareBars({ rows, format }: { rows: { label: string; value: number; color?: string; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row between small" style={{ marginBottom: 6 }}>
            <span className="ellipsis">{r.label}{r.sub && <span className="faint"> · {r.sub}</span>}</span>
            <b className="num">{format(r.value)}</b>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: 'var(--hair)', overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 8, background: r.color ?? 'var(--s1)', transition: 'width .7s var(--ease)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
