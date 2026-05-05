/* popup.js — Autom8ed TOTP Popup (v4.6 - Opus Edition)
   - Loads profiles from profileMap with configurable slot count
   - Generates TOTP codes on demand
   - Sends code + profile data to content script for injection
   - "More Accounts" drawer for overflow profiles
*/

"use strict";

let vault = {};
let profileMap = [];
let workspaces = {};
let activeWorkspace = "Default";
let slotCount = 4;
let masterPassword = "";
const MAX_SLOTS = 20;
const MIN_SLOTS = 1;

// Load profiles on popup open
document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(["vault", "profileMap", "workspaces", "activeWorkspace", "popupSlots"]);
  
  // Migration Check
  if (data.vault && !data.workspaces) {
    workspaces = { "Default": { vault: data.vault, profileMap: data.profileMap || [] } };
    activeWorkspace = "Default";
    await chrome.storage.local.set({ workspaces, activeWorkspace });
    await chrome.storage.local.remove(["vault", "profileMap"]);
  } else {
    workspaces = data.workspaces || { "Default": { vault: {}, profileMap: [] } };
    activeWorkspace = data.activeWorkspace || "Default";
  }

  const currentWS = workspaces[activeWorkspace] || { vault: {}, profileMap: [] };
  vault = currentWS.vault || {};
  profileMap = currentWS.profileMap || [];
  slotCount = Math.max(1, Math.min(20, data.popupSlots || 4));

  // Populate switcher
  const switcher = document.getElementById("workspaceSwitcher");
  switcher.innerHTML = "";
  Object.keys(workspaces).sort().forEach(ws => {
    const opt = document.createElement("option");
    opt.value = ws;
    opt.textContent = ws;
    if (ws === activeWorkspace) opt.selected = true;
    switcher.appendChild(opt);
  });

  switcher.addEventListener("change", async () => {
    activeWorkspace = switcher.value;
    const wsData = workspaces[activeWorkspace];
    vault = wsData.vault;
    profileMap = wsData.profileMap;
    await chrome.storage.local.set({ activeWorkspace });
    renderProfiles();
  });

  // Check if vault is empty
  if (Object.keys(vault).length === 0) {
    document.getElementById("unlockScreen").style.display = "none";
    document.getElementById("vaultContent").style.display = "block";
    renderProfiles();
  }

  document.getElementById("unlockBtn").addEventListener("click", onUnlock);
  document.getElementById("masterPassword").addEventListener("keypress", (e) => {
    if (e.key === "Enter") onUnlock();
  });

  document.getElementById("slotCount").value = slotCount;

  document.getElementById("slotMinus").addEventListener("click", async () => {
    if (slotCount > MIN_SLOTS) {
      slotCount--;
      document.getElementById("slotCount").value = slotCount;
      await chrome.storage.local.set({ popupSlots: slotCount });
      renderProfiles();
    }
  });

  document.getElementById("slotPlus").addEventListener("click", async () => {
    if (slotCount < MAX_SLOTS) {
      slotCount++;
      document.getElementById("slotCount").value = slotCount;
      await chrome.storage.local.set({ popupSlots: slotCount });
      renderProfiles();
    }
  });

  document.getElementById("moreToggle").addEventListener("click", () => {
    const toggle = document.getElementById("moreToggle");
    const list = document.getElementById("moreList");
    toggle.classList.toggle("open");
    list.style.display = list.style.display === "block" ? "none" : "block";
  });

  renderProfiles();
  
  // Update countdown timer every second
  setInterval(updateCountdowns, 1000);
});

async function onUnlock() {
  const pw = document.getElementById("masterPassword").value;
  if (!pw) return;

  // Test decryption on first entry
  const firstKey = Object.keys(vault)[0];
  if (firstKey) {
    try {
      const test = await CryptoHelper.decrypt(vault[firstKey].secret, pw);
      masterPassword = pw;
      document.getElementById("unlockScreen").style.display = "none";
      document.getElementById("vaultContent").style.display = "block";
      renderProfiles();
    } catch(e) {
      showStatus("❌ Invalid Master Password", "error");
    }
  } else {
    // Empty vault
    masterPassword = pw;
    document.getElementById("unlockScreen").style.display = "none";
    document.getElementById("vaultContent").style.display = "block";
    renderProfiles();
  }
}

function renderProfiles() {
  const container = document.getElementById("profileButtons");
  const moreList = document.getElementById("moreList");
  const moreToggle = document.getElementById("moreToggle");
  container.innerHTML = "";
  moreList.innerHTML = "";

  const allNames = Object.keys(vault);

  if (allNames.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No profiles configured</p>
        <a href="manager.html" target="_blank">Create your first profile →</a>
      </div>
    `;
    moreToggle.style.display = "none";
    return;
  }

  // Quick-access = profiles in profileMap (up to slotCount)
  const quickAccess = profileMap.filter(n => vault[n]).slice(0, slotCount);
  const extraProfiles = allNames.filter(n => !quickAccess.includes(n)).sort();

  if (quickAccess.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No quick-access profiles selected.</p>
        <a href="manager.html" target="_blank">⚙️ Select profiles with ★ in Manager</a>
      </div>
    `;
  } else {
    quickAccess.forEach(name => {
      container.appendChild(createProfileButton(name, vault[name], false));
    });
  }

  // "More Accounts" drawer
  if (extraProfiles.length > 0) {
    moreToggle.style.display = "flex";
    moreToggle.querySelector(".more-count").textContent = `(${extraProfiles.length})`;
    extraProfiles.forEach(name => {
      moreList.appendChild(createProfileButton(name, vault[name], true));
    });
  } else {
    moreToggle.style.display = "none";
  }
}

function createProfileButton(name, profile, isExtra) {
  const btn = document.createElement("button");
  btn.className = "profile-btn" + (profile.selector ? " auto" : "") + (isExtra ? " extra" : "");
  btn.dataset.profileName = name;

  const label = document.createElement("span");
  label.textContent = profile.label || name;

  const right = document.createElement("span");
  right.style.display = "flex";
  right.style.alignItems = "center";
  right.style.gap = "8px";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = profile.digits || 6;

  const countdown = document.createElement("span");
  countdown.className = "countdown";
  countdown.dataset.period = profile.period || 30;
  countdown.textContent = getTimeRemaining(profile.period || 30) + "s";

  right.appendChild(badge);
  right.appendChild(countdown);
  btn.appendChild(label);
  btn.appendChild(right);

  btn.addEventListener("click", () => handleInject(name, profile));
  return btn;
}

function updateCountdowns() {
  document.querySelectorAll(".countdown").forEach(el => {
    const period = parseInt(el.dataset.period) || 30;
    const remaining = getTimeRemaining(period);
    el.textContent = remaining + "s";
    el.style.color = remaining <= 5 ? "#ff4444" : remaining <= 10 ? "#ffaa00" : "";
  });
}

function getTimeRemaining(period = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  return period - (epoch % period);
}

async function handleInject(name, profile) {
  try {
    if (!masterPassword) {
       showStatus("❌ Vault Locked", "error");
       return;
    }

    // Decrypt secret
    const decryptedSecret = await CryptoHelper.decrypt(profile.secret, masterPassword);

    // Generate TOTP code
    const code = await generateTOTP(
      decryptedSecret,
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
