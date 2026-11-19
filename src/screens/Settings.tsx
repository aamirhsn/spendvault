import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import * as V from '../lib/vault';
import { platformAuthenticatorAvailable } from '../lib/webauthn';
import { todayISO } from '../lib/format';
import type { Settings } from '../lib/types';
import { FieldRow, Group, NavRow, Segmented, Sheet, Toggle, toast } from '../components/ui';
import { BudgetsSheet } from '../components/Budgets';
import { money } from '../lib/format';
import { paymentLabel } from '../components/TxnRow';
import { IDownload, IFace, IKey, ILock, ITimer, ITrash, IUpload, IWallet } from '../components/Icons';

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
  const [budgets, setBudgets] = useState(false);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvail);
  }, []);

  const set = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <Sheet open={open} onClose={onClose} title="Settings" cancelLabel="Done">
      <div className="stack-lg">
        <Group>
          <FieldRow label="Your name"><input placeholder="For the greeting" value={s.displayName} onChange={(e) => set({ displayName: e.target.value.slice(0, 30) })} /></FieldRow>
          <FieldRow label="Currency">
            <select value={s.currency} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <NavRow title="Budgets" value={s.monthlyBudget ? money(s.monthlyBudget, s.currency, { decimals: false }) : Object.keys(s.categoryBudgets ?? {}).length ? `${Object.keys(s.categoryBudgets).length} categories` : 'Off'} onClick={() => setBudgets(true)} />
          <FieldRow label="Appearance">
            <select value={s.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
              <option value="system">Automatic</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </FieldRow>
          <div className="cell"><span className="grow">Hide amounts</span><Toggle label="Hide amounts" on={s.hideAmounts} onChange={(v) => set({ hideAmounts: v })} /></div>
        </Group>

        <Group header="Security" footer={bioAvail === false && !biometricEnabled ? 'This browser has no Face ID / Touch ID / fingerprint authenticator available.' : 'Face ID / fingerprint unlocks the vault with a key held in your device’s secure hardware.'}>
          <NavRow icon={<IFace />} iconBg="var(--green)" title="Face ID / Touch ID" right={<Toggle label="Biometric unlock" on={biometricEnabled} onChange={async (on) => {
            if (on) setPanel('bio');
            else { await V.disableBiometric(); await store.refreshMeta(); toast('Biometric unlock turned off'); }
          }} />} />
          <NavRow icon={<ITimer />} iconBg="var(--indigo)" title="Auto-Lock" right={
            <select style={{ flex: 'none', width: 'auto' }} value={s.autoLockMinutes} onChange={(e) => set({ autoLockMinutes: Number(e.target.value) })} aria-label="Auto-lock">
              {LOCKS.map((m) => <option key={m} value={m}>{m ? `${m} min` : 'Never'}</option>)}
            </select>} />
          <NavRow icon={<IKey />} iconBg="var(--orange)" title={`Change ${meta?.passcode.kind === 'pin' ? 'PIN' : 'Password'}`} onClick={() => setPanel('passcode')} />
          <NavRow icon={<ILock />} iconBg="var(--gray)" title="Lock Now" onClick={() => { onClose(); lock(); }} />
        </Group>

        <Group header="Data" footer="Backups are encrypted with a password you choose and can be restored on any device.">
          <NavRow icon={<IDownload />} iconBg="var(--tint)" title="Export Encrypted Backup" onClick={() => setPanel('export')} />
          <NavRow icon={<IUpload />} iconBg="var(--teal)" title="Restore from Backup" onClick={() => setPanel('import')} />
          <NavRow icon={<IWallet />} iconBg="var(--green)" title="Export Spends (CSV)" onClick={() => setPanel('csv')} />
        </Group>

        <div className="group"><button className="cell danger" onClick={() => setPanel('wipe')}>Erase All Data</button></div>

        <div className="group-f center" style={{ lineHeight: 1.5 }}>
          Stored only on this device, encrypted with AES-256-GCM. No accounts, no servers, no tracking.<br />
          SpendVault 2.0 · {data.transactions.length} spends · {data.cards.length} cards · {data.giftCards.length} gift cards
        </div>
      </div>

      {panel === 'bio' && <BioPanel onClose={() => setPanel(null)} />}
      {panel === 'passcode' && <PasscodePanel onClose={() => setPanel(null)} />}
      {panel === 'export' && <ExportPanel onClose={() => setPanel(null)} />}
      {panel === 'import' && <ImportPanel onClose={() => setPanel(null)} />}
      {panel === 'csv' && <CsvPanel onClose={() => setPanel(null)} />}
      {panel === 'wipe' && <WipePanel onClose={() => setPanel(null)} />}
      <BudgetsSheet open={budgets} onClose={() => setBudgets(false)} />
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
        <Segmented full value={kind} onChange={setKind} options={[{ value: 'password', label: 'Password' }, { value: 'pin', label: '6-digit PIN' }]} />
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
        <button type="button" className="btn secondary block" onClick={() => fileRef.current?.click()}><IUpload /> {fname || 'Choose backup file'}</button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="foot muted" style={{ paddingLeft: 4 }}>{label}</span>
      {children}
    </label>
  );
}
