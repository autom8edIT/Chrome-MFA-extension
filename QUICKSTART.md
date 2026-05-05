# 🚀 Quick Start Guide - Autom8ed TOTP v4.6

## Installation Steps

### 1. Add Icons (Optional but Recommended)
The extension needs icon files. You have two options:

**Option A: Use existing icons**
- Copy `icon*.png` files from `autom8ed-MFA_Working` folder
- Paste into `Chrome-MFA-v4.5-Sonnet` folder

**Option B: Skip icons (extension will still work)**
- Chrome will show warnings but extension functions normally
- You can add icons later

### 2. Load Extension in Chrome

1. Open Google Chrome
2. Navigate to: `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"** button
5. Browse to and select: `C:\Users\Joel\Documents\GitHub\autom8ed-tools\Chrome-MFA-v4.5-Sonnet`
6. Click **"Select Folder"**

✅ Extension should now appear in your toolbar!

### 3. Test with Your Twitter Account

1. Click the extension icon (🔐 in toolbar)
2. Click **"⚙️ Manage Profiles"** link at bottom
3. In the manager page, paste this into the **Secret** field:
   ```
   otpauth://totp/Twitter:@2happyCSGO?secret=ABCDEFGHJKLMNOPQRSTUVWZ&issuer=Twitter
   ```
4. Notice the **Label auto-fills** to `@2happyCSGO`
5. Click **"💾 Save Profile"**
6. Profile appears in the list below
7. Close manager, click extension icon again
8. You should see **"@2happyCSGO"** button in popup!

### 4. Generate Your First Code

1. Click the **"@2happyCSGO"** button in popup
2. Code is **copied to clipboard**
3. Status message shows: `✅ XXXXXX copied to clipboard!`
4. Paste wherever you need it

---

## Next Steps

### Add More Profiles
- Open manager (click extension → "⚙️ Manage Profiles")
- Paste any `otpauth://` URI or Base32 secret
- Save and it appears in popup (up to 4 shown)

### Configure Auto-Injection
1. Open manager
2. Click **"Edit"** on a profile
3. Add **CSS Selector**: `#tokencode` (or whatever the site uses)
4. Enable **"Auto-submit form after injection"** if desired
5. Click **"💾 Save Profile"**
6. Now when you click the button, it auto-fills the field!

### Import Bulk Accounts
1. Export from Google Authenticator (Transfer accounts → QR code)
2. Scan QR with phone to get `otpauth-migration://` URI
3. Paste into manager secret field
4. All accounts import at once!

### Export Backup
1. Click **"📤 Export Vault"** in manager
2. Save JSON file somewhere safe
3. Import later with **"📥 Import Vault"**

---

## File Locations

**Extension folder:**
```
C:\Users\Joel\Documents\GitHub\autom8ed-tools\Chrome-MFA-v4.5-Sonnet
```

**Your old working extension:**
```
C:\Users\Joel\Documents\GitHub\autom8ed-tools\autom8ed-MFA_Working
```

**Icons you can copy from old extension:**
- icon16.png
- icon32.png
- icon48.png
- icon64.png
- icon128.png

---

## Troubleshooting

### Extension not showing in toolbar
- Pin it: Click puzzle piece icon → Pin Autom8ed TOTP

### "No profiles configured" message
- Click "⚙️ Manage Profiles" and add some!

### Injection not working
- Add custom CSS selector in manager
- Or just use clipboard copy (manual paste)

### Need to uninstall old version?
- Go to `chrome://extensions/`
- Find old "Autom8ed TOTP" versions
- Click "Remove"

---

## What Makes v4.6 Special?

✅ **Smart label extraction** - Parses URIs automatically  
✅ **Base32 validation** - Won't save invalid secrets  
✅ **Auto-profileMap** - New profiles appear in popup automatically  
✅ **Import validation** - Detailed error messages  
✅ **Export timestamps** - Know when you backed up  
✅ **Duplicate detection** - Warns before overwriting  
✅ **Edit indicators** - Visual feedback while editing  
✅ **Better errors** - Specific messages instead of generic fails  
✅ **Live countdowns** - See time remaining for current code  

All requested improvements implemented! 🎉

---

**Enjoy your new TOTP manager! 🔐**

Questions? Check README.md for full documentation.
