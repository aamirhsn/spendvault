// Biometric unlock via WebAuthn + the PRF extension.
//
// The platform authenticator (Face ID / Touch ID / Windows Hello / Android fingerprint)
// derives a secret from a per-credential key that never leaves the secure hardware.
// We feed that secret through HKDF to obtain a KEK that wraps the vault's DEK.
// No server is involved, so the security comes from the PRF secret itself — not from
// a signed assertion — and without a successful biometric check the DEK cannot be unwrapped.

import { randomBytes } from './crypto';

export function webauthnAvailable() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext;
}

export async function platformAuthenticatorAvailable() {
  if (!webauthnAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type PrfResults = { enabled?: boolean; results?: { first?: BufferSource } };

function prfFrom(cred: PublicKeyCredential): PrfResults | undefined {
  const ext = cred.getClientExtensionResults() as { prf?: PrfResults };
  return ext.prf;
}

const asArrayBuffer = (b: BufferSource): ArrayBuffer =>
  b instanceof ArrayBuffer ? b : (b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);

export async function registerBiometric(prfSalt: Uint8Array): Promise<{ credentialId: Uint8Array; secret: ArrayBuffer }> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'SpendVault' },
      user: { id: randomBytes(16), name: 'SpendVault vault', displayName: 'SpendVault' },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Biometric registration was cancelled.');
  const credentialId = new Uint8Array(cred.rawId);
  const prf = prfFrom(cred);
  if (prf?.enabled === false) throw new Error('PRF_UNSUPPORTED');
  // Some authenticators return the PRF output at creation, others only on assertion.
  if (prf?.results?.first) return { credentialId, secret: asArrayBuffer(prf.results.first) };
  const secret = await biometricSecret(credentialId, prfSalt);
  return { credentialId, secret };
}

export async function biometricSecret(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<ArrayBuffer> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Biometric check was cancelled.');
  const prf = prfFrom(cred);
  if (!prf?.results?.first) throw new Error('PRF_UNSUPPORTED');
  return asArrayBuffer(prf.results.first);
}
