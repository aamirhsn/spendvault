import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IChevron } from './Icons';

/** iOS-style modal sheet: Cancel on the left, title centre, primary action on the right. */
export function Sheet({ open, onClose, title, children, actions, cancelLabel = 'Cancel' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; actions?: ReactNode; cancelLabel?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-head">
          <button className="textbtn l" onClick={onClose}>{cancelLabel}</button>
          <h3 className="ellipsis">{title}</h3>
          <div className="r">{actions}</div>
        </div>
        <div className="sheet-body">{children}</div>
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
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cell">
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
let pushToast: ((msg: string) => void) | null = null;
export const toast = (msg: string) => pushToast?.(msg);
export function ToastHost() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    pushToast = (text) => setMsg({ text, key: Date.now() });
    return () => {
      pushToast = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2000);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div key={msg.key} className="toast liquid" role="status">{msg.text}</div> : null;
}

export async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} · clears in 30s`);
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30_000);
  } catch {
    toast('Copy failed');
  }
}
