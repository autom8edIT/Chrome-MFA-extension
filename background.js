// Background service worker for the MFA extension
console.log('MFA Auto-Injector service worker loaded');

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMFACodes') {
    // Retrieve MFA codes from storage
    chrome.storage.sync.get(['mfaCodes'], function(result) {
      sendResponse({ codes: result.mfaCodes || [] });
    });
    return true; // Keep the message channel open for async response
  }
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MFA Auto-Injector installed');
  } else if (details.reason === 'update') {
    console.log('MFA Auto-Injector updated');
  }
});
