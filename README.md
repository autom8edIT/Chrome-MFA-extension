# README.md
# Autom8ed MFA Injector — PoC (v0.1 → roadmap)

**One-liner:** Chrome extension that auto-injects TOTP codes into web login forms. Proof-of-concept now; soon with optional local Flask server and encrypted, syncable secrets.
**Status:** Working PoC. You must add your accounts/secrets in `injector.js`. Upcoming releases add safer storage and optional server-backed operation.

---

## Features (current)

* Client-side TOTP generation and auto-inject into matched login forms.
* Minimal no-server design — everything runs inside the extension (PoC).
* Simple mapping: site → selector → TOTP secret (set in `injector.js`).
* Works on static pages and many SPAs (with retry/mutation observer support).

---

## New / Upcoming (what you just told me)

* **Optional Flask server mode**
  Run a local Flask agent on one machine and let the extension query it for TOTP values. Useful if you prefer keeping secrets off the extension code but use the extension only on a single trusted device.

  * Localhost-only by default.
  * Token-based authentication to stop random sites from asking for codes.
  * Recommended for advanced single-machine workflows.

* **Encrypted secrets + Browser sync**
  Secrets will be stored encrypted inside the extension and saved to the browser's extension sync storage so your profiles follow you when you sign in to Chrome on other devices. The secret storage uses a user passphrase / key for encryption locally; the encrypted blob is what syncs across devices.

  * Secrets never stored plaintext in `injector.js`.
  * Synced ciphertext is meaningless without the passphrase.
  * You remain responsible for the passphrase. If you lose it, you lose the secrets.

---

## Security WARNING (read this)

* This is a PoC. Current version stores secrets in plaintext inside `injector.js`. That is insecure. Do not use high-value accounts with plaintext secrets.
* Upcoming encrypted sync is safer but still operator-dependent:

  * Browser-synced ciphertext is only as safe as your passphrase and browser account security.
  * If you choose the Flask-server option, run it on localhost only, behind a strong token, and never expose it to WAN.
* Recommended hardening roadmap:

  * Encrypted vault (AES-GCM or similar) with passphrase-derived key (PBKDF2/Argon2).
  * Keep secrets in RAM only while generating codes.
  * Use platform secure storage (OS keychain) where possible.
  * Minimize extension permissions and use Manifest V3.

---

## Quick install (developer mode)

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the extension folder (where `manifest.json` is)
4. Open a site with MFA, and if `injector.js` is configured the extension will attempt to inject the code.

---

## How to configure — PoC + new flags

### PoC (current)

Edit `injector.js`, populate the `ACCOUNTS` array. Example:

```js
const ACCOUNTS = [
  {
    name: "ExampleCorp",
    hostMatch: ["example.com", "login.example.com"],
    codeInputSelector: 'input[name="otp"]',
    submitButtonSelector: 'button[type="submit"]',
    secret: "JBSWY3DPEHPK3PXP" // base32 TOTP secret (temporary)
  }
];
```

### New flags (v0.2+)

Add these settings to `injector.js` (or to `options.html` when GUI is added):

```js
// injector.js (config)
const CONFIG = {
  // Mode: "local" uses built-in encrypted store; "flask" queries your local Flask server
  mode: "local", // or "flask"

  // Flask server settings (only used when mode === "flask")
  flask: {
    enabled: false,
    url: "http://127.0.0.1:8787", // default local URL
    token: "change_me_to_a_long_random_token", // Bearer token for auth
    timeoutMs: 2000
  },

  // Encrypted vault settings (local mode)
  vault: {
    enabled: true,                 // if false, fallback to static ACCOUNTS
    storage: "chrome.sync",        // planned: chrome.storage.sync for cross-device sync
    derivation: { iterations: 100000, alg: "PBKDF2" } // key derivation params
  }
};
```

Notes:

* `mode: "flask"` will attempt to fetch a TOTP for the matched account by calling the Flask endpoint (see Flask spec below).
* `vault.enabled = true` means the extension will load encrypted secrets from chrome.storage and ask the user for their passphrase when needed.
* For now, keep `flask.enabled` false unless you properly configured the Flask agent.

---

## Flask agent — minimal spec (what you'll run locally)

Run a tiny Flask server that responds only on `localhost` and implements a single authenticated endpoint:

**Endpoints**

* `GET /ping` — health check (optional)
* `POST /totp` — body: `{ "account_id": "ExampleCorp", "timestamp": 1670000000 }`

  * Requires header: `Authorization: Bearer <token>`
  * Response: `{ "totp": "123456", "valid_until": 1670000030 }`

**Security**

* Only bind to `127.0.0.1` (or Unix socket).
* Require a strong static token or HMAC signing.
* Rate-limit requests.
* Do not accept remote connections without explicit firewall rules.

This design keeps the secret entirely off extension code. The Flask app holds decrypted secrets and only returns codes.

---

## How it works (brief)

1. Content script checks hostname against configured accounts.
2. Depending on `CONFIG.mode`:

   * `local`: decrypt vault with passphrase and compute TOTP locally.
   * `flask`: call local Flask endpoint to request a TOTP for the selected account.
3. Find the input `codeInputSelector`, fill the code, then optionally click `submitButtonSelector`.
4. For SPAs the script retries and/or uses a MutationObserver to catch dynamic DOM injection.

---

## Troubleshooting

* No injection:

  * Verify host match and `codeInputSelector`.
  * Check DevTools console for errors.
  * If using Flask: confirm `flask.url`, token, and CORS are correct. Flask must be reachable from the browser (localhost).
* Vault issues:

  * If passphrase is wrong, extension cannot decrypt secrets.
  * For sync issues, confirm browser sync is enabled for extensions and that chrome.storage.sync is operating (limits apply).
* SPA issues:

  * Increase retry attempts or bind to DOM mutations.

---

## Roadmap / TODO (updated)

* **v0.1** — PoC: manual `injector.js` config (current).
* **v0.2** — Encrypted local vault; passphrase entry UI; store ciphertext in `chrome.storage.sync`.
* **v0.3** — Optional local Flask agent mode (secure, token-based).
* **v0.4** — Options UI with profile import/export, per-profile policies (auto-click vs manual).
* **v1.0** — Production-ready: hardened manifest (V3), minimal permissions, extensive security docs, UX polish.

---

## Developer notes and security considerations

* Never log secrets or derived keys to console in release builds.
* Use AES-GCM for confidentiality + integrity. Derive keys with PBKDF2/Argon2 and a reasonable work factor.
* Limit synced data to ciphertext blobs. The passphrase stays local and never syncs.
* Prefer ephemeral RAM buffers for decrypted secrets; wipe memory after code generation.
* If you adopt platform keyrings (Windows DPAPI, macOS Keychain, Linux libsecret), design a fallback for other platforms.

---

## Contributing

* PRs welcome. For security-impacting changes, include design notes and threat model.
* If adding Flask integrations or cloud-sync features, document the exact API and threat implications.

---

## License

MIT. Use responsibly. If you sync secrets across devices, do not blame the extension for human mistakes.

---

## Changelog

* **v0.1** — Initial PoC. Manual `injector.js` configuration. Content-script TOTP injection works.
* **Planned** — Added design notes for local Flask server and encrypted syncable vault.

---

There. It now documents the Flask option and encrypted-sync plan, plus gives quick config examples you can paste into `injector.js`. If you want, I can also:

* create the minimal Flask agent skeleton (Python) that matches the spec,
* or draft the `options.html` UI for passphrase entry + profile import/export.

Pick one and I’ll make it real — begrudgingly helpful as always.
