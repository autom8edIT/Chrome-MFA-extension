/* injector.js — Autom8ed Vault Content Script
   - Receives TOTP codes from popup
   - Injects into specified selector or common MFA fields
   - Auto-submits if configured
   - Handles field resets with retry logic
*/

"use strict";

// Prevent multiple initializations in the same frame
if (!window.autom8edInjectorReady) {
  window.autom8edInjectorReady = true;

  // Listen for injection commands from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "INJECT_TOTP") {
      window.autom8edInjectCode(message.code, message.selector, message.autoSubmit, message.profileName);
      sendResponse({ status: "injected" });
    }
    return true;
  });

  window.autom8edInjectCode = async function(code, customSelector, autoSubmit, profileName) {
  console.log(`[Autom8ed Vault] Injecting TOTP for profile: ${profileName}`);

  // Selectors to try (custom first, then common patterns)
  const selectors = [
    customSelector,
    '#tokencode',
    'input[name="otp"]',
    'input[name="otpCode"]',
    'input[name="token"]',
    'input[name="code"]',
    'input[type="tel"][autocomplete="one-time-code"]',
    'input[autocomplete="one-time-code"]',
    'input[placeholder*="code" i]',
    'input[placeholder*="token" i]',
    'input[aria-label*="code" i]',
    'input[id*="otp" i]',
    'input[id*="mfa" i]',
    'input[id*="2fa" i]',
    'input[class*="otp" i]',
    'input[class*="mfa" i]'
  ].filter(s => s); // Remove nulls

  let targetInput = null;

  // Find first matching input
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        targetInput = el;
        console.log(`[Autom8ed] Found input via selector: ${sel}`);
        break;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  if (!targetInput) {
    console.warn("[Autom8ed] No MFA input field found. Code copied to clipboard.");
    return;
  }

  // Inject code with retry logic (handles field resets)
  const fillAndValidate = () => {
    targetInput.focus();
    targetInput.value = code;
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    targetInput.dispatchEvent(new Event('blur', { bubbles: true }));

    // Also trigger keyboard events for picky sites
    targetInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    targetInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  };

  // Initial fill
  fillAndValidate();
  console.log(`[Autom8ed] Code injected: ${code}`);

  // Retry after delay to defeat field resets
  setTimeout(() => {
    if (targetInput.value !== code) {
      console.log("[Autom8ed] Field was reset, re-injecting...");
      fillAndValidate();
    }
  }, 300);

  // Auto-submit if enabled
  if (autoSubmit) {
    setTimeout(() => {
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        console.log("[Autom8ed] Auto-submitting form...");
        submitBtn.click();
      } else {
        console.warn("[Autom8ed] No submit button found for auto-submit.");
      }
    }, 500);
  }
}

function findSubmitButton() {
  // Common submit button patterns
  const buttonSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[name="_eventId_proceed"]',
    '#LogonButton',
    'button:has-text("Submit")',
    'button:has-text("Verify")',
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")'
  ];

  for (const sel of buttonSelectors) {
    try {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) return btn;
    } catch (e) {
      // Invalid selector
    }
  }

  // Fallback: find any button with submit-like text
  const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
  for (const btn of allButtons) {
    const text = (btn.textContent || btn.value || "").toLowerCase();
    if (text.match(/submit|verify|continue|sign|log|next/i) && !btn.disabled) {
      return btn;
    }
  }

  return null;
}

// Visual feedback overlay (optional - shows injection success)
function showInjectionOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #00cc66 0%, #00aa55 100%);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
  `;
  overlay.textContent = '✅ TOTP Code Injected';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.transition = 'opacity 0.3s ease-out';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }, 2000);
}

  console.log("[Autom8ed v4.6] Content script loaded and ready.");
}
