import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IClose } from './Icons';

export function Sheet({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; actions?: ReactNode }) {
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
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            <IClose width={18} height={18} />
          </button>
          <h3 className="ellipsis">{title}</h3>
          <div style={{ minWidth: 34, display: 'flex', justifyContent: 'flex-end' }}>{actions}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error ? <div className="err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="glass empty">
      <div className="big-ic">{icon}</div>
      <h3>{title}</h3>
      <p className="small" style={{ margin: '0 0 16px' }}>{text}</p>
      {action}
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
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div key={msg.key} className="toast glass" role="status">
      {msg.text}
    </div>
  ) : null;
}

export async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} — clipboard clears in 30s`);
    // Best-effort: clear sensitive data from the clipboard after a while.
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30_000);
  } catch {
    toast('Copy failed');
  }
}
