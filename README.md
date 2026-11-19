# SpendVault

A private, offline-first web app (PWA) for tracking spends, storing credit/debit cards and gift cards, and finding the **MCC of any UPI QR code**. The interface follows Apple's iOS 26 design language: system colours, grouped lists, and Liquid Glass reserved for floating controls.

Everything you enter stays on your device, encrypted. There is no backend, no account and no analytics; the production build ships a CSP that blocks every network origin except its own files.

## Features

| Area | What it does |
|---|---|
| **Home** | Month total with month-on-month change, overall and **per-category monthly budgets**, 30/90-day spending chart, category donut, 6-month bars, “paid with” split, card dues & gift card balances, upcoming due dates / expiring gift cards |
| **Spends** | Amount, date, card used (from the Card Vault) or UPI / cash / net banking / wallet, description, category, notes, linked merchant, and **pay partly or fully with gift cards** — balances are deducted automatically and refunded if you edit or delete the spend. Month browser, search and category filters |
| **MCC Scanner** | Scan a UPI QR with the camera (native `BarcodeDetector`, falling back to jsQR), from an image, or paste a `upi://` link. Shows payee, UPI ID, MCC + description, category and a warning for MCCs that are often excluded from card rewards. Save merchants to build your own MCC record and log a spend from them in one tap |
| **Gift Cards** | Amazon, Flipkart, Myntra, Swiggy, Zomato and 15+ more brands (or custom). Code, PIN, value, live balance, expiry, notes, usage history, archive |
| **Cards** | Credit/debit cards with network auto-detect and Luhn check, expiry, optional CVV, credit limit, statement day, due day, total / minimum / overdue amounts, unbilled spend this cycle, available limit, utilisation, “mark paid”. Cards render as realistic finishes (black metal, gold, platinum, sapphire…) suggested from the card name, or use a photo of your own card. Numbers, CVVs and gift card PINs are masked and need biometric/passcode re-verification to reveal or copy |
| **Settings** | Biometric unlock, auto-lock timer, change passcode, encrypted backup / restore, CSV export, theme (auto/light/dark), currency, monthly budget, erase data |

## Security model

SpendVault keeps two encrypted tiers in this browser's IndexedDB, both using AES-256-GCM:

| Tier | What's in it | Protected by |
|---|---|---|
| **Everyday data** | spends, budgets, merchants, SMS rules, gift card balances, card names / last 4 / dues | a random device key generated on first launch and stored as a *non-extractable* WebCrypto key. The app opens straight to Home. |
| **Card vault** | full card numbers, CVV, expiry, name on card, card photos, gift card codes and PINs | a random data key wrapped by your **6-digit PIN** (PBKDF2-SHA256, 600k iterations) and, if enabled, by **Face ID / Touch ID** (WebAuthn PRF → HKDF). Opening the Cards tab or revealing a gift card code asks for it. |

- The card vault re-locks after the timeout you choose in Settings and when the app has been in the background that long.
- Escalating lockout after 5 wrong PINs.
- The device key protects everyday data from casual copying of storage files, but anyone who can use this browser profile can open the app — that's the trade-off for not locking the whole app. Card numbers and codes are never readable without your PIN or biometrics.
- Backups are encrypted with a separate backup password and include the card vault.
- **No recovery:** forget the PIN and card details can't be decrypted. Keep an encrypted backup.

## Spends from bank SMS

iOS doesn't allow any app or website to read your messages, so SpendVault offers the next best things:

- **Spends → Messages** (💬): paste one or many bank / UPI / card alerts. Amount, date, merchant / UPI ID and card (matched by last 4 digits) are detected; credits, OTPs and promos are skipped; duplicates are flagged.
- **Rules** (Settings → SMS Rules): "if the message contains *swiggy* → name *Swiggy*, category *Food & Dining*, paid with …", or ignore matching messages. A starter set is included.
- **Automation**: an iOS Shortcuts *Message* automation can forward each bank SMS to `…/spendvault/#sms=<message>`; SpendVault opens with the spend ready to confirm. Home Screen web apps keep separate storage from Safari, so if you use the installed app, have the Shortcut copy the SMS and tap **Paste** in the app.

## Logos

Bank, network and brand logos are public-domain/CC0 files from Wikimedia Commons (listed with sources in [`public/logos/CREDITS.md`](public/logos/CREDITS.md)) plus [Simple Icons](https://simpleicons.org). Any brand without a bundled logo can be given one from the add/edit form — uploads are stored encrypted in your vault. Logos are trademarks of their owners and are used only for identification.

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
