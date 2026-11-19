import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { VaultError, type PasscodeKind } from '../lib/vault';
import { IFace, ILock } from '../components/Icons';
import { Segmented } from '../components/ui';

const PIN_LEN = 6;

function Keypad({ onKey, onDelete, extra }: { onKey: (k: string) => void; onDelete: () => void; extra?: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === 'Backspace') onDelete();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onKey, onDelete]);
  return (
    <div className="keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
        <button key={k} className="key" onClick={() => onKey(k)}>{k}</button>
      ))}
      <div className="key ghost">{extra}</div>
      <button className="key" onClick={() => onKey('0')}>0</button>
      <button className="key ghost" onClick={onDelete} aria-label="Delete">⌫</button>
    </div>
  );
}

function Dots({ n, shake }: { n: number; shake: boolean }) {
  return (
    <div className={`dots ${shake ? 'shake' : ''}`} aria-hidden="true">
      {Array.from({ length: PIN_LEN }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </div>
  );
}

export function LockScreen() {
  const { status, meta, unlock, unlockBiometric, setup, biometricEnabled } = useStore();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const autoTried = useRef(false);

  // setup state
  const [kind, setKind] = useState<PasscodeKind>('password');
  const [step, setStep] = useState<'intro' | 'create' | 'confirm'>('intro');
  const [first, setFirst] = useState('');

  const isSetup = status === 'setup';
  const unlockKind: PasscodeKind = meta?.passcode.kind ?? 'password';
  const usePin = isSetup ? kind === 'pin' : unlockKind === 'pin';

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setPin('');
  };

  const tryBio = async () => {
    setError('');
    setBusy(true);
    try {
      await unlockBiometric();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m !== 'PRF_UNSUPPORTED' && !/NotAllowed|cancel|abort/i.test(m)) setError(m);
      if (m === 'PRF_UNSUPPORTED') setError('This browser can no longer provide the biometric key. Use your passcode.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isSetup && biometricEnabled && !autoTried.current) {
      autoTried.current = true;
      tryBio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetup, biometricEnabled]);

  const submitUnlock = async (code: string) => {
    setBusy(true);
    setError('');
    try {
      await unlock(code);
    } catch (e) {
      fail(e instanceof VaultError ? e.message : 'Could not unlock.');
    } finally {
      setBusy(false);
    }
  };

  const submitSetup = async (code: string) => {
    if (step === 'create') {
      if (kind === 'password' && code.length < 8) return fail('Use at least 8 characters.');
      setFirst(code);
      setStep('confirm');
      setPin('');
      setPassword('');
      setError('');
      return;
    }
    if (code !== first) {
      setStep('create');
      setFirst('');
      setPassword('');
      return fail("Passcodes didn't match. Try again.");
    }
    setBusy(true);
    try {
      await setup(code, kind);
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = (code: string) => (isSetup ? submitSetup(code) : submitUnlock(code));

  const onKey = (k: string) => {
    if (busy) return;
    setError('');
    setPin((p) => {
      const n = (p + k).slice(0, PIN_LEN);
      if (n.length === PIN_LEN) setTimeout(() => submit(n), 120);
      return n;
    });
  };
  const onDelete = () => setPin((p) => p.slice(0, -1));

  if (isSetup && step === 'intro') {
    return (
      <div className="lock">
        <div className="lock-card">
          <img src="./icon.svg" alt="" className="lock-logo" />
          <h1>SpendVault</h1>
          <p className="muted small" style={{ margin: '0 0 22px', lineHeight: 1.5 }}>
            Your spends, cards and gift cards — stored only on this device and encrypted with AES-256. Nothing is ever uploaded.
          </p>
          <div className="stack" style={{ textAlign: 'left' }}>
            {[
              ['🔐', 'End-to-end local encryption', 'Data is sealed with a key derived from your passcode.'],
              ['🫆', 'Biometric unlock', 'Face ID / fingerprint via your device’s secure hardware.'],
              ['📴', 'Works offline', 'No accounts, no servers, no tracking.'],
            ].map(([e, t, d]) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22 }}>{e}</span>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 14.5 }}>{t}</div>
                  <div className="small muted">{d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ margin: '22px 0 10px' }}>
            <Segmented<PasscodeKind> full value={kind} onChange={setKind} options={[{ value: 'password', label: 'Password (stronger)' }, { value: 'pin', label: '6-digit PIN' }]} />
          </div>
          {kind === 'pin' && <p className="tiny warn" style={{ margin: '0 0 8px' }}>A 6-digit PIN is convenient but much easier to brute-force if someone copies your browser data. A password is recommended.</p>}
          <button className="btn primary block" onClick={() => setStep('create')}>Create vault</button>
          <p className="tiny faint" style={{ marginTop: 14 }}>There is no recovery. If you forget the passcode, the data can’t be decrypted — keep encrypted backups from Settings.</p>
        </div>
      </div>
    );
  }

  const title = isSetup ? (step === 'create' ? (usePin ? 'Create a PIN' : 'Create a password') : 'Confirm it') : 'Unlock SpendVault';

  return (
    <div className="lock">
      <div className="lock-card">
        <div className="glass-btn" style={{ margin: "0 auto 12px", width: 56, height: 56, background: "var(--fill)" }}><ILock /></div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        <p className="muted small" style={{ margin: 0, minHeight: 20 }}>
          {error ? <span className="bad">{error}</span> : busy ? 'Deriving key…' : isSetup ? 'You’ll use this to unlock your vault.' : 'Your data is encrypted on this device.'}
        </p>
        {usePin ? (
          <>
            <Dots n={pin.length} shake={shake} />
            <Keypad
              onKey={onKey}
              onDelete={onDelete}
              extra={!isSetup && biometricEnabled ? (
                <button onClick={tryBio} aria-label="Unlock with biometrics" style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}><IFace /></button>
              ) : null}
            />
          </>
        ) : (
          <form
            className={`stack ${shake ? 'shake' : ''}`}
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (password) submit(password);
            }}
          >
            <input
              className="input"
              type="password"
              autoFocus
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              placeholder={isSetup ? 'At least 8 characters' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
            <button className="btn primary block" disabled={busy || !password}>{isSetup ? (step === 'create' ? 'Continue' : 'Create vault') : 'Unlock'}</button>
            {!isSetup && biometricEnabled && (
              <button type="button" className="btn secondary block" onClick={tryBio} disabled={busy}><IFace /> Use biometrics</button>
            )}
          </form>
        )}
        {isSetup && (
          <button className="btn sm" style={{ marginTop: 14, color: 'var(--text-2)' }} onClick={() => { setStep('intro'); setFirst(''); setPin(''); setPassword(''); setError(''); }}>Back</button>
        )}
      </div>
    </div>
  );
}
