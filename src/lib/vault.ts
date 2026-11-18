import {
  type Sealed,
  PBKDF2_ITERATIONS,
  deriveKekFromPasscode,
  deriveKekFromSecret,
  fromB64,
  importDek,
  open,
  openJson,
  randomBytes,
  seal,
  sealJson,
  toB64,
} from './crypto';
import { idbClear, idbGet, idbSet } from './db';
import { type VaultData, emptyVault, DEFAULT_SETTINGS } from './types';
import { biometricSecret, registerBiometric } from './webauthn';

const META_KEY = 'meta';
const DATA_KEY = 'vault';
const DATA_AAD = 'spendvault:data:v1';
const DEK_AAD = 'spendvault:dek:v1';
const BIO_INFO = 'spendvault:biometric-kek:v1';

export interface VaultMeta {
  version: 1;
  createdAt: number;
  passcode: { salt: Uint8Array; iterations: number; wrapped: Sealed; kind: PasscodeKind };
  biometric?: { credentialId: Uint8Array; prfSalt: Uint8Array; wrapped: Sealed };
  failedAttempts: number;
  lockoutUntil: number;
}

export type PasscodeKind = 'pin' | 'password';

export class VaultError extends Error {}

export const loadMeta = () => idbGet<VaultMeta>(META_KEY);

/** Create a brand-new vault protected by the given passcode. Returns the in-memory DEK. */
export async function createVault(passcode: string, kind: PasscodeKind) {
  const dekRaw = randomBytes(32);
  const salt = randomBytes(16);
  const kek = await deriveKekFromPasscode(passcode, salt);
  const meta: VaultMeta = {
    version: 1,
    createdAt: Date.now(),
    passcode: { salt, iterations: PBKDF2_ITERATIONS, wrapped: await seal(kek, dekRaw, DEK_AAD), kind },
    failedAttempts: 0,
    lockoutUntil: 0,
  };
  const dek = await importDek(dekRaw);
  dekRaw.fill(0);
  await idbSet(META_KEY, meta);
  const data = emptyVault();
  await saveData(dek, data);
  return { dek, data, meta };
}

async function unwrapWithPasscode(meta: VaultMeta, passcode: string) {
  const kek = await deriveKekFromPasscode(passcode, meta.passcode.salt, meta.passcode.iterations);
  try {
    return await open(kek, meta.passcode.wrapped, DEK_AAD);
  } catch {
    return null;
  }
}

/** Escalating delay after repeated wrong passcodes, persisted so a reload doesn't reset it. */
function lockoutMs(attempts: number) {
  if (attempts < 5) return 0;
  return Math.min(30_000 * 2 ** (attempts - 5), 60 * 60_000);
}

export async function unlockWithPasscode(passcode: string) {
  const meta = await loadMeta();
  if (!meta) throw new VaultError('No vault found.');
  if (Date.now() < meta.lockoutUntil) {
    const secs = Math.ceil((meta.lockoutUntil - Date.now()) / 1000);
    throw new VaultError(`Too many attempts. Try again in ${secs}s.`);
  }
  const raw = await unwrapWithPasscode(meta, passcode);
  if (!raw) {
    meta.failedAttempts += 1;
    meta.lockoutUntil = Date.now() + lockoutMs(meta.failedAttempts);
    await idbSet(META_KEY, meta);
    throw new VaultError('Incorrect passcode.');
  }
  meta.failedAttempts = 0;
  meta.lockoutUntil = 0;
  await idbSet(META_KEY, meta);
  const dek = await importDek(raw);
  raw.fill(0);
  return { dek, data: await loadData(dek), meta };
}

export async function unlockWithBiometric() {
  const meta = await loadMeta();
  if (!meta?.biometric) throw new VaultError('Biometric unlock is not set up.');
  const secret = await biometricSecret(meta.biometric.credentialId, meta.biometric.prfSalt);
  const kek = await deriveKekFromSecret(secret, BIO_INFO);
  let raw: Uint8Array;
  try {
    raw = await open(kek, meta.biometric.wrapped, DEK_AAD);
  } catch {
    throw new VaultError('Biometric key did not match. Unlock with passcode and re-enable biometrics.');
  }
  const dek = await importDek(raw);
  raw.fill(0);
  return { dek, data: await loadData(dek), meta };
}

/** Re-verify the user (for revealing card numbers etc). Biometric if enabled, otherwise passcode. */
export async function verifyBiometric() {
  const meta = await loadMeta();
  if (!meta?.biometric) return false;
  const secret = await biometricSecret(meta.biometric.credentialId, meta.biometric.prfSalt);
  const kek = await deriveKekFromSecret(secret, BIO_INFO);
  try {
    (await open(kek, meta.biometric.wrapped, DEK_AAD)).fill(0);
    return true;
  } catch {
    return false;
  }
}

export async function verifyPasscode(passcode: string) {
  const meta = await loadMeta();
  if (!meta) return false;
  const raw = await unwrapWithPasscode(meta, passcode);
  raw?.fill(0);
  return !!raw;
}

export async function enableBiometric(passcode: string) {
  const meta = await loadMeta();
  if (!meta) throw new VaultError('No vault found.');
  const raw = await unwrapWithPasscode(meta, passcode);
  if (!raw) throw new VaultError('Incorrect passcode.');
  try {
    const prfSalt = randomBytes(32);
    const { credentialId, secret } = await registerBiometric(prfSalt);
    const kek = await deriveKekFromSecret(secret, BIO_INFO);
    meta.biometric = { credentialId, prfSalt, wrapped: await seal(kek, raw, DEK_AAD) };
    await idbSet(META_KEY, meta);
    return meta;
  } finally {
    raw.fill(0);
  }
}

export async function disableBiometric() {
  const meta = await loadMeta();
  if (!meta) return;
  delete meta.biometric;
  await idbSet(META_KEY, meta);
  return meta;
}

export async function changePasscode(current: string, next: string, kind: PasscodeKind) {
  const meta = await loadMeta();
  if (!meta) throw new VaultError('No vault found.');
  const raw = await unwrapWithPasscode(meta, current);
  if (!raw) throw new VaultError('Current passcode is incorrect.');
  const salt = randomBytes(16);
  const kek = await deriveKekFromPasscode(next, salt);
  meta.passcode = { salt, iterations: PBKDF2_ITERATIONS, wrapped: await seal(kek, raw, DEK_AAD), kind };
  raw.fill(0);
  await idbSet(META_KEY, meta);
}

export async function loadData(dek: CryptoKey): Promise<VaultData> {
  const sealed = await idbGet<Sealed>(DATA_KEY);
  if (!sealed) return emptyVault();
  const data = await openJson<VaultData>(dek, sealed, DATA_AAD);
  return { ...emptyVault(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
}

export async function saveData(dek: CryptoKey, data: VaultData) {
  await idbSet(DATA_KEY, await sealJson(dek, data, DATA_AAD));
}

export async function wipeVault() {
  await idbClear();
}

// ---------- Encrypted backups ----------
// A backup is sealed with a key derived from a backup password (independent of the device),
// so it can be restored on another device / browser.
interface BackupFile {
  app: 'spendvault';
  format: 1;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  iv: string;
  ct: string;
}
const BACKUP_AAD = 'spendvault:backup:v1';

export async function exportBackup(data: VaultData, password: string) {
  const salt = randomBytes(16);
  const key = await deriveKekFromPasscode(password, salt);
  const s = await sealJson(key, data, BACKUP_AAD);
  const file: BackupFile = {
    app: 'spendvault',
    format: 1,
    kdf: { name: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    iv: toB64(s.iv),
    ct: toB64(s.ct),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importBackup(text: string, password: string): Promise<VaultData> {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new VaultError('This is not a SpendVault backup file.');
  }
  if (file.app !== 'spendvault' || file.format !== 1) throw new VaultError('This is not a SpendVault backup file.');
  const key = await deriveKekFromPasscode(password, fromB64(file.kdf.salt), file.kdf.iterations);
  try {
    const ct = fromB64(file.ct);
    const data = await openJson<VaultData>(key, { iv: fromB64(file.iv), ct: ct.buffer as ArrayBuffer }, BACKUP_AAD);
    return { ...emptyVault(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
  } catch {
    throw new VaultError('Wrong backup password, or the file is damaged.');
  }
}
