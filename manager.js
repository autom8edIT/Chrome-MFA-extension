/* manager.js — Autom8ed Vault Manager
   - Improvements:
       • AES-GCM Encryption with Master Password
       • Auto-extract label from otpauth:// URIs
       • Base32 secret validation
       • Auto-add new profiles to profileMap (if < 4 slots)
       • Import validation with detailed error messages
       • Export with timestamp
       • Duplicate detection on migration import
       • Edit mode visual indicator
       • Better error messages with specificity
       • Uses issuer parameter from URIs
   - Storage schema:
       local.vault = { [profileName]: { secret, digits, period, algo, label, selector, autoSubmit } }
       local.profileMap = ["O365","VPN","SSO","Wiki"]   // ordered (0..3 shown in popup)
       sync: themeColor, defaultProfile
*/

"use strict";

// ====== DOM ======
let secretEl, digitsEl, periodEl, algoEl, msgEl, listEl, fileEl, labelEl, selectorEl, autoEl, currentEditEl;
let autoInjectLoadEl, autoInjectUrlGroupEl, autoInjectUrlEl;
let workspaceSelect, addWorkspaceBtn, renameWorkspaceBtn, deleteWorkspaceBtn;
let sessionPassword = "";

document.addEventListener("DOMContentLoaded", () => {
  secretEl = document.getElementById("secret");
  digitsEl = document.getElementById("digits");
  periodEl = document.getElementById("period");
  algoEl = document.getElementById("algo");
  msgEl = document.getElementById("msg");
  listEl = document.getElementById("list");
  fileEl = document.getElementById("file");
  labelEl = document.getElementById("label");
  selectorEl = document.getElementById("selector");
  autoEl = document.getElementById("autoSubmit");
  currentEditEl = document.getElementById("currentEdit");
  autoInjectLoadEl = document.getElementById("autoInjectLoad");
  autoInjectUrlGroupEl = document.getElementById("autoInjectUrlGroup");
  autoInjectUrlEl = document.getElementById("autoInjectUrl");

  autoInjectLoadEl.addEventListener("change", () => {
    autoInjectUrlGroupEl.style.display = autoInjectLoadEl.checked ? "block" : "none";
  });

  workspaceSelect = document.getElementById("workspaceSelect");
  addWorkspaceBtn = document.getElementById("addWorkspaceBtn");
  renameWorkspaceBtn = document.getElementById("renameWorkspaceBtn");
  deleteWorkspaceBtn = document.getElementById("deleteWorkspaceBtn");

  const themeSelect = document.getElementById("themeSelect");
  chrome.storage.local.get(["theme"]).then(({ theme }) => {
    if (theme) {
      themeSelect.value = theme;
      document.documentElement.setAttribute("data-theme", theme);
    }
  });
  themeSelect.addEventListener("change", async () => {
    const theme = themeSelect.value;
    document.documentElement.setAttribute("data-theme", theme);
    await chrome.storage.local.set({ theme });
  });

  document.getElementById("save").addEventListener("click", onSave);
  document.getElementById("exportBtn").addEventListener("click", onExport);
  document.getElementById("importBtn").addEventListener("click", () => fileEl.click());
  document.getElementById("clearBtn")?.addEventListener("click", clearForm);
  fileEl.addEventListener("change", onImportFile);

  workspaceSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ activeWorkspace: workspaceSelect.value });
    await refreshList();
  });

  addWorkspaceBtn.addEventListener("click", onAddWorkspace);
  renameWorkspaceBtn.addEventListener("click", onRenameWorkspace);
  deleteWorkspaceBtn.addEventListener("click", onDeleteWorkspace);

  // Auto-parse when pasting into secret field
  secretEl.addEventListener("paste", (e) => {
    setTimeout(() => {
      const val = secretEl.value.trim();
      if (val.toLowerCase().startsWith("otpauth://")) {
        autofillFromUri(val);
      }
    }, 10);
  });

  // Popup slots settings
  const saveSlotsBtn = document.getElementById("saveSlotsBtn");
  const popupSlotsInput = document.getElementById("popupSlotsInput");
  const slotsMsg = document.getElementById("slotsMsg");
  if (saveSlotsBtn && popupSlotsInput) {
    chrome.storage.local.get(["popupSlots"]).then(({ popupSlots }) => {
      popupSlotsInput.value = popupSlots || 4;
    });
    saveSlotsBtn.addEventListener("click", async () => {
      const val = Math.max(1, Math.min(20, parseInt(popupSlotsInput.value) || 4));
      popupSlotsInput.value = val;
      await chrome.storage.local.set({ popupSlots: val });
      if (slotsMsg) {
        slotsMsg.textContent = `Popup will show ${val} quick-access slot${val !== 1 ? "s" : ""}.`;
        slotsMsg.className = "message ok";
        setTimeout(() => { slotsMsg.textContent = ""; slotsMsg.className = "message"; }, 3000);
      }
    });
  }

  init();
});

// ====== Init / Refresh ======
async function init() {
  let { vault, profileMap, workspaces, activeWorkspace } = await chrome.storage.local.get([
    "vault", "profileMap", "workspaces", "activeWorkspace"
  ]);

  // Migration: move old single vault to multi-workspace format
  if (vault && !workspaces) {
    workspaces = { "Default": { vault, profileMap: profileMap || [] } };
    activeWorkspace = "Default";
    await chrome.storage.local.set({ workspaces, activeWorkspace });
    await chrome.storage.local.remove(["vault", "profileMap"]);
  }

  // Ensure initial workspace exists
  if (!workspaces || Object.keys(workspaces).length === 0) {
    workspaces = { "Default": { vault: {}, profileMap: [] } };
    activeWorkspace = "Default";
    await chrome.storage.local.set({ workspaces, activeWorkspace });
  }

  if (!activeWorkspace) {
    activeWorkspace = Object.keys(workspaces)[0];
    await chrome.storage.local.set({ activeWorkspace });
  }

  // Populate workspace selector
  updateWorkspaceDropdown(workspaces, activeWorkspace);

  // Try to load master password from session
  const sessionData = await chrome.storage.session.get(["masterPassword"]);
  if (sessionData.masterPassword) {
    sessionPassword = sessionData.masterPassword;
  }

  // Check for plain-text secrets in active workspace (migration/onboarding)
  const currentData = workspaces[activeWorkspace];
  const keys = Object.keys(currentData.vault);
  const needsEncryption = keys.some(n => {
    const s = currentData.vault[n].secret;
    return typeof s === 'string' && s.length < 40;
  });

  if (needsEncryption && keys.length > 0) {
    if (confirm("Detected unencrypted secrets in this workspace. Would you like to set a Master Password and secure your vault now?")) {
      await getSessionPassword("Set your Master Password (cannot be recovered!):");
      if (sessionPassword) {
        setMsg("Encrypting vault...");
        for (const n of keys) {
          if (currentData.vault[n].secret.length < 40) {
            currentData.vault[n].secret = await CryptoHelper.encrypt(currentData.vault[n].secret.replace(/\s+/g, ""), sessionPassword);
          }
        }
        workspaces[activeWorkspace] = currentData;
        await chrome.storage.local.set({ workspaces });
        setMsg("Vault secured successfully!");
      }
    }
  }

  await refreshList();
}

function updateWorkspaceDropdown(workspaces, active) {
  workspaceSelect.innerHTML = "";
  Object.keys(workspaces).sort().forEach(ws => {
    const opt = document.createElement("option");
    opt.value = ws;
    opt.textContent = ws;
    if (ws === active) opt.selected = true;
    workspaceSelect.appendChild(opt);
  });
}

async function refreshList() {
  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  const currentWS = workspaces[activeWorkspace] || { vault: {}, profileMap: [] };
  const { vault = {} } = currentWS;

  listEl.innerHTML = "";
  const names = Object.keys(vault).sort();

  if (names.length === 0) {
    listEl.innerHTML = `<div style="color:#888;padding:20px;text-align:center;">No profiles in workspace "${activeWorkspace}". Add one above!</div>`;
    return;
  }

  // Check if we need to decrypt
  if (Object.values(vault).some(e => typeof e.secret === 'string' && e.secret.length > 40)) {
    if (!sessionPassword) {
      const pw = await getSessionPassword("Vault is encrypted. Enter Master Password to view/edit:");
      if (!pw) return;
    }
  }

  // Load profileMap for star state
  const pm = currentWS.profileMap || [];

  for (const n of names) {
    const row = document.createElement("div");
    row.className = "item" + (pm.includes(n) ? " quick-access" : "");
    row.dataset.profileName = n;

    // Star toggle
    const star = document.createElement("button");
    star.className = "btn-star" + (pm.includes(n) ? " active" : "");
    star.textContent = pm.includes(n) ? "★" : "☆";
    star.title = pm.includes(n) ? "Remove from quick-access" : "Add to quick-access";
    star.addEventListener("click", async () => {
      const { workspaces: wsUpdate, activeWorkspace: active } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
      let currentPM = wsUpdate[active].profileMap || [];
      if (currentPM.includes(n)) {
        wsUpdate[active].profileMap = currentPM.filter(x => x !== n);
      } else {
        wsUpdate[active].profileMap = [...currentPM, n];
      }
      await chrome.storage.local.set({ workspaces: wsUpdate });
      await refreshList();
    });

    const left = document.createElement("span");
    const entry = vault[n];

    // Attempt decryption for display if needed
    let displaySecret = entry.secret;
    if (sessionPassword && typeof entry.secret === 'string' && entry.secret.length > 40) {
      try {
        displaySecret = await CryptoHelper.decrypt(entry.secret, sessionPassword);
      } catch (e) {
        displaySecret = "[Encrypted]";
      }
    }

    left.textContent = `${n} ${entry.autoSubmit ? "🔄" : ""}`;

    const right = document.createElement("div");

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.className = "btn btn-edit";
    edit.addEventListener("click", async () => {
      let entryToLoad = { ...vault[n] };
      if (sessionPassword && typeof entryToLoad.secret === 'string' && entryToLoad.secret.length > 40) {
        try {
          entryToLoad.secret = await CryptoHelper.decrypt(entryToLoad.secret, sessionPassword);
        } catch (e) {
          alert("Decryption failed. Check password.");
          return;
        }
      }
      loadProfile(n, entryToLoad);
    });

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "btn btn-danger";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete profile "${n}" from workspace "${activeWorkspace}"?`)) return;

      const scriptId = "autoinject_" + btoa(encodeURIComponent(n)).replace(/[^a-zA-Z0-9]/g, "");
      try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }); } catch(e) {}

      const { workspaces: wsDel, activeWorkspace: active } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
      delete wsDel[active].vault[n];
      // Remove from profileMap
      wsDel[active].profileMap = (wsDel[active].profileMap || []).filter(x => x !== n);
      await chrome.storage.local.set({ workspaces: wsDel });
      clearForm();
      await refreshList();
      setMsg(`Deleted ${n}.`);
    });

    right.appendChild(edit);
    right.appendChild(del);
    row.appendChild(star);
    row.appendChild(left);
    row.appendChild(right);
    listEl.appendChild(row);
  }
}

function loadProfile(name, entry) {
  secretEl.value = entry.secret || "";
  digitsEl.value = entry.digits || 6;
  periodEl.value = entry.period || 30;
  algoEl.value = (entry.algo || "SHA1").toUpperCase();
  labelEl.value = entry.label || name;
  selectorEl.value = entry.selector || "";
  autoEl.checked = !!entry.autoSubmit;
  autoInjectLoadEl.checked = !!entry.autoInjectLoad;
  autoInjectUrlEl.value = entry.autoInjectUrl || "";
  autoInjectUrlGroupEl.style.display = autoInjectLoadEl.checked ? "block" : "none";

  // Visual indicator
  if (currentEditEl) {
    currentEditEl.textContent = `Editing: ${name}`;
    currentEditEl.style.display = "block";
  }

  // Highlight in list
  document.querySelectorAll(".item").forEach(el => el.classList.remove("editing"));
  const row = document.querySelector(`.item[data-profile-name="${name}"]`);
  if (row) row.classList.add("editing");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  secretEl.value = "";
  labelEl.value = "";
  digitsEl.value = 6;
  periodEl.value = 30;
  algoEl.value = "SHA1";
  selectorEl.value = "";
  autoEl.checked = false;
  autoInjectLoadEl.checked = false;
  autoInjectUrlEl.value = "";
  autoInjectUrlGroupEl.style.display = "none";

  if (currentEditEl) {
    currentEditEl.textContent = "";
    currentEditEl.style.display = "none";
  }

  document.querySelectorAll(".item").forEach(el => el.classList.remove("editing"));
}

// ====== Workspace Handlers ======
async function onAddWorkspace() {
  const name = prompt("Enter name for new workspace (e.g. Work, Personal):");
  if (!name) return;

  const { workspaces = {} } = await chrome.storage.local.get(["workspaces"]);
  if (workspaces[name]) {
    alert("A workspace with this name already exists.");
    return;
  }

  workspaces[name] = { vault: {}, profileMap: [] };
  await chrome.storage.local.set({ workspaces, activeWorkspace: name });
  updateWorkspaceDropdown(workspaces, name);
  await refreshList();
}

async function onRenameWorkspace() {
  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  if (activeWorkspace === "Default") {
    alert("The Default workspace cannot be renamed.");
    return;
  }

  const newName = prompt(`Rename workspace "${activeWorkspace}" to:`, activeWorkspace);
  if (!newName || newName === activeWorkspace) return;

  if (workspaces[newName]) {
    alert("A workspace with this name already exists.");
    return;
  }

  workspaces[newName] = workspaces[activeWorkspace];
  delete workspaces[activeWorkspace];

  await chrome.storage.local.set({ workspaces, activeWorkspace: newName });
  updateWorkspaceDropdown(workspaces, newName);
  await refreshList();
}

async function onDeleteWorkspace() {
  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  if (activeWorkspace === "Default") {
    alert("The Default workspace cannot be deleted.");
    return;
  }

  if (!confirm(`Delete workspace "${activeWorkspace}" and ALL its accounts?`)) return;

  delete workspaces[activeWorkspace];
  const next = "Default";
  await chrome.storage.local.set({ workspaces, activeWorkspace: next });
  updateWorkspaceDropdown(workspaces, next);
  await refreshList();
}

// ====== Save handler ======
async function onSave() {
  const raw = secretEl.value.trim().replace(/^["']|["']$/g, "");
  const key = (labelEl.value || "").trim();

  if (!sessionPassword) {
    const pw = await getSessionPassword("Set a Master Password to encrypt this vault (DO NOT LOSE THIS!):");
    if (!pw) return;
  }

  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  const currentWS = workspaces[activeWorkspace];

  // 1) Google Authenticator migration bulk import
  if (/^otpauth-migration:\/\//i.test(raw)) {
    let entries;
    try {
      entries = parseMigrationUri(raw);
    } catch (e) {
      return setMsg(`Migration parse error: ${e.message || e}`, true);
    }
    if (!entries || !entries.length) return setMsg("Invalid or empty migration URI.", true);

    let imported = 0, skipped = 0, overwritten = 0;

    for (const e of entries) {
      if (!e?.secret) continue;

      // Validate secret
      if (!isValidBase32(e.secret)) {
        console.warn(`[!] Invalid Base32 secret for ${e.name || "unknown"}, skipping.`);
        skipped++;
        continue;
      }

      const label = (e.name || e.issuer || ("Imported" + Math.random().toString(36).slice(2, 6))).trim();

      // Duplicate detection
      if (currentWS.vault[label]) {
        if (!confirm(`Profile "${label}" already exists. Overwrite?`)) {
          skipped++;
          continue;
        }
        overwritten++;
      }

      const cleanSecret = e.secret.replace(/\s+/g, "");
      const encryptedSecret = await CryptoHelper.encrypt(cleanSecret, sessionPassword);

      currentWS.vault[label] = {
        secret: encryptedSecret,
        digits: e.digits || 6,
        period: e.period || 30,
        algo: (e.algo || "SHA1").toUpperCase(),
        label,
        selector: null,
        autoSubmit: false
      };
      imported++;
    }

    await chrome.storage.local.set({ workspaces });

    // Auto-add to profileMap if room available
    await autoAddToProfileMap(currentWS, null);
    await chrome.storage.local.set({ workspaces });

    const msg = `Imported ${imported} entr${imported !== 1 ? "ies" : "y"}${overwritten > 0 ? `, overwritten ${overwritten}` : ""}${skipped > 0 ? `, skipped ${skipped}` : ""}.`;
    setMsg(msg);
    await refreshList();
    clearForm();
    return;
  }

  // 2) Single entry (base32 or otpauth://)
  if (!key) {
    // Try to auto-extract label from URI if present
    if (raw.toLowerCase().startsWith("otpauth://")) {
      const autoLabel = extractLabelFromUri(raw);
      if (autoLabel) {
        labelEl.value = autoLabel;
        return setMsg("Label auto-filled from URI. Click Save again.", false);
      }
    }
    return setMsg("Display Label is required.", true);
  }

  const parsed = parseOtpAuth(raw);
  if (!parsed || !parsed.secret) {
    return setMsg("Invalid secret or otpauth URI.", true);
  }

  // Validate Base32
  if (!isValidBase32(parsed.secret)) {
    return setMsg("Invalid Base32 secret. Check for invalid characters (only A-Z, 2-7 allowed).", true);
  }

  const digits = Math.max(6, Math.min(8, Number(digitsEl.value || parsed.digits || 6)));
  const period = Math.max(15, Math.min(60, Number(periodEl.value || parsed.period || 30)));
  const algo = (algoEl.value || parsed.algo || "SHA1").toUpperCase();

  if (currentWS.vault[key] && !confirm(`Overwrite existing profile "${key}" in workspace "${activeWorkspace}"?`)) return;

  const doAutoInjectLoad = !!(autoInjectLoadEl && autoInjectLoadEl.checked);
  const injectUrl = (autoInjectUrlEl?.value || "").trim();

  if (doAutoInjectLoad && !injectUrl) {
    return setMsg("Target URL is required for Auto-Inject on Page Load.", true);
  }

  // Handle permissions and content scripts for Auto-Inject
  const scriptId = "autoinject_" + btoa(encodeURIComponent(key)).replace(/[^a-zA-Z0-9]/g, "");
  try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }); } catch(e) {}

  if (doAutoInjectLoad && injectUrl) {
    try {
      const granted = await chrome.permissions.request({ origins: [injectUrl] });
      if (!granted) {
        return setMsg("Permission required for auto-inject on page load.", true);
      }
      await chrome.scripting.registerContentScripts([{
        id: scriptId,
        matches: [injectUrl],
        js: ["injector.js", "auto-injector.js"],
        allFrames: true,
        runAt: "document_idle"
      }]);
    } catch(e) {
      console.error("[Autom8ed] Auto-inject setup failed:", e);
      return setMsg("Error setting up auto-inject: " + e.message, true);
    }
  }

  const cleanSecret = parsed.secret.replace(/\s+/g, "");
  const encryptedSecret = await CryptoHelper.encrypt(cleanSecret, sessionPassword);

  currentWS.vault[key] = {
    secret: encryptedSecret,
    digits, period, algo,
    label: (labelEl?.value || "").trim() || key,
    selector: (selectorEl?.value || "").trim() || null,
    autoSubmit: !!(autoEl && autoEl.checked),
    autoInjectLoad: doAutoInjectLoad,
    autoInjectUrl: injectUrl || null
  };

  await chrome.storage.local.set({ workspaces });

  // Auto-add to profileMap if room available
  await autoAddToProfileMap(currentWS, key);
  await chrome.storage.local.set({ workspaces });

  setMsg(`Saved ${key} to ${activeWorkspace}.`);
  await refreshList();
  clearForm();
}

// ====== Import / Export ======
async function onExport() {
  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  const data = workspaces[activeWorkspace];

  // Validate export data
  if (!data.vault || Object.keys(data.vault).length === 0) {
    return setMsg("No profiles to export.", true);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mfa_vault_${activeWorkspace}_${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setMsg("Exported successfully.");
}

async function onImportFile() {
  const file = fileEl.files?.[0];
  if (!file) return;

  if (!sessionPassword) {
    const pw = await getSessionPassword("Vault will be encrypted. Set Master Password for imported data:");
    if (!pw) return;
  }

  const { workspaces, activeWorkspace } = await chrome.storage.local.get(["workspaces", "activeWorkspace"]);
  const currentWS = workspaces[activeWorkspace];

  try {
    const text = await file.text();
    const obj = JSON.parse(text);

    // Validate imported structure
    if (!obj.vault || typeof obj.vault !== "object") {
      return setMsg("Invalid vault format. Missing 'vault' object.", true);
    }

    // Validate and encrypt each entry
    let validCount = 0;
    const validVault = {};
    for (const [name, entry] of Object.entries(obj.vault)) {
      if (!entry.secret) {
        console.warn(`[!] Entry "${name}" missing secret, skipping.`);
        continue;
      }

      let secretToStore = entry.secret;

      // If secret is plain-text Base32, encrypt it
      if (isValidBase32(entry.secret) && entry.secret.length < 40) {
        secretToStore = await CryptoHelper.encrypt(entry.secret.replace(/\s+/g, ""), sessionPassword);
      }

      validVault[name] = {
        secret: secretToStore,
        digits: entry.digits || 6,
        period: entry.period || 30,
        algo: (entry.algo || "SHA1").toUpperCase(),
        label: entry.label || name,
        selector: entry.selector || null,
        autoSubmit: !!entry.autoSubmit
      };
      validCount++;
    }

    if (validCount === 0) {
      return setMsg("No valid entries found in import file.", true);
    }

    currentWS.vault = { ...currentWS.vault, ...validVault };
    if (Array.isArray(obj.profileMap)) {
      currentWS.profileMap = [...new Set([...(currentWS.profileMap || []), ...obj.profileMap])];
    }

    await chrome.storage.local.set({ workspaces });

    // Auto-seed profileMap if empty
    if (!Array.isArray(currentWS.profileMap) || currentWS.profileMap.length === 0) {
      currentWS.profileMap = Object.keys(currentWS.vault).slice(0, 4);
      await chrome.storage.local.set({ workspaces });
    }

    setMsg(`Imported ${validCount} valid entr${validCount !== 1 ? "ies" : "y"}.`);
    await refreshList();
  } catch (e) {
    setMsg(`Import failed: ${e.message || "Invalid JSON"}`, true);
  } finally {
    fileEl.value = "";
  }
}

// ====== Helpers ======
async function getSessionPassword(promptMsg) {
  if (sessionPassword) return sessionPassword;
  const sessionData = await chrome.storage.session.get(["masterPassword"]);
  if (sessionData.masterPassword) {
    sessionPassword = sessionData.masterPassword;
    return sessionPassword;
  }
  const pw = prompt(promptMsg);
  if (pw) {
    sessionPassword = pw;
    await chrome.storage.session.set({ masterPassword: pw });
  }
  return sessionPassword;
}

function setMsg(t, isErr = false) {
  if (!msgEl) return;
  msgEl.textContent = t;
  msgEl.className = "message " + (isErr ? "warn" : "ok");
  setTimeout(() => { if (msgEl) { msgEl.textContent = ""; msgEl.className = "message"; } }, 3000);
}

// Base32 validation
function isValidBase32(s) {
  const cleaned = (s || "").replace(/\s+/g, "").replace(/=+$/, "");
  return /^[A-Z2-7]+$/i.test(cleaned);
}

// Auto-add to profileMap if < 4 slots
async function autoAddToProfileMap(currentWS, newKey = null) {
  if (!Array.isArray(currentWS.profileMap)) {
    currentWS.profileMap = Object.keys(currentWS.vault).slice(0, 4);
    return;
  }

  // Add new key if room available
  if (newKey && !currentWS.profileMap.includes(newKey) && currentWS.profileMap.length < 4) {
    currentWS.profileMap.push(newKey);
  }

  // Seed if empty
  if (currentWS.profileMap.length === 0) {
    currentWS.profileMap = Object.keys(currentWS.vault).slice(0, 4);
  }
}

// Extract label from otpauth:// URI
function extractLabelFromUri(uri) {
  try {
    const url = new URL(uri);
    // otpauth://totp/Twitter:@user or otpauth://totp/label?...
    const path = decodeURIComponent(url.pathname);
    const parts = path.split("/").filter(x => x);
    if (parts.length > 0) {
      const labelPart = parts[parts.length - 1];
      // If contains ":", take everything after it, otherwise use whole thing
      if (labelPart.includes(":")) {
        return labelPart.split(":").slice(1).join(":");
      }
      return labelPart;
    }
    // Fallback to issuer parameter
    return url.searchParams.get("issuer") || null;
  } catch {
    return null;
  }
}

// Auto-fill form from URI (triggered on paste)
function autofillFromUri(uri) {
  const parsed = parseOtpAuth(uri);
  if (!parsed) return;

  if (parsed.secret) secretEl.value = parsed.secret;
  if (parsed.digits) digitsEl.value = parsed.digits;
  if (parsed.period) periodEl.value = parsed.period;
  if (parsed.algo) algoEl.value = parsed.algo;

  const label = extractLabelFromUri(uri);
  if (label && !labelEl.value) {
    labelEl.value = label;
  }

  setMsg("Auto-filled from URI. Review and click Save.", false);
}

// Base32 or otpauth://totp parser (single entry)
function parseOtpAuth(input) {
  const s = (input || "").trim();
  if (s.toLowerCase().startsWith("otpauth://")) {
    try {
      const u = new URL(s);
      const params = u.searchParams;
      const secret = params.get("secret") || "";
      const digits = Number(params.get("digits") || 6);
      const period = Number(params.get("period") || 30);
      const algo = (params.get("algorithm") || "SHA1").toUpperCase();
      return { secret, digits, period, algo };
    } catch {
      return null;
    }
  } else {
    return { secret: s, digits: 6, period: 30, algo: "SHA1" };
  }
}

// ---- Google Authenticator migration decoder ----
function parseMigrationUri(uri) {
  if (!/^otpauth-migration:\/\//i.test(uri || "")) return null;
  const u = new URL(uri);
  const dataB64 = u.searchParams.get("data");
  if (!dataB64) throw new Error("Missing migration data param");

  const bytes = base64ToBytes(dataB64);
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    const [tag, tlen] = readVarint(bytes, i); i += tlen;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) {
      const [llen, lsz] = readVarint(bytes, i); i += lsz;
      const end = i + llen;
      out.push(parseOtpParameters(bytes.slice(i, end)));
      i = end;
    } else {
      i = skipField(bytes, i, wire);
    }
  }
  return out;

  function parseOtpParameters(buf) {
    let j = 0;
    const rec = { digits: 6, period: 30, algo: "SHA1" };
    while (j < buf.length) {
      const [tag, tlen] = readVarint(buf, j); j += tlen;
      const field = tag >>> 3;
      const wire = tag & 7;
      if (field === 1 && wire === 2) {
        const [llen, lsz] = readVarint(buf, j); j += lsz;
        const b = buf.slice(j, j + llen); j += llen;
        rec.secret = toBase32(b);
      } else if (field === 2 && wire === 2) {
        const [llen, lsz] = readVarint(buf, j); j += lsz;
        rec.name = utf8(buf.slice(j, j + llen)); j += llen;
      } else if (field === 3 && wire === 2) {
        const [llen, lsz] = readVarint(buf, j); j += lsz;
        rec.issuer = utf8(buf.slice(j, j + llen)); j += llen;
      } else if (field === 4 && wire === 0) {
        const [v, vsz] = readVarint(buf, j); j += vsz;
        rec.algo = (v === 1 ? "SHA1" : v === 2 ? "SHA256" : "SHA1");
      } else if (field === 5 && wire === 0) {
        const [v, vsz] = readVarint(buf, j); j += vsz;
        rec.digits = v || 6;
      } else if (field === 8 && wire === 0) {
        const [v, vsz] = readVarint(buf, j); j += vsz;
        rec.period = v || 30;
      } else {
        j = skipField(buf, j, wire);
      }
    }
    if (!rec.name) rec.name = rec.issuer || "Imported";
    return rec;
  }

  function readVarint(b, idx) {
    let x = 0, s = 0, i0 = idx;
    for (let k = 0; k < 10; k++) {
      const c = b[idx++]; x |= (c & 0x7f) << s; if (!(c & 0x80)) break; s += 7;
    }
    return [x >>> 0, idx - i0];
  }

  function skipField(b, idx, wire) {
    if (wire === 0) { const [, n] = readVarint(b, idx); return idx + n; }
    if (wire === 2) { const [len, n] = readVarint(b, idx); return idx + n + len; }
    if (wire === 5) return idx + 4;
    if (wire === 1) return idx + 8;
    return b.length;
  }

  function base64ToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4; if (pad) s += '='.repeat(4 - pad);
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
    return out;
  }

  function utf8(arr) {
    return new TextDecoder("utf-8").decode(arr);
  }

  function toBase32(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, value = 0, out = "";
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
    return out;
  }
}
