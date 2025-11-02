// Content script to auto-inject MFA codes
(function() {
  'use strict';
  
  console.log('MFA Auto-Injector content script loaded');
  
  // Function to find MFA input fields
  function findMFAInputs() {
    const inputs = [];
    
    // Common selectors for MFA input fields
    const commonSelectors = [
      'input[type="text"][name*="code"]',
      'input[type="text"][id*="code"]',
      'input[type="text"][name*="mfa"]',
      'input[type="text"][id*="mfa"]',
      'input[type="text"][name*="otp"]',
      'input[type="text"][id*="otp"]',
      'input[type="text"][name*="2fa"]',
      'input[type="text"][id*="2fa"]',
      'input[type="text"][name*="verification"]',
      'input[type="text"][id*="verification"]',
      'input[type="text"][name*="authenticator"]',
      'input[type="text"][id*="authenticator"]',
      'input[type="tel"][name*="code"]',
      'input[type="tel"][id*="code"]',
      'input[type="number"][name*="code"]',
      'input[type="number"][id*="code"]',
      'input[autocomplete="one-time-code"]'
    ];
    
    commonSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!inputs.includes(el)) {
            inputs.push(el);
          }
        });
      } catch (e) {
        console.error('Error with selector:', selector, e);
      }
    });
    
    return inputs;
  }
  
  // Function to inject MFA code into input field
  function injectCode(input, code) {
    // Set the value
    input.value = code;
    
    // Trigger various events to ensure the page recognizes the input
    const events = ['input', 'change', 'keyup', 'keydown'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
    });
    
    // Focus the input
    input.focus();
    
    console.log('MFA code injected successfully');
  }
  
  // Function to match current URL with saved codes
  function matchCurrentSite(codes) {
    const currentUrl = window.location.hostname;
    
    for (const codeData of codes) {
      if (currentUrl.includes(codeData.siteUrl) || codeData.siteUrl.includes(currentUrl)) {
        return codeData;
      }
    }
    
    return null;
  }
  
  // Main function to attempt auto-injection
  function attemptAutoInjection() {
    chrome.runtime.sendMessage({ action: 'getMFACodes' }, function(response) {
      if (!response || !response.codes || response.codes.length === 0) {
        console.log('No MFA codes saved');
        return;
      }
      
      const matchedCode = matchCurrentSite(response.codes);
      
      if (!matchedCode) {
        console.log('No matching MFA code for this site');
        return;
      }
      
      let inputs = [];
      
      // If custom selector is provided, try that first
      if (matchedCode.selector) {
        try {
          const customInput = document.querySelector(matchedCode.selector);
          if (customInput) {
            inputs.push(customInput);
          }
        } catch (e) {
          console.error('Error with custom selector:', e);
        }
      }
      
      // Fallback to common selectors
      if (inputs.length === 0) {
        inputs = findMFAInputs();
      }
      
      if (inputs.length > 0) {
        // Inject into the first matching input
        injectCode(inputs[0], matchedCode.mfaCode);
        
        // Visual feedback
        showNotification('MFA code auto-injected!');
      } else {
        console.log('No MFA input fields found on this page');
      }
    });
  }
  
  // Function to show notification
  function showNotification(message) {
    if (!document.body) {
      console.log('Cannot show notification: document.body is null');
      return;
    }
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Wait for page to be ready and attempt injection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(attemptAutoInjection, 1000);
    });
  } else {
    setTimeout(attemptAutoInjection, 1000);
  }
  
  // Also watch for dynamically added inputs
  if (document.body) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const inputs = findMFAInputs();
          if (inputs.length > 0) {
            attemptAutoInjection();
            break;
          }
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    console.log('Cannot observe mutations: document.body is null');
  }
})();
