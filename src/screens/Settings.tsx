import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import * as V from '../lib/vault';
import { platformAuthenticatorAvailable } from '../lib/webauthn';
import { todayISO } from '../lib/format';
import type { Settings } from '../lib/types';
import { Field, Segmented, Sheet, Toggle, toast } from '../components/ui';
import { paymentLabel } from '../components/TxnRow';
import { IBudget, IChevron, IDownload, IFace, IKey, ILock, ISun, ITimer, ITrash, IUpload, IUser, IWallet } from '../components/Icons';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const LOCKS = [1, 2, 5, 15, 30, 0];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Panel = null | 'bio' | 'passcode' | 'export' | 'import' | 'wipe' | 'csv';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const { data, updateSettings, biometricEnabled, lock, meta } = store;
  const s = data.settings;
  const [panel, setPanel] = useState<Panel>(null);
  const [bioAvail, setBioAvail] = useState<boolean | null>(null);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvail);
  }, []);

  const set = (patch: Partial<Settings>) => updateSettings(patch);

  const Row = ({ icon, color, label, value, onClick, right }: { icon: React.ReactNode; color: string; label: string; value?: React.ReactNode; onClick?: () => void; right?: React.ReactNode }) => (
    onClick ? (
      <button className="settings-row" onClick={onClick}>
        <span className="ic" style={{ background: color }}>{icon}</span>
        <span className="lbl">{label}</span>
        {value != null && <span className="val">{value}</span>}
        <IChevron width={16} style={{ color: 'var(--text-3)' }} />
      </button>
    ) : (
      <div className="settings-row">
        <span className="ic" style={{ background: color }}>{icon}</span>
        <span className="lbl">{label}</span>
        {value != null && <span className="val">{value}</span>}
        {right}
      </div>
    )
  );

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="stack-lg">
        <div className="glass settings-group">
          <div className="settings-row">
            <span className="ic" style={{ background: 'linear-gradient(135deg,#5b8cff,#8a5bff)' }}><IUser /></span>
            <input className="input grow" style={{ height: 40 }} placeholder="Your name (for greeting)" value={s.displayName} onChange={(e) => set({ displayName: e.target.value.slice(0, 30) })} aria-label="Display name" />
          </div>
          <div className="settings-row">
            <span className="ic" style={{ background: 'linear-gradient(135deg,#11998e,#38ef7d)' }}><IWallet /></span>
            <span className="lbl">Currency</span>
            <select className="select" style={{ width: 110, height: 38 }} value={s.currency} onChange={(e) => set({ currency: e.target.value })} aria-label="Currency">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="settings-row">
            <span className="ic" style={{ background: 'linear-gradient(135deg,#f6a23a,#f05c5c)' }}><IBudget /></span>
            <span className="lbl">Monthly budget</span>
            <input className="input num" style={{ width: 130, height: 38, textAlign: 'right' }} inputMode="numeric" placeholder="None" value={s.monthlyBudget || ''} onChange={(e) => set({ monthlyBudget: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Monthly budget" />
          </div>
          <div className="settings-row">
            <span className="ic" style={{ background: 'linear-gradient(135deg,#606c88,#3f4c6b)' }}><ISun /></span>
            <span className="lbl">Appearance</span>
            <Segmented value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
        </div>

        <div>
          <div className="field-label" style={{ margin: '0 0 8px 8px' }}>SECURITY</div>
          <div className="glass settings-group">
            <Row
              icon={<IFace />}
              color="linear-gradient(135deg,#00c6fb,#005bea)"
              label="Biometric unlock"
              right={
                <Toggle
                  label="Biometric unlock"
                  on={biometricEnabled}
                  onChange={async (on) => {
                    if (on) setPanel('bio');
                    else {
                      await V.disableBiometric();
                      await store.refreshMeta();
                      toast('Biometric unlock turned off');
                    }
                  }}
                />
              }
            />
            {bioAvail === false && !biometricEnabled && <div className="tiny faint" style={{ padding: '0 10px 10px 54px' }}>No platform authenticator detected in this browser.</div>}
            <div className="settings-row">
              <span className="ic" style={{ background: 'linear-gradient(135deg,#7f53ac,#647dee)' }}><ITimer /></span>
              <span className="lbl">Auto-lock</span>
              <select className="select" style={{ width: 130, height: 38 }} value={s.autoLockMinutes} onChange={(e) => set({ autoLockMinutes: Number(e.target.value) })} aria-label="Auto-lock">
                {LOCKS.map((m) => <option key={m} value={m}>{m ? `${m} min` : 'Never'}</option>)}
              </select>
            </div>
            <Row icon={<IKey />} color="linear-gradient(135deg,#ff9a44,#fc6076)" label={`Change ${meta?.passcode.kind === 'pin' ? 'PIN' : 'password'}`} onClick={() => setPanel('passcode')} />
            <Row icon={<ILock />} color="linear-gradient(135deg,#434343,#7a7a7a)" label="Lock now" onClick={() => { onClose(); lock(); }} />
          </div>
        </div>

        <div>
          <div className="field-label" style={{ margin: '0 0 8px 8px' }}>DATA</div>
          <div className="glass settings-group">
            <Row icon={<IDownload />} color="linear-gradient(135deg,#11998e,#38ef7d)" label="Export encrypted backup" onClick={() => setPanel('export')} />
            <Row icon={<IUpload />} color="linear-gradient(135deg,#5b8cff,#8a5bff)" label="Restore from backup" onClick={() => setPanel('import')} />
            <Row icon={<IDownload />} color="linear-gradient(135deg,#f6a23a,#f05c5c)" label="Export spends as CSV" onClick={() => setPanel('csv')} />
            <Row icon={<ITrash />} color="linear-gradient(135deg,#ff5f6d,#e0315b)" label="Erase all data" onClick={() => setPanel('wipe')} />
          </div>
        </div>

        <div className="glass pad small muted" style={{ lineHeight: 1.55 }}>
          <b style={{ color: 'var(--text)' }}>How your data is protected</b>
          <br />Everything is stored only in this browser (IndexedDB) and encrypted with AES-256-GCM. The key is wrapped by your passcode (PBKDF2-SHA256, 600k iterations) and, if enabled, by a secret from your device’s biometric hardware (WebAuthn PRF). The app makes no network requests. Clearing site data deletes the vault — keep encrypted backups.
        </div>
        <div className="tiny faint center">SpendVault v1.0 · {data.transactions.length} spends · {data.cards.length} cards · {data.giftCards.length} gift cards · {data.merchants.length} merchants</div>
      </div>

      {panel === 'bio' && <BioPanel onClose={() => setPanel(null)} />}
      {panel === 'passcode' && <PasscodePanel onClose={() => setPanel(null)} />}
      {panel === 'export' && <ExportPanel onClose={() => setPanel(null)} />}
      {panel === 'import' && <ImportPanel onClose={() => setPanel(null)} />}
      {panel === 'csv' && <CsvPanel onClose={() => setPanel(null)} />}
      {panel === 'wipe' && <WipePanel onClose={() => setPanel(null)} />}
    </Sheet>
  );
}

function BioPanel({ onClose }: { onClose: () => void }) {
  const { refreshMeta } = useStore();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Enable biometrics">
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          await V.enableBiometric(code);
          await refreshMeta();
          toast('Biometric unlock enabled');
          onClose();
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          setErr(m === 'PRF_UNSUPPORTED'
            ? 'This browser/device can’t derive an encryption key from biometrics (WebAuthn PRF). Try Safari 18+ on iOS/macOS or Chrome on Android/Windows/Mac.'
            : /NotAllowed/i.test(m) ? 'Biometric prompt was cancelled.' : m);
        } finally {
          setBusy(false);
        }
      }}>
        <p className="small muted" style={{ margin: 0 }}>Confirm your passcode, then approve the Face ID / fingerprint prompt. Your device will hold a key that can unlock the vault.</p>
        <input className="input" type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Current passcode" aria-label="Current passcode" autoComplete="current-password" />
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={!code || busy}><IFace /> {busy ? 'Waiting…' : 'Continue'}</button>
      </form>
    </Sheet>
  );
}

function PasscodePanel({ onClose }: { onClose: () => void }) {
  const { refreshMeta } = useStore();
  const [cur, setCur] = useState('');
  const [kind, setKind] = useState<V.PasscodeKind>('password');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Change passcode">
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        if (kind === 'pin' && !/^\d{6}$/.test(next)) return setErr('PIN must be exactly 6 digits.');
        if (kind === 'password' && next.length < 8) return setErr('Use at least 8 characters.');
        if (next !== conf) return setErr('New passcodes don’t match.');
        setBusy(true);
        try {
          await V.changePasscode(cur, next, kind);
          await refreshMeta();
          toast('Passcode changed');
          onClose();
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(false);
        }
      }}>
        <Field label="Current passcode"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'password', label: 'Password' }, { value: 'pin', label: '6-digit PIN' }]} />
        <Field label={kind === 'pin' ? 'New PIN' : 'New password'}><input className="input" type="password" inputMode={kind === 'pin' ? 'numeric' : 'text'} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm"><input className="input" type="password" inputMode={kind === 'pin' ? 'numeric' : 'text'} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={busy || !cur || !next}>{busy ? 'Re-encrypting…' : 'Change'}</button>
      </form>
    </Sheet>
  );
}

function ExportPanel({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Sheet open onClose={onClose} title="Encrypted backup">
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8) return setErr('Use at least 8 characters.');
        if (pw !== pw2) return setErr('Passwords don’t match.');
        setBusy(true);
        const blob = await V.exportBackup(data, pw);
        download(blob, `spendvault-backup-${todayISO()}.svault`);
        setBusy(false);
        toast('Backup downloaded');
        onClose();
      }}>
        <p className="small muted" style={{ margin: 0 }}>Choose a backup password. The file is AES-256 encrypted and can be restored on any device with this password.</p>
        <input className="input" type="password" placeholder="Backup password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input className="input" type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={busy}><IDownload /> {busy ? 'Encrypting…' : 'Download backup'}</button>
      </form>
    </Sheet>
  );
}

function ImportPanel({ onClose }: { onClose: () => void }) {
  const { replaceAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fname, setFname] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Restore backup">
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          const d = await V.importBackup(text, pw);
          await replaceAll(d);
          toast('Backup restored');
          onClose();
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Restore failed');
        } finally {
          setBusy(false);
        }
      }}>
        <p className="small warn" style={{ margin: 0 }}>Restoring replaces everything currently in this vault.</p>
        <button type="button" className="btn glassy block" onClick={() => fileRef.current?.click()}><IUpload /> {fname || 'Choose backup file'}</button>
        <input ref={fileRef} className="hidden-input" type="file" accept=".svault,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setFname(f.name); setText(await f.text()); } }} />
        <input className="input" type="password" placeholder="Backup password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={!text || !pw || busy}>{busy ? 'Decrypting…' : 'Restore'}</button>
      </form>
    </Sheet>
  );
}

function CsvPanel({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const go = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Description', 'Category', 'Amount', 'Paid with', 'Gift card amount', 'Notes']];
    for (const t of data.transactions) {
      rows.push([t.date, t.description, t.category, String(t.amount), paymentLabel(t, data.cards), String(t.giftCards.reduce((a, g) => a + g.amount, 0)), t.notes]);
    }
    download(new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' }), `spendvault-spends-${todayISO()}.csv`);
    toast('CSV downloaded');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Export CSV">
      <div className="stack">
        <p className="small warn" style={{ margin: 0 }}>The CSV is <b>not encrypted</b>. It contains your spends and card last-4 digits (no full card numbers, CVVs or gift card codes). Store it carefully.</p>
        <button className="btn primary block" onClick={go}><IDownload /> Download {data.transactions.length} spends</button>
      </div>
    </Sheet>
  );
}

function WipePanel({ onClose }: { onClose: () => void }) {
  const [txt, setTxt] = useState('');
  return (
    <Sheet open onClose={onClose} title="Erase all data">
      <div className="stack">
        <p className="small" style={{ margin: 0 }}>This permanently deletes the vault on this device — spends, cards, gift cards, merchants and keys. It can’t be undone.</p>
        <input className="input" placeholder='Type "ERASE" to confirm' value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button className="btn danger block" disabled={txt !== 'ERASE'} onClick={async () => { await V.wipeVault(); location.reload(); }}><ITrash /> Erase everything</button>
      </div>
    </Sheet>
  );
}
