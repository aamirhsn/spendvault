import { useCallback, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { verifyBiometric, verifyPasscode } from '../lib/vault';
import { Sheet } from './ui';
import { IFace } from './Icons';

const GRACE_MS = 60_000;
let verifiedAt = 0; // module-level so a reveal grace period spans screens

/**
 * Re-authenticate before revealing secrets (card numbers, CVVs, gift card PINs).
 * Uses biometrics when enabled, otherwise the vault passcode.
 */
export function useVerify() {
  const { biometricEnabled, status } = useStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const pending = useRef<((ok: boolean) => void) | null>(null);

  if (status !== 'unlocked') verifiedAt = 0;

  const finish = (ok: boolean) => {
    if (ok) verifiedAt = Date.now();
    pending.current?.(ok);
    pending.current = null;
    setOpen(false);
    setCode('');
    setErr('');
  };

  const verify = useCallback(async (): Promise<boolean> => {
    if (Date.now() - verifiedAt < GRACE_MS) return true;
    if (biometricEnabled) {
      try {
        if (await verifyBiometric()) {
          verifiedAt = Date.now();
          return true;
        }
      } catch {
        /* fall back to passcode */
      }
    }
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
  }, [biometricEnabled]);

  const element = (
    <Sheet open={open} onClose={() => finish(false)} title="Confirm it's you">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await verifyPasscode(code)) finish(true);
          else setErr('Incorrect passcode');
        }}
      >
        <p className="small muted" style={{ margin: 0 }}>Enter your vault passcode to reveal sensitive details.</p>
        <input className="input" type="password" autoFocus inputMode="text" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Passcode" />
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={!code}>Verify</button>
        {biometricEnabled && (
          <button type="button" className="btn glassy block" onClick={async () => { try { if (await verifyBiometric()) finish(true); } catch { setErr('Biometric check failed'); } }}>
            <IFace /> Try biometrics again
          </button>
        )}
      </form>
    </Sheet>
  );

  return { verify, element };
}
