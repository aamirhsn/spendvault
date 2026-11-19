import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { VaultError, changePasscode } from '../lib/vault';
import { IFace, ILock, IShield } from '../components/Icons';
import { Sheet, toast } from '../components/ui';
import { markVerified } from '../components/Verify';

const PIN_LEN = 6;

/** Six-dot PIN entry with an on-screen keypad (also accepts the hardware keyboard). */
export function PinPad({ title, subtitle, onComplete, bio }: { title: string; subtitle?: string; onComplete: (pin: string) => Promise<string | null>; bio?: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const pinRef = useRef('');

  const submit = useCallback(async (code: string) => {
    setBusy(true);
    const e = await onComplete(code);
    setBusy(false);
    pinRef.current = '';
    setPin('');
    if (e) {
      setErr(e);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      navigator.vibrate?.(60);
    }
  }, [onComplete]);

  const press = useCallback((k: string) => {
    if (busy) return;
    setErr('');
    if (k === 'del') pinRef.current = pinRef.current.slice(0, -1);
    else if (pinRef.current.length < PIN_LEN) pinRef.current += k;
    setPin(pinRef.current);
    if (pinRef.current.length === PIN_LEN) setTimeout(() => submit(pinRef.current), 90);
  }, [busy, submit]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [press]);

  return (
    <div className="center" style={{ padding: '8px 0 4px' }}>
      <div className="cbtn tinted" style={{ width: 56, height: 56, margin: '0 auto 12px' }}><ILock width={26} height={26} /></div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      <div className="foot" style={{ minHeight: 18, marginTop: 4, color: err ? 'var(--red)' : 'var(--label-2)' }}>{err || (busy ? 'Checking…' : subtitle)}</div>
      <div className={`dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length} of ${PIN_LEN} digits entered`}>
        {Array.from({ length: PIN_LEN }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} className="key" onClick={() => press(k)}>{k}</button>)}
        {bio ? <button className="key ghost" onClick={bio} aria-label="Use Face ID or Touch ID"><IFace /></button> : <span />}
        <button className="key" onClick={() => press('0')}>0</button>
        <button className="key ghost" onClick={() => press('del')} aria-label="Delete">⌫</button>
      </div>
    </div>
  );
}

const bioError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/NotAllowed|cancel|abort/i.test(m)) return null;
  return m === 'PRF_UNSUPPORTED' ? 'Biometrics unavailable here — use your PIN.' : m;
};

/** Unlock (or first-time PIN setup) for the card vault. */
export function VaultGate({ reason, onDone }: { reason?: string; onDone?: () => void }) {
  const { vault, unlock, unlockBiometric, setupPin, biometricEnabled } = useStore();
  const [first, setFirst] = useState<string | null>(null);
  const tried = useRef(false);

  const done = () => { markVerified(); onDone?.(); };
  const tryBio = useCallback(async () => {
    try { await unlockBiometric(); markVerified(); onDone?.(); } catch (e) { const m = bioError(e); if (m) toast(m); }
  }, [unlockBiometric, onDone]);

  useEffect(() => {
    if (vault === 'locked' && biometricEnabled && !tried.current) { tried.current = true; tryBio(); }
  }, [vault, biometricEnabled, tryBio]);

  if (vault === 'none') {
    return first == null ? (
      <PinPad key="a" title="Create a PIN" subtitle={reason ?? 'Protects your card numbers and gift card codes'} onComplete={async (p) => { setFirst(p); return null; }} />
    ) : (
      <PinPad key="b" title="Confirm your PIN" subtitle="Enter it once more" onComplete={async (p) => {
        if (p !== first) { setFirst(null); return 'PINs didn’t match. Try again.'; }
        await setupPin(p);
        toast('PIN set — turn on Face ID in Settings');
        done();
        return null;
      }} />
    );
  }
  return (
    <PinPad title="Enter PIN" subtitle={reason ?? 'Unlock your cards'} bio={biometricEnabled ? tryBio : undefined} onComplete={async (p) => {
      try { await unlock(p); done(); return null; } catch (e) { return e instanceof VaultError ? e.message : 'Could not unlock'; }
    }} />
  );
}

/** Modal used by requestUnlock() from anywhere in the app. */
export function UnlockSheet() {
  const { unlockRequest } = useStore();
  if (!unlockRequest) return null;
  return (
    <Sheet open onClose={() => unlockRequest.resolve(false)} title="">
      <VaultGate reason={unlockRequest.reason} onDone={() => unlockRequest.resolve(true)} />
    </Sheet>
  );
}

/** One-time step for data created by earlier versions (whole app was locked then). */
export function MigrateScreen() {
  const { meta, migrate, biometricEnabled, refreshMeta, finishMigration } = useStore();
  const kind = meta?.passcode.kind ?? 'password';
  const [stage, setStage] = useState<'unlock' | 'newpin' | 'confirm'>('unlock');
  const [old, setOld] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [newPin, setNewPin] = useState('');

  const run = async (code: string | null) => {
    setErr('');
    try {
      const k = await migrate(code);
      if (k === 'password' && code) { setOld(code); setStage('newpin'); return null; }
      if (k === 'password') { toast('Updated — set a PIN in Settings'); }
      return null;
    } catch (e) {
      const m = e instanceof VaultError ? e.message : bioError(e) ?? '';
      setErr(m);
      return m || 'Could not unlock';
    }
  };

  return (
    <div className="lock">
      <div className="lock-card">
        {stage === 'unlock' && (
          <>
            <div className="cbtn tinted" style={{ width: 60, height: 60, margin: '0 auto 14px' }}><IShield width={28} height={28} /></div>
            <h1>One quick update</h1>
            <p className="muted small" style={{ margin: '0 0 18px', lineHeight: 1.45 }}>SpendVault no longer locks the whole app — only your cards. Unlock once to move your data over.</p>
            {kind === 'pin' ? (
              <PinPad title="Enter your PIN" onComplete={run} bio={biometricEnabled ? () => run(null) : undefined} />
            ) : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); if (pw) run(pw); }}>
                <input className="input" type="password" autoFocus placeholder="Your current password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
                {err && <div className="err">{err}</div>}
                <button className="btn primary block" disabled={!pw}>Unlock & update</button>
                {biometricEnabled && <button type="button" className="btn secondary block" onClick={() => run(null)}><IFace /> Use Face ID / Touch ID</button>}
              </form>
            )}
          </>
        )}
        {stage === 'newpin' && <PinPad key="n" title="Create a 6-digit PIN" subtitle="Passwords are replaced by a PIN" onComplete={async (p) => { setNewPin(p); setStage('confirm'); return null; }} />}
        {stage === 'confirm' && (
          <PinPad key="c" title="Confirm your PIN" onComplete={async (p) => {
            if (p !== newPin) { setStage('newpin'); return 'PINs didn’t match'; }
            await changePasscode(old, p, 'pin');
            await refreshMeta();
            toast('All set — your PIN is ready');
            finishMigration();
            return null;
          }} />
        )}
      </div>
    </div>
  );
}
