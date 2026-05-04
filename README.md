# 🔐 Autom8ed TOTP Manager v4.5 - Vault Edition

**Full-featured Chrome extension for TOTP (Time-based One-Time Password) management with auto-injection capabilities.**

---

## 🎉 What's New in v4.5 (Vault Edition)

Version 4.5 represents a complete merger of the working auto-injector with the full vault manager, enhanced with all requested improvements:

### ✨ New Features

#### Manager Improvements
- **Auto-extract label from URIs** - Parses `otpauth://totp/Twitter:@user` and extracts `@user` automatically
- **Base32 secret validation** - Validates secrets before saving to prevent runtime errors
- **Smart profileMap management** - Auto-adds new profiles to popup (if <4 slots available)
- **Import validation** - Detailed error messages for invalid entries, skips bad secrets
- **Export with timestamp** - Files named like `autom8ed_totp_vault_2026-02-20T15-30-45.json`
- **Duplicate detection** - Warns when migration imports would overwrite existing profiles
- **Edit mode indicator** - Visual feedback showing which profile is being edited
- **Better error messages** - Specific errors like "Invalid Base32 characters" instead of generic failures
- **Issuer parameter support** - Uses issuer from URIs when available

#### Popup Enhancements
- **Live countdown timers** - Shows seconds remaining for current TOTP period
- **Auto-clipboard copy** - Copies codes to clipboard when clicked
- **Visual status feedback** - Success/error messages in popup
- **Auto-submit indicator** - Shows 🔄 badge for profiles with auto-submit enabled

#### Injection Improvements
- **Smart field detection** - Tries 15+ common MFA input selectors
- **Retry logic** - Defeats field resets with automatic re-injection
- **Auto-submit** - Configurable per-profile auto-submit after injection
- **Custom selectors** - Per-profile CSS selectors for site-specific targeting

---

## 📁 File Structure

```
Chrome-MFA-v4.5/
├── manifest.json           # Extension manifest
├── popup.html              # Popup interface (4 profile buttons)
├── popup.js                # TOTP generation & injection logic
├── manager.html            # Full vault management UI
├── manager.js              # Enhanced manager with all improvements
├── injector.js             # Content script for auto-injection
├── styles.css              # Shared styles for manager
├── README.md               # This file
└── icons/                  # Extension icons (16/32/48/64/128px)
```

---

## 🚀 Installation

### Option 1: Load Unpacked (Development)
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `Chrome-MFA-v4.5` folder
5. Extension icon appears in toolbar

### Option 2: Pack Extension
1. In `chrome://extensions/`, click "Pack extension"
2. Select the `Chrome-MFA-v4.5` folder
3. Install the generated `.crx` file

---

## 📖 Usage Guide

### Adding Your First Profile

1. **Click extension icon** → **"⚙️ Manage Profiles"**
2. **Paste your secret** (supports 3 formats):
   - **Base32 secret**: `ABCDEFGHJKLMNOPQRSTUVWZ`
   - **otpauth:// URI**: `otpauth://totp/Twitter:@user?secret=ABCDEFGHJKLMNOPQRSTUVWZ=Twitter`
   - **Google Auth migration**: `otpauth-migration://offline?data=...`
3. **Label auto-fills** from URI (or enter manually)
4. **Adjust settings** (digits, period, algorithm) if needed
5. **(Optional) Add CSS selector** for auto-injection: `#tokencode`
6. **(Optional) Enable auto-submit** to click submit button after injection
7. **Click "💾 Save Profile"**

### Using TOTP Codes

#### Method 1: Manual Copy (Popup)
1. Click extension icon in toolbar
2. Click desired profile button
3. Code is **copied to clipboard** and **injected** (if selector configured)
4. Paste manually if injection didn't work

#### Method 2: Auto-Injection (Content Script)
1. Navigate to MFA page
2. Click profile in popup
3. Code auto-fills and optionally submits
4. Works without clicking if selector matches

### Importing Profiles

#### From Google Authenticator Export
1. Export from Google Authenticator app (QR code → "Transfer accounts")
2. Use a QR scanner to get the `otpauth-migration://` URI
3. Paste into manager secret field
4. All accounts import automatically

#### From JSON Vault
1. Click "📥 Import Vault" in manager
2. Select `autom8ed_totp_vault_*.json` file
3. Validates and imports valid entries

### Exporting Vault
1. Click "📤 Export Vault" in manager
2. Downloads `autom8ed_totp_vault_2026-02-20T15-30-45.json`
3. Safe to backup or transfer to another browser

---

## 🔧 Configuration

### Storage Schema

**Chrome Local Storage:**
```json
{
  "vault": {
    "Twitter": {
      "secret": "ABCDEFGHJKLMNOPQRSTUVWZ",
      "digits": 6,
      "period": 30,
      "algo": "SHA1",
      "label": "@2happyCSGO",
      "selector": "#tokencode",
      "autoSubmit": false
    },
    "O365": {
      "secret": "ABCDEFGHJKLMNOPQRSTUVWZ",
      "digits": 6,
      "period": 30,
      "algo": "SHA1",
      "label": "Office 365",
      "selector": "input[name='otpCode']",
      "autoSubmit": true
    }
  },
  "profileMap": ["Twitter", "O365", "VPN", "GitHub"]
}
```

### Supported Algorithms
- **SHA1** (most common, default)
- **SHA256**
- **SHA512**

### Supported Formats
- **6-digit codes** (default, standard)
- **7-digit codes** (Steam, etc.)
- **8-digit codes** (some banks)
- **15-60 second periods** (30s default)

---

## 🛠️ Technical Details

### TOTP Generation
- **Algorithm**: RFC 6238 compliant
- **Implementation**: Web Crypto API (SubtleCrypto)
- **Base32 decoding**: Custom implementation with validation
- **Hash functions**: SHA-1, SHA-256, SHA-512

### Auto-Injection Strategy
1. **Selector priority**: Custom selector → Common patterns
2. **Retry logic**: Re-injects after 300ms to defeat field resets
3. **Event dispatch**: `input`, `change`, `blur`, `keydown`, `keyup`
4. **Submit detection**: 10+ button selector patterns + text matching

### Security Considerations
- **Local storage only** - Secrets never leave your browser
- **No cloud sync** - Use manual export/import for backups
- **Content script isolation** - Runs in sandboxed context
- **No network requests** - 100% offline after installation

---

## 🎯 Examples

### Twitter Example
```
URI: otpauth://totp/Twitter:@2happyCSGO?secret=ABCDEFGHJKLMNOPQRSTUVWZ&issuer=Twitter

Extracted:
- Label: @2happyCSGO (auto-detected from ":@2happyCSGO")
- Secret: ABCDEFGHJKLMNOPQRSTUVWZ
- Digits: 6 (default)
- Period: 30 (default)
- Algorithm: SHA1 (default)
```

### Custom Configuration
```
Label: Amazing Login
Secret: ABCDEFGHJKLMNOPQRSTUVWZ
Digits: 6
Period: 30
Algorithm: SHA1
Selector: input[name="token"]
Auto-submit: ✓
```

---

## 🐛 Troubleshooting

### "No MFA input field found"
- **Solution**: Add custom CSS selector in manager
- **Find selector**: Right-click input → Inspect → Copy selector

### "Invalid Base32 secret"
- **Solution**: Check for invalid characters (only A-Z, 2-7 allowed)
- **Common issue**: Lowercase letters or spaces (auto-cleaned)

### Auto-submit not working
- **Solution 1**: Disable auto-submit and click manually
- **Solution 2**: Site may have anti-automation protections

### Code not injecting
- **Solution**: Click popup button to copy, paste manually
- **Check**: Console logs in DevTools (F12) for error messages

---

## 📝 Version History

### v4.5 (Vault Edition) - 2026-02-20
- ✨ Complete merger of working injector + vault manager
- ✅ All 9 requested improvements implemented
- 🎨 Modern UI with gradient styles
- 🔄 Smart profileMap auto-management
- 📊 Live countdown timers in popup
- 🛡️ Base32 validation + error handling
- 📦 Export with timestamps
- 🔍 Duplicate detection on import
- 🎯 Auto-label extraction from URIs
- ✏️ Edit mode visual indicators

### v3.1 - Previous stable release
### v3.0.6 - Working auto-injector base

---

## 🙏 Credits

**Created by**: autom8ed  
**Enhanced by**: VS Code Agent Mode
**Version**: 4.5.0 "Vault Edition"  
**Date**: February 20, 2026

---

## 📄 License

Personal use project. No license restrictions.

---

## 🎉 Enjoy!

You now have a full-featured TOTP manager that:
- ✅ Imports from Google Authenticator exports
- ✅ Parses `otpauth://` URIs with auto-label extraction
- ✅ Validates secrets before saving
- ✅ Auto-injects codes into websites
- ✅ Manages up to 4 quick-access profiles
- ✅ Exports/imports full vault with validation
- ✅ Shows live countdown timers
- ✅ Supports custom selectors per profile
- ✅ Auto-submits forms (optional)

**Happy authenticating! 🔐**
