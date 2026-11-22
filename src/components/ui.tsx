import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ICheck, IChevron, IClose, IEdit } from './Icons';

// Page scroll lock shared by all open sheets. A counter (not save/restore of the previous
// value) so sheets closing in any order can never leave the page stuck unscrollable.
let locks = 0;
let savedY = 0;
function lockScroll() {
  if (locks === 0) savedY = window.scrollY;
  locks += 1;
  document.documentElement.style.overflow = 'hidden';
}
function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.documentElement.style.overflow = '';
    // iOS leaves the layout viewport shifted after the keyboard closes, stranding fixed
    // elements (the tab bar) mid-screen. Restoring the scroll position re-syncs it.
    requestAnimationFrame(() => window.scrollTo(0, savedY));
  }
}

/** Round toolbar button with a symbol (iOS 26 style). */
export function CBtn({ icon, label, onClick, variant, size, type = 'button', disabled }: { icon: ReactNode; label: string; onClick?: () => void; variant?: 'primary' | 'tinted' | 'danger' | 'glass'; size?: 'lg'; type?: 'button' | 'submit'; disabled?: boolean }) {
  return (
    <button type={type} className={`cbtn ${variant ?? ''} ${size ?? ''}`} onClick={onClick} aria-label={label} title={label} disabled={disabled}>
      {icon}
    </button>
  );
}
export const SaveBtn = ({ onClick, label = 'Save' }: { onClick: () => void; label?: string }) => <CBtn icon={<ICheck strokeWidth={2.6} />} label={label} variant="primary" onClick={onClick} />;
export const EditBtn = ({ onClick }: { onClick: () => void }) => <CBtn icon={<IEdit />} label="Edit" variant="tinted" onClick={onClick} />;

/** Modal sheet: ✕ on the left, title centre, actions (✓ / ✎) on the right. */
export function Sheet({ open, onClose, title, children, actions, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; actions?: ReactNode; cancelLabel?: string; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-head">
          <span className="l"><CBtn icon={<IClose />} label="Close" onClick={onClose} /></span>
          <h3 className="ellipsis">{title}</h3>
          <div className="r row" style={{ gap: 8 }}>{actions}</div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/** A grouped inset list with optional header/footer text. */
export function Group({ header, footer, children, style }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={style}>
      {header && <div className="group-h">{header}</div>}
      <div className="group">{children}</div>
      {footer && <div className="group-f">{footer}</div>}
    </section>
  );
}

/** Label-left / control-right form row. */
/** Coloured rounded-square icon, like iOS Settings rows. */
export const Tile = ({ icon, color }: { icon: ReactNode; color: string }) => <span className="tile" style={{ background: color }}>{icon}</span>;

export function FieldRow({ label, children, icon, tile }: { label: string; children: ReactNode; icon?: ReactNode; tile?: string }) {
  return (
    <label className={`cell ${icon ? 'with-lead' : ''}`} style={icon ? { ['--inset' as string]: tile ? '58px' : '50px' } : undefined}>
      {icon && (tile ? <Tile icon={icon} color={tile} /> : <span className="lead">{icon}</span>)}
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}

/** Navigation-style row with optional icon, value and chevron. */
export function NavRow({ icon, iconBg, title, subtitle, value, onClick, right, chevron = true }: { icon?: ReactNode; iconBg?: string; title: ReactNode; subtitle?: ReactNode; value?: ReactNode; onClick?: () => void; right?: ReactNode; chevron?: boolean }) {
  const inner = (
    <>
      {icon && <span className="ic" style={{ background: iconBg }}>{icon}</span>}
      <span className="grow">
        <div className="t ellipsis">{title}</div>
        {subtitle && <div className="st ellipsis">{subtitle}</div>}
      </span>
      {value != null && <span className="v">{value}</span>}
      {right}
      {onClick && chevron && !right && <IChevron className="chev" />}
    </>
  );
  const cls = `cell ${icon ? 'icon-inset' : ''}`;
  return onClick ? <button className={cls} onClick={onClick}>{inner}</button> : <div className={cls}>{inner}</div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ value, options, onChange, full }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; full?: boolean }) {
  return (
    <div className={`seg ${full ? 'full' : ''}`} role="tablist">
      {options.map((o) => (
        <button type="button" key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="big-ic">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Two-step destructive action row. */
export function DeleteRow({ label, confirmLabel, onConfirm }: { label: string; confirmLabel?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="group">
      {armed ? (
        <>
          <button className="cell danger" style={{ fontWeight: 600 }} onClick={onConfirm}>{confirmLabel ?? `Confirm — ${label}`}</button>
          <button className="cell tint" onClick={() => setArmed(false)}>Cancel</button>
        </>
      ) : (
        <button className="cell danger" onClick={() => setArmed(true)}>{label}</button>
      )}
    </div>
  );
}

// ---- toast ----
type ToastAction = { label: string; run: () => void };
type ToastKind = 'success' | 'info' | 'warn' | 'error';
export interface ToastOpts { kind?: ToastKind; detail?: string; action?: ToastAction }
type ToastMsg = { title: string; key: number } & ToastOpts;
let pushToast: ((m: ToastMsg) => void) | null = null;
/** Show a notification. `opts` can also be a bare action, e.g. { label: 'Undo', run }. */
export const toast = (title: string, opts?: ToastOpts | ToastAction) => {
  const o: ToastOpts = opts && 'run' in opts ? { action: opts, kind: 'info' } : (opts ?? {});
  pushToast?.({ title, key: Date.now(), kind: o.kind ?? 'success', detail: o.detail, action: o.action });
};
const TOAST_ICON: Record<ToastKind, ReactNode> = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  info: <><path d="M12 11v6" /><circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" /></>,
  warn: <><path d="M12 7v6" /><circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" /></>,
  error: <path d="M7 7l10 10M17 7L7 17" />,
};
export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    pushToast = setMsg;
    return () => { pushToast = null; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.action ? 5000 : msg.detail ? 3600 : 2400);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const kind = msg.kind ?? 'success';
  return (
    <div key={msg.key} className={`toast liquid t-${kind}`} role={kind === 'error' ? 'alert' : 'status'} onClick={() => !msg.action && setMsg(null)}>
      <span className="toast-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">{TOAST_ICON[kind]}</svg></span>
      <span className="toast-txt">
        <b>{msg.title}</b>
        {msg.detail && <span>{msg.detail}</span>}
      </span>
      {msg.action && <button className="toast-act" onClick={(e) => { e.stopPropagation(); msg.action!.run(); setMsg(null); }}>{msg.action.label}</button>}
    </div>
  );
}

/** “Face ID” on iPhone/iPad, “Touch ID” on Mac, otherwise “fingerprint / face unlock”. */
export const bioName = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  return 'Fingerprint unlock';
};

// ---- swipe to delete ----
let closeOpenRow: (() => void) | null = null;
/** Row that reveals a Delete action when swiped left; a long swipe deletes straight away. */
export function SwipeRow({ onDelete, children, label = 'Delete' }: { onDelete: () => void; children: ReactNode; label?: string }) {
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(false);
  const st = useRef({ x: 0, y: 0, base: 0, axis: '' as '' | 'x' | 'y', moved: false, w: 320 });
  const ref = useRef<HTMLDivElement>(null);
  const OPEN = -88;
  const settle = (v: number) => { setAnim(true); setDx(v); };
  const close = () => settle(0);
  const remove = () => { setAnim(true); setDx(-(st.current.w + 40)); setTimeout(onDelete, 180); };

  return (
    <div className="swipe" ref={ref}>
      {dx < 0 && <button className="swipe-del" onClick={remove}>{label}</button>}
      <div
        className="swipe-fg"
        style={{ transform: `translateX(${dx}px)`, transition: anim ? 'transform .25s var(--ease)' : 'none' }}
        onPointerDown={(e) => {
          st.current = { x: e.clientX, y: e.clientY, base: dx, axis: '', moved: false, w: ref.current?.offsetWidth ?? 320 };
          setAnim(false);
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!e.buttons && e.pointerType === 'mouse') return;
          const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
          if (!s.axis) {
            if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy) * 1.2) {
              s.axis = 'x';
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
            } else if (Math.abs(ddy) > 8) s.axis = 'y';
          }
          if (s.axis === 'x') { s.moved = true; setDx(Math.min(0, Math.max(-s.w, s.base + ddx))); }
        }}
        onPointerUp={() => {
          const s = st.current;
          if (s.axis !== 'x') return;
          if (dx < -s.w * 0.55) remove();
          else if (dx < -40) { settle(OPEN); closeOpenRow = close; }
          else close();
        }}
        onPointerCancel={() => close()}
        onClickCapture={(e) => {
          // A swipe is not a tap; a tap on an open row closes it.
          if (st.current.moved || dx < 0) { e.stopPropagation(); e.preventDefault(); st.current.moved = false; if (dx < 0) close(); }
        }}
      >
        {children}
      </div>
    </div>
  );
}

export async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label, { detail: 'Clipboard clears in 30 seconds.' });
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30_000);
  } catch {
    toast('Couldn’t copy', { kind: 'error', detail: 'Please try again.' });
  }
}

export interface FabItem { label: string; icon: ReactNode; color: string; onClick: () => void }

/** Floating “+” above the tab bar. With `items` it expands into a menu of actions. */
export function AddFab({ label, onClick, items }: { label: string; onClick?: () => void; items?: FabItem[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const toggle = () => (items ? setOpen((o) => !o) : onClick?.());
  return createPortal(
    <>
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      {open && items && (
        <div className="fab-menu" role="menu">
          {items.map((it, i) => (
            <button key={it.label} role="menuitem" className="fab-item" style={{ animationDelay: `${(items.length - 1 - i) * 30}ms` }} onClick={() => { setOpen(false); it.onClick(); }}>
              <span>{it.label}</span>
              <span className="fab-ic" style={{ background: it.color }}>{it.icon}</span>
            </button>
          ))}
        </div>
      )}
      <button className={`add-fab ${open ? 'open' : ''}`} onClick={toggle} aria-label={open ? 'Close menu' : label} aria-expanded={items ? open : undefined} title={label}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </>,
    document.body,
  );
}
