# Chrome MFA Auto-Injector Extension

A Chrome extension that automatically injects your Multi-Factor Authentication (MFA) codes into web forms, saving you time and effort during login processes.

## Features

- 🔒 **Secure Storage**: MFA codes are securely stored using Chrome's sync storage
- 🎯 **Smart Detection**: Automatically detects MFA input fields on web pages
- ⚡ **Auto-Injection**: Instantly fills in your MFA codes when detected
- 🎨 **Modern UI**: Clean and intuitive popup interface for managing codes
- 🔄 **Site Matching**: Intelligent URL matching to inject codes on the right sites
- 📝 **Custom Selectors**: Support for custom CSS selectors for tricky sites

## Installation

### From Source

1. Clone this repository or download the ZIP file:
   ```bash
   git clone https://github.com/autom8edIT/Chrome-MFA-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" by toggling the switch in the top right corner

4. Click "Load unpacked" button

5. Select the directory containing the extension files

6. The MFA Auto-Injector extension icon should now appear in your Chrome toolbar

## Usage

### Adding an MFA Code

1. Click the MFA Auto-Injector icon in your Chrome toolbar
2. Fill in the form with:
   - **Site Name**: A friendly name for the site (e.g., "GitHub")
   - **Site URL Pattern**: The domain of the site (e.g., "github.com")
   - **MFA Code**: Your 6-digit MFA code
   - **Input Selector** (optional): A CSS selector for the MFA input field
3. Click "Add Code" to save

### Automatic Code Injection

Once you've added MFA codes:

1. Navigate to a website that matches one of your saved URL patterns
2. When an MFA input field is detected, the extension will automatically inject your code
3. A notification will appear confirming the injection

### Managing Saved Codes

- **View Codes**: Open the extension popup to see all saved codes
- **Delete a Code**: Click the "Delete" button next to any saved code
- **Clear All**: Use the "Clear All Codes" button to remove all saved codes at once

## How It Works

1. **Content Script**: Runs on all web pages and monitors for MFA input fields
2. **Background Service Worker**: Manages communication between components
3. **Storage**: Securely stores your MFA codes using Chrome's sync storage
4. **Auto-Detection**: Uses common patterns to identify MFA input fields:
   - Fields with "code", "mfa", "otp", "2fa" in their name or ID
   - Fields with `autocomplete="one-time-code"` attribute
   - Custom selectors you specify

## Security Considerations

⚠️ **Important Security Notes:**

- MFA codes are stored locally in Chrome's sync storage
- Codes are synced across your Chrome browsers if you're signed in
- This extension is for convenience and may reduce security
- Use with caution and only on trusted devices
- Consider using TOTP apps (like Google Authenticator) for better security
- Never share your MFA codes with anyone

## File Structure

```
Chrome-MFA-extension/
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup interface
├── popup.css           # Popup styling
├── popup.js            # Popup functionality
├── background.js       # Background service worker
├── content.js          # Content script for code injection
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE             # MIT License
└── README.md           # This file
```

## Development

This extension is built using Manifest V3, the latest Chrome extension standard.

### Key Technologies

- **Manifest V3**: Modern Chrome extension architecture
- **Chrome Storage API**: Secure storage for MFA codes
- **Content Scripts**: Page interaction for code injection
- **Service Workers**: Background processing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This extension is provided as-is for convenience purposes. The authors are not responsible for any security implications of using this extension. Use at your own risk and ensure you understand the security trade-offs of storing MFA codes in your browser.

## Support

If you encounter any issues or have suggestions, please open an issue on GitHub.
