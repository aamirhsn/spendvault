# SpendVault × iOS Shortcuts

Capture bank / UPI / card SMS into SpendVault. Everything runs on your iPhone; the message is never sent to any server.

Apple doesn't allow **automations** to be shared, and only **signed** shortcut files can be imported. So setup is: (A) get the shortcut, (B) create the automation on your iPhone that runs it.

Pick the one that matches how you open SpendVault:

| You open SpendVault from… | Use | What it does |
|---|---|---|
| **Home Screen icon** (recommended) | **Copy SMS for SpendVault** | Copies the SMS (auto-clears after 10 min) and shows a notification. Open SpendVault → Spends → 💬 → **Paste**. |
| **Safari** | **Log to SpendVault** | Opens SpendVault with the spend ready — tap **Add**. |

> Home Screen web apps keep their data separate from Safari, so a link opened from Shortcuts can't reach the installed app's data — that's why the Home Screen version uses the clipboard.

## A. Get the shortcut

### Option 1 — import the file (needs a Mac, one command)
1. Download the `.shortcut` file from this folder to your Mac.
2. Sign it:
   ```sh
   shortcuts sign --mode anyone --input "Copy SMS for SpendVault (unsigned).shortcut" --output "Copy SMS for SpendVault.shortcut"
   ```
3. AirDrop the signed file to your iPhone and tap **Add Shortcut**.

### Option 2 — build it on your iPhone (≈1 minute)
**Copy SMS for SpendVault**
1. Shortcuts → **+** → name it *Copy SMS for SpendVault*.
2. Add **Copy to Clipboard** → input: **Shortcut Input**. Tap the arrow → **Local Only** on, **Expire At** *In 10 minutes*.
3. Add **Show Notification** → *Bank SMS copied — open SpendVault and tap Paste*.

**Log to SpendVault** (Safari)
1. Shortcuts → **+** → name it *Log to SpendVault*.
2. Add **URL Encode** → input: **Shortcut Input**.
3. Add **Open URLs** → `https://aamirhsn.github.io/spendvault/#sms=` followed by the **URL Encoded Text** variable.

## B. Create the automation (on iPhone)
1. Shortcuts → **Automation** → **+** → **Message**.
2. **Message Contains**: `debited` → **Run Immediately** → Next.
3. Add action **Run Shortcut** → choose your shortcut → tap the arrow and set **Input** to **Shortcut Input** (the message).
4. Repeat with `spent` (and `sent Rs` if your bank uses it).

Only messages containing those words trigger it, and SpendVault still asks before saving anything. Rules in **Settings → SMS Rules** set names, categories and cards automatically.
