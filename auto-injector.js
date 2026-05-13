/* auto-injector.js — Automatically requests and injects TOTP on page load */
"use strict";

(async function() {
  if (window.autom8edAutoInjected) return;
  window.autom8edAutoInjected = true;

  try {
    // Request TOTP code from background worker for the current URL
    const response = await chrome.runtime.sendMessage({ type: "REQUEST_AUTO_INJECT", url: location.href });
    if (response && response.status === "success") {
      if (typeof window.autom8edInjectCode === 'function') {
        window.autom8edInjectCode(response.code, response.selector, response.autoSubmit, response.profileName);
      } else {
        console.warn("[Autom8ed] injector.js not found in frame.");
      }
    } else if (response && response.status === "locked") {
      console.log("[Autom8ed] Vault is locked. Cannot auto-inject.");
    }
  } catch(e) {
    console.log("[Autom8ed] Auto-inject failed or background worker not ready:", e);
  }
})();
