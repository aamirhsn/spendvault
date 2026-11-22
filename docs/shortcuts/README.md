# Fiscus × iOS Shortcuts

Capture bank / UPI / card SMS into Fiscus. Everything runs on your iPhone; the message is never sent to any server.

Apple doesn't allow **automations** to be shared, and only **signed** shortcut files can be imported. So setup is: (A) get the shortcut, (B) create the automation on your iPhone that runs it.

Pick the one that matches how you open Fiscus:

| You open Fiscus from… | Use | What it does |
|---|---|---|
| **Home Screen icon** (recommended) | **Copy SMS for Fiscus** | Copies the SMS (auto-clears after 10 min) and shows a notification. Open Fiscus and tap **💬** on Home. |
| **Safari** | **Log to Fiscus** | Opens Fiscus with the spend ready — tap **Add**. |

> Home Screen web apps keep their data separate from Safari, so a link opened from Shortcuts can't reach the installed app's data — that's why the Home Screen version uses the clipboard.

## A. Get the shortcut

### Option 1 — import the file (needs a Mac, one command)
1. Download the `.shortcut` file from this folder to your Mac.
2. Sign it:
   ```sh
   shortcuts sign --mode anyone --input "Copy SMS for Fiscus (unsigned).shortcut" --output "Copy SMS for Fiscus.shortcut"
   ```
3. AirDrop the signed file to your iPhone and tap **Add Shortcut**.

### Option 2 — build it on your iPhone (≈1 minute)
**Copy SMS for Fiscus**
1. Shortcuts → **+** → name it *Copy SMS for Fiscus*.
2. Add **Copy to Clipboard** → input: **Shortcut Input**. Tap the arrow → **Local Only** on, **Expire At** *In 10 minutes*.
3. Add **Show Notification** → *Bank SMS copied — open Fiscus and tap Paste*.

**Log to Fiscus** (Safari)
1. Shortcuts → **+** → name it *Log to Fiscus*.
2. Add **URL Encode** → input: **Shortcut Input**.
3. Add **Open URLs** → `https://aamirhsn.github.io/spendvault/#sms=` followed by the **URL Encoded Text** variable.

## B. Create the automation (on iPhone)
1. Shortcuts → **Automation** → **+** → **Message**.
2. **Message Contains**: `debited` → **Run Immediately** → Next.
3. Add action **Run Shortcut** → choose your shortcut → tap the arrow and set **Input** to **Shortcut Input** (the message).
4. Repeat with `spent` (and `sent Rs` if your bank uses it).

Only messages containing those words trigger it, and Fiscus still asks before saving anything. Rules in **Settings → SMS Rules** set names, categories and cards automatically.
