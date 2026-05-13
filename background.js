/* background.js — Autom8ed Vault Service Worker
   - Handles extension lifecycle events
   - Provides a persistent context for background tasks
*/

"use strict";

// Import crypto-helper (in MV3, we use self.importScripts)
importScripts('crypto-helper.js');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Autom8ed Vault] Extension installed successfully.");
    // Optionally open the manager page on install
    chrome.tabs.create({ url: "manager.html" });
  } else if (details.reason === "update") {
    console.log(`[Autom8ed Vault] Updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Listener for future background tasks (e.g. keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  console.log(`[Autom8ed Vault] Command received: ${command}`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REQUEST_AUTO_INJECT") {
    handleAutoInject(message.url, sendResponse);
    return true; // Keep the messaging channel open for sendResponse
  }
});

async function handleAutoInject(url, sendResponse) {
  try {
    // 1. Check if vault is unlocked
    const sessionData = await chrome.storage.session.get(["masterPassword"]);
    const masterPassword = sessionData.masterPassword;
    if (!masterPassword) {
      sendResponse({ status: "locked" });
      return;
    }

    // 2. Load profiles
    const { workspaces } = await chrome.storage.local.get(["workspaces"]);
    if (!workspaces) {
      sendResponse({ status: "error", message: "No workspaces" });
      return;
    }

    // 3. Find matching profile
    let targetProfile = null;
    let targetName = null;

    for (const ws of Object.values(workspaces)) {
      if (!ws.vault) continue;
      for (const [name, profile] of Object.entries(ws.vault)) {
        if (profile.autoInjectLoad && profile.autoInjectUrl) {
          // Check if url matches profile.autoInjectUrl pattern
          let pattern = profile.autoInjectUrl;
          if (pattern.endsWith("/*")) {
            pattern = pattern.slice(0, -2);
            if (url.startsWith(pattern)) {
              targetProfile = profile;
              targetName = name;
              break;
            }
          } else if (url === pattern || url.startsWith(pattern)) {
            targetProfile = profile;
            targetName = name;
            break;
          }
        }
      }
      if (targetProfile) break;
    }

    if (!targetProfile) {
      sendResponse({ status: "not_found" });
      return;
    }

    // 4. Generate TOTP
    const decryptedSecret = await CryptoHelper.decrypt(targetProfile.secret, masterPassword);
    const code = await generateTOTP(decryptedSecret, targetProfile.digits || 6, targetProfile.period || 30, targetProfile.algo || "SHA1");

    sendResponse({
      status: "success",
      code: code,
      selector: targetProfile.selector,
      autoSubmit: targetProfile.autoSubmit,
      profileName: targetName
    });

  } catch (err) {
    console.error("[Autom8ed] Auto-inject error:", err);
    sendResponse({ status: "error", message: err.message });
  }
}

// ====== TOTP Generation ======
async function generateTOTP(secret, digits = 6, period = 30, algo = "SHA1") {
  const keyBytes = base32ToBytes(secret);
  const timeBytes = getTimeBuffer(period);

  const hashAlgo = algo.toUpperCase() === "SHA256" ? "SHA-256" :
    algo.toUpperCase() === "SHA512" ? "SHA-512" : "SHA-1";

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: hashAlgo },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, timeBytes);
  const bytes = new Uint8Array(sig);
  const offset = bytes[bytes.length - 1] & 0xf;

  const binary = ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);

  const mod = Math.pow(10, digits);
  const code = (binary % mod).toString().padStart(digits, '0');
  return code;
}

function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();

  let bits = "";
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error(`Invalid Base32 character: ${char}`);
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

function getTimeBuffer(period) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / period);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false); // Big endian
  return new Uint8Array(buffer);
}
