/* popup.js — Autom8ed TOTP Popup (v4.5)
   - Loads top 4 profiles from profileMap
   - Generates TOTP codes on demand
   - Sends code + profile data to content script for injection
*/

"use strict";

let vault = {};
let profileMap = [];

// Load profiles on popup open
document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(["vault", "profileMap"]);
  vault = data.vault || {};
  profileMap = data.profileMap || [];

  renderProfiles();
  
  // Update countdown timer every second
  setInterval(updateCountdowns, 1000);
});

function renderProfiles() {
  const container = document.getElementById("profileButtons");
  container.innerHTML = "";

  if (profileMap.length === 0 || Object.keys(vault).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No profiles configured</p>
        <a href="manager.html" target="_blank">Create your first profile →</a>
      </div>
    `;
    return;
  }

  // Show top 4 profiles from profileMap
  const displayProfiles = profileMap.slice(0, 4);
  
  displayProfiles.forEach(name => {
    const profile = vault[name];
    if (!profile) return; // Skip if profile deleted but still in map

    const btn = document.createElement("button");
    btn.className = "profile-btn" + (profile.autoSubmit ? " auto" : "");
    btn.dataset.profileName = name;

    const label = document.createElement("span");
    label.textContent = profile.label || name;

    const countdown = document.createElement("span");
    countdown.className = "countdown";
    countdown.textContent = getTimeRemaining() + "s";

    btn.appendChild(label);
    btn.appendChild(countdown);

    btn.addEventListener("click", () => handleInject(name, profile));

    container.appendChild(btn);
  });
}

function updateCountdowns() {
  const remaining = getTimeRemaining();
  document.querySelectorAll(".countdown").forEach(el => {
    el.textContent = remaining + "s";
  });
}

function getTimeRemaining() {
  const epoch = Math.floor(Date.now() / 1000);
  return 30 - (epoch % 30);
}

async function handleInject(name, profile) {
  try {
    // Generate TOTP code
    const code = await generateTOTP(
      profile.secret,
      profile.digits || 6,
      profile.period || 30,
      profile.algo || "SHA1"
    );

    // Copy to clipboard
    await navigator.clipboard.writeText(code);
    
    // Show success message
    showStatus(`✅ ${code} copied to clipboard!`, "success");

    // Try to inject into active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "INJECT_TOTP",
        code: code,
        selector: profile.selector || null,
        autoSubmit: !!profile.autoSubmit,
        profileName: name
      }).catch(err => {
        console.log("[Popup] Content script not ready:", err);
        // Silent fail - code is already in clipboard
      });
    }
  } catch (e) {
    showStatus(`❌ Error: ${e.message}`, "error");
  }
}

function showStatus(msg, type) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 3000);
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
