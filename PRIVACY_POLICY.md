# Privacy Policy for Autom8ed Vault

**Effective Date:** May 6, 2026

## 1. Introduction
Autom8ed Vault ("the Extension") is committed to providing a secure, offline, and private two-factor authentication (2FA) experience. This Privacy Policy explains how we handle your data to ensure full compliance with the Google Chrome Web Store User Data Policy.

## 2. Data Collection and Usage
**The Extension does not collect, transmit, distribute, or sell any of your personal data.** 
All operations are performed locally within your browser. 

- **TOTP Secrets & Vault Data:** All secrets, authentication keys, and account labels you configure are stored exclusively on your local device. We do not operate any backend servers, nor do we sync your data to any cloud service.
- **Auto-Injection:** To provide its core functionality, the Extension reads the current webpage's structure (DOM) solely for the purpose of identifying MFA/OTP input fields and injecting the generated one-time passwords. This data is processed locally in real-time and is never saved or transmitted.
- **Usage Tracking:** We do not employ analytics, trackers, or telemetry. We do not track your browsing history, usage habits, or the sites where you generate codes.

## 3. Storage and Security
Your sensitive vault data is stored using the `chrome.storage.local` API provided by your browser. 
- **Encryption:** Data is encrypted at rest using industry-standard **AES-GCM (256-bit)** encryption. The encryption keys are derived locally from your user-provided Master Password using **PBKDF2**.
- **Session:** Temporary operational states (like unlocked status) are stored securely in `chrome.storage.session` and are wiped automatically when the browser is closed.

## 4. Third-Party Sharing
We do not sell, trade, or otherwise transfer your information to outside parties. Because no data ever leaves your device, there is absolutely no data available for us to share.

## 5. Chrome Web Store User Data Policy Compliance
The Extension's use and transfer to any other app of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/user_data/), including the Limited Use requirements. Specifically:
- We request the absolute minimum permissions necessary (e.g., `storage` for saving the vault, `scripting` for on-demand injection).
- We do not handle personal or sensitive user data outside of the immediate local execution environment.

## 6. Your Control & Data Retention
You have full control over your data. You can export a backup of your vault at any time. To completely remove all data associated with the Extension, you can simply uninstall it from your browser, which will immediately delete the local storage container.

## 7. Contact Information
If you have any questions or concerns regarding this Privacy Policy, please contact the developer at:
[autom8edit@gmail.com](mailto:autom8edit@gmail.com)
