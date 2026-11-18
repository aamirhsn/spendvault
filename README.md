# SpendVault

A private, offline-first web app (PWA) for tracking spends, storing credit/debit cards and gift cards, and finding the **MCC of any UPI QR code** — with an Apple *Liquid Glass*-inspired interface.

Everything you enter stays on your device, encrypted. There is no backend, no account and no analytics; the production build ships a CSP that blocks every network origin except its own files.

## Features

| Area | What it does |
|---|---|
| **Home** | Month total with month-on-month change and budget progress, 30/90-day spending chart, category donut, 6-month bars, “paid with” split, card dues & gift card balance tiles, upcoming due dates / expiring gift cards, quick actions |
| **Spends** | Amount, date, card used (from the Card Vault) or UPI / cash / net banking / wallet, description, category, notes, linked merchant, and **pay partly or fully with gift cards** — balances are deducted automatically and refunded if you edit or delete the spend. Month browser, search and category filters |
| **MCC Scanner** | Scan a UPI QR with the camera (native `BarcodeDetector`, falling back to jsQR), from an image, or paste a `upi://` link. Shows payee, UPI ID, MCC + description, category and a warning for MCCs that are often excluded from card rewards. Save merchants to build your own MCC record and log a spend from them in one tap |
| **Gift Cards** | Amazon, Flipkart, Myntra, Swiggy, Zomato and 15+ more brands (or custom). Code, PIN, value, live balance, expiry, notes, usage history, archive |
| **Cards** | Credit/debit cards with network auto-detect and Luhn check, expiry, optional CVV, credit limit, statement day, due day, total / minimum / overdue amounts, unbilled spend this cycle, available limit, utilisation, “mark paid”. Numbers, CVVs and gift card PINs are masked and need biometric/passcode re-verification to reveal or copy |
| **Settings** | Biometric unlock, auto-lock timer, change passcode, encrypted backup / restore, CSV export, theme (auto/light/dark), currency, monthly budget, erase data |

## Security model

- **Encryption at rest:** all data is stored in IndexedDB as a single AES-256-GCM ciphertext (random 96-bit IV per save, purpose-bound additional data).
- **Key hierarchy:** a random 256-bit data key encrypts the data. That key is *wrapped* by:
  - your passcode → PBKDF2-SHA256, 600,000 iterations, random salt;
  - optionally your biometrics → WebAuthn **PRF extension** secret from the platform authenticator (Face ID, Touch ID, Windows Hello, Android fingerprint) → HKDF-SHA256.
  
  While unlocked, the data key lives in memory only as a non-extractable `CryptoKey`; locking drops it.
- **Brute-force friction:** escalating lockout after 5 wrong passcodes. A password is recommended over the 6-digit PIN option.
- **Auto-lock** after inactivity or when the app is in the background longer than the timeout.
- **Backups** are encrypted with a separate backup password, so they can be restored on another device.
- **No recovery:** if you forget the passcode the data cannot be decrypted. Keep an encrypted backup.

Biometric unlock needs a browser with WebAuthn PRF support (Safari 18+ on iOS/macOS, recent Chrome/Edge). Elsewhere the app still works with the passcode. Camera and WebAuthn require HTTPS (or `localhost`).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN)
npm run build      # production build in dist/
npm run preview
```

## Deploy

Any static host works (the build uses relative paths). The included workflow `.github/workflows/pages.yml` deploys to **GitHub Pages** on every push to `main` — enable it under *Settings → Pages → Source: GitHub Actions*. Then open the site on your phone and use *Add to Home Screen* to install it as an app.

Data is per browser and per origin: the vault on your phone and the one on your laptop are separate. Move data with encrypted backup/restore.

## Project layout

```
src/
  lib/        crypto.ts, vault.ts (key mgmt, backups), webauthn.ts, db.ts (IndexedDB),
              store.tsx (state + persistence + auto-lock), mcc.ts, upi.ts, categories.ts, format.ts
  components/ Charts (SVG), TabBar, Verify (re-auth), shared UI, icons
  screens/    Lock, Home, Spends, SpendForm, Scanner, GiftCards, Cards, Settings
  styles.css  Liquid Glass design system
```

Adding a feature: add a collection to `VaultData` in `src/lib/types.ts` (with a default in `emptyVault`), actions in `store.tsx`, a screen in `src/screens/`, and a tile on Home. It will be encrypted automatically.
