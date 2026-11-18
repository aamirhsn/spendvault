// All cryptography uses the browser's native WebCrypto API.
//
// Key hierarchy
//   DEK  – random 256-bit AES-GCM "data encryption key". Encrypts every record.
//   KEK  – "key encryption key" that wraps the DEK. There is one per unlock method:
//          • passcode  → PBKDF2-SHA256 (600k iterations, random 16-byte salt)
//          • biometric → WebAuthn PRF output → HKDF-SHA256
// The DEK is only ever held in memory as a non-extractable CryptoKey while unlocked.

export const PBKDF2_ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Sealed {
  iv: Uint8Array;
  ct: ArrayBuffer;
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function deriveKekFromPasscode(passcode: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveKekFromSecret(secret: ArrayBuffer, info: string) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal raw bytes with a key. `aad` binds the ciphertext to its purpose so blobs can't be swapped. */
export async function seal(key: CryptoKey, data: Uint8Array, aad: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, data);
  return { iv, ct };
}

export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv, additionalData: enc.encode(aad) },
    key,
    sealed.ct,
  );
  return new Uint8Array(pt);
}

export const sealJson = (key: CryptoKey, value: unknown, aad: string) => seal(key, enc.encode(JSON.stringify(value)), aad);
export const openJson = async <T>(key: CryptoKey, sealed: Sealed, aad: string): Promise<T> =>
  JSON.parse(dec.decode(await open(key, sealed, aad))) as T;

export const importDek = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

// --- base64 helpers for portable backups ---
export function toB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
