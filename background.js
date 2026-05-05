/* background.js — Autom8ed TOTP Service Worker
   - Handles extension lifecycle events
   - Provides a persistent context for background tasks
*/

"use strict";

// Import crypto-helper (in MV3, we use self.importScripts)
importScripts('crypto-helper.js');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Autom8ed] Extension installed successfully.");
    // Optionally open the manager page on install
    chrome.tabs.create({ url: "manager.html" });
  } else if (details.reason === "update") {
    console.log(`[Autom8ed] Updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Listener for future background tasks (e.g. keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  console.log(`[Autom8ed] Command received: ${command}`);
});
