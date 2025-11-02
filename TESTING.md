# Testing the Chrome MFA Extension

This guide will help you test the Chrome MFA Auto-Injector extension to ensure it's working correctly.

## Installation Test

1. **Load the Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the extension directory
   - The extension icon should appear in the toolbar

2. **Verify Installation**
   - Click the extension icon
   - You should see the "MFA Code Auto-Injector" popup
   - The interface should display an empty "Saved MFA Codes" section

## Functionality Tests

### Test 1: Adding an MFA Code

1. Click the extension icon to open the popup
2. Fill in the form:
   - Site Name: `Test Site`
   - Site URL Pattern: `example.com`
   - MFA Code: `123456`
   - Input Selector: (leave empty)
3. Click "Add Code"
4. You should see:
   - A green success message
   - The new code appear in "Saved MFA Codes" section (code shown as `••••••`)

### Test 2: Viewing Saved Codes

1. Open the extension popup
2. Verify your test code is listed with:
   - Site name
   - Site URL pattern
   - Hidden code value (••••••)
   - Delete button

### Test 3: Deleting a Code

1. Click the "Delete" button next to a saved code
2. Confirm the deletion in the dialog
3. Verify:
   - Success message appears
   - Code is removed from the list

### Test 4: Auto-Injection (Manual Test Page)

Create a test HTML file to verify auto-injection:

```html
<!DOCTYPE html>
<html>
<head>
    <title>MFA Test Page</title>
</head>
<body>
    <h1>Test MFA Input</h1>
    <form>
        <label>Enter MFA Code:</label>
        <input type="text" id="mfa-code" name="code" placeholder="000000">
        <br><br>
        <label>Another field:</label>
        <input type="text" id="otp-code" name="otp" placeholder="000000">
    </form>
</body>
</html>
```

1. Save this as `test-mfa.html` and open it in Chrome
2. Add an MFA code in the extension with:
   - Site Name: `Test Page`
   - Site URL: `localhost` or the path where you opened the file
   - MFA Code: `999888`
3. Reload the test page
4. The code should be automatically injected into the first MFA input field
5. A green notification should appear in the top-right corner

### Test 5: Custom Selector

1. Using the same test HTML page
2. Add a new code with:
   - Site Name: `Test OTP`
   - Site URL: `localhost`
   - MFA Code: `777666`
   - Input Selector: `#otp-code`
3. Reload the page
4. The code should be injected into the `#otp-code` field specifically

### Test 6: Clear All Codes

1. Open the extension popup
2. Click "Clear All Codes"
3. Confirm the action
4. Verify all codes are removed

## Common MFA Field Patterns

The extension detects fields with these patterns:
- `input[name*="code"]`
- `input[id*="mfa"]`
- `input[name*="otp"]`
- `input[id*="2fa"]`
- `input[name*="verification"]`
- `input[autocomplete="one-time-code"]`

## Troubleshooting

### Extension Icon Not Showing
- Verify "Developer mode" is enabled
- Check for errors in `chrome://extensions/`
- Try reloading the extension

### Code Not Auto-Injecting
- Check that the URL pattern matches the current page
- Open browser console (F12) to check for errors
- Verify the page has a recognized MFA input field
- Try adding a custom selector for the specific site

### Storage Issues
- Check Chrome sync is enabled if you want codes across devices
- Storage is limited to Chrome's sync storage quota
- Clear browser data may remove saved codes

## Security Notes

⚠️ Remember:
- This is a development/testing extension
- Real MFA codes should be handled with care
- Don't use actual credentials in testing
- Consider security implications before using with real accounts

## Expected Console Messages

In the browser console (F12), you should see:
- `MFA Auto-Injector content script loaded` (on page load)
- `MFA Auto-Injector service worker loaded` (in background page)
- Various messages about code injection attempts

## Reporting Issues

If you encounter bugs:
1. Check the browser console for errors
2. Verify all files are present in the extension directory
3. Test with the simple HTML test page first
4. Open an issue on GitHub with:
   - Steps to reproduce
   - Browser version
   - Console error messages
   - Screenshots if applicable
