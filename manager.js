/* manager.js — Autom8ed TOTP Vault Manager (v4.5 - Sonnet Edition)
   - Improvements:
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

document.addEventListener("DOMContentLoaded", () => {
  secretEl = document.getElementById("secret");
  digitsEl = document.getElementById("digits");
  periodEl = document.getElementById("period");
  algoEl   = document.getElementById("algo");
  msgEl    = document.getElementById("msg");
  listEl   = document.getElementById("list");
  fileEl   = document.getElementById("file");
  labelEl  = document.getElementById("label");
  selectorEl = document.getElementById("selector");
  autoEl     = document.getElementById("autoSubmit");
  currentEditEl = document.getElementById("currentEdit");

  document.getElementById("save").addEventListener("click", onSave);
  document.getElementById("exportBtn").addEventListener("click", onExport);
  document.getElementById("importBtn").addEventListener("click", () => fileEl.click());
  document.getElementById("clearBtn")?.addEventListener("click", clearForm);
  fileEl.addEventListener("change", onImportFile);

  // Auto-parse when pasting into secret field
  secretEl.addEventListener("paste", (e) => {
    setTimeout(() => {
      const val = secretEl.value.trim();
      if (val.toLowerCase().startsWith("otpauth://")) {
        autofillFromUri(val);
      }
    }, 10);
  });

  init();
});

// ====== Init / Refresh ======
async function init() {
  await refreshList();
}

async function refreshList() {
  const { vault = {} } = await chrome.storage.local.get(["vault"]);
  listEl.innerHTML = "";
  const names = Object.keys(vault).sort();
  
  if (names.length === 0) {
    listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">No profiles yet. Add one above!</div>';
    return;
  }

  names.forEach(n => {
    const row = document.createElement("div");
    row.className = "item";
    row.dataset.profileName = n;

    const left = document.createElement("span");
    const entry = vault[n];
    left.textContent = `${n} ${entry.autoSubmit ? "🔄" : ""}`;

    const right = document.createElement("div");

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.className = "btn btn-edit";
    edit.addEventListener("click", () => loadProfile(n, vault[n]));

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "btn btn-danger";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete profile "${n}"?`)) return;
      const { vault: v2 = {} } = await chrome.storage.local.get(["vault"]);
      delete v2[n];
      await chrome.storage.local.set({ vault: v2 });
      // Remove from profileMap
      const pm = await chrome.storage.local.get(["profileMap"]);
      if (Array.isArray(pm.profileMap)) {
        const next = pm.profileMap.filter(x => x !== n);
        await chrome.storage.local.set({ profileMap: next });
      }
      clearForm();
      await refreshList();
      setMsg(`Deleted ${n}.`);
    });

    right.appendChild(edit);
    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    listEl.appendChild(row);
  });
}

function loadProfile(name, entry) {
  secretEl.value = entry.secret || "";
  digitsEl.value = entry.digits || 6;
  periodEl.value = entry.period || 30;
  algoEl.value   = (entry.algo || "SHA1").toUpperCase();
  labelEl.value  = entry.label || name;
  selectorEl.value = entry.selector || "";
  autoEl.checked   = !!entry.autoSubmit;
  
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
  
  if (currentEditEl) {
    currentEditEl.textContent = "";
    currentEditEl.style.display = "none";
  }
  
  document.querySelectorAll(".item").forEach(el => el.classList.remove("editing"));
}

// ====== Save handler ======
async function onSave() {
  const raw  = secretEl.value.trim().replace(/^["']|["']$/g, "");
  const key = (labelEl.value || "").trim();
  
  // 1) Google Authenticator migration bulk import
  if (/^otpauth-migration:\/\//i.test(raw)) {
    let entries;
    try {
      entries = parseMigrationUri(raw);
    } catch (e) {
      return setMsg(`Migration parse error: ${e.message || e}`, true);
    }
    if (!entries || !entries.length) return setMsg("Invalid or empty migration URI.", true);

    const { vault = {} } = await chrome.storage.local.get(["vault"]);
    let imported = 0, skipped = 0, overwritten = 0;
    
    for (const e of entries) {
      if (!e?.secret) continue;
      
      // Validate secret
      if (!isValidBase32(e.secret)) {
        console.warn(`[!] Invalid Base32 secret for ${e.name || "unknown"}, skipping.`);
        skipped++;
        continue;
      }
      
      const label = (e.name || e.issuer || ("Imported" + Math.random().toString(36).slice(2,6))).trim();
      
      // Duplicate detection
      if (vault[label]) {
        if (!confirm(`Profile "${label}" already exists. Overwrite?`)) {
          skipped++;
          continue;
        }
        overwritten++;
      }
      
      vault[label] = {
        secret: e.secret.replace(/\s+/g, ""),
        digits: e.digits || 6,
        period: e.period || 30,
        algo:   (e.algo || "SHA1").toUpperCase(),
        label,
        selector: null,
        autoSubmit: false
      };
      imported++;
    }
    
    await chrome.storage.local.set({ vault });

    // Auto-add to profileMap if room available
    await autoAddToProfileMap(vault);

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
  const algo   = (algoEl.value || parsed.algo || "SHA1").toUpperCase();

  const { vault = {} } = await chrome.storage.local.get(["vault"]);

  if (vault[key] && !confirm(`Overwrite existing profile "${key}"?`)) return;
  
  vault[key] = {
    secret: parsed.secret.replace(/\s+/g, ""),
    digits, period, algo,
    label:     (labelEl?.value || "").trim() || key,
    selector:  (selectorEl?.value || "").trim() || null,
    autoSubmit: !!(autoEl && autoEl.checked)
  };

  await chrome.storage.local.set({ vault });

  // Auto-add to profileMap if room available
  await autoAddToProfileMap(vault, key);

  setMsg(`Saved ${key}.`);
  await refreshList();
  clearForm();
}

// ====== Import / Export ======
async function onExport() {
  const data = await chrome.storage.local.get(["vault","profileMap"]);
  
  // Validate export data
  if (!data.vault || Object.keys(data.vault).length === 0) {
    return setMsg("No profiles to export.", true);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `autom8ed_totp_vault_${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setMsg("Exported successfully.");
}

async function onImportFile() {
  const file = fileEl.files?.[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const obj = JSON.parse(text);

    // Validate imported structure
    if (!obj.vault || typeof obj.vault !== "object") {
      return setMsg("Invalid vault format. Missing 'vault' object.", true);
    }
    
    // Validate each entry
    let validCount = 0;
    const validVault = {};
    for (const [name, entry] of Object.entries(obj.vault)) {
      if (!entry.secret) {
        console.warn(`[!] Entry "${name}" missing secret, skipping.`);
        continue;
      }
      if (!isValidBase32(entry.secret)) {
        console.warn(`[!] Entry "${name}" has invalid Base32 secret, skipping.`);
        continue;
      }
      validVault[name] = {
        secret: entry.secret,
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

    const current = await chrome.storage.local.get(["vault","profileMap"]);
    const merged = { ...current.vault, ...validVault };
    const nextPM = Array.isArray(obj.profileMap) ? obj.profileMap : (current.profileMap || []);

    await chrome.storage.local.set({
      vault: merged,
      profileMap: nextPM
    });

    // Auto-seed profileMap if empty
    if (!Array.isArray(nextPM) || nextPM.length === 0) {
      await chrome.storage.local.set({ profileMap: Object.keys(merged).slice(0,4) });
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
function setMsg(t, isErr=false) {
  if (!msgEl) return;
  msgEl.textContent = t;
  msgEl.className = isErr ? "warn" : "ok";
  setTimeout(() => { if (msgEl) { msgEl.textContent = ""; msgEl.className = ""; } }, 3000);
}

// Base32 validation
function isValidBase32(s) {
  const cleaned = (s || "").replace(/\s+/g, "").replace(/=+$/, "");
  return /^[A-Z2-7]+$/i.test(cleaned);
}

// Auto-add to profileMap if < 4 slots
async function autoAddToProfileMap(vault, newKey = null) {
  const { profileMap = [] } = await chrome.storage.local.get(["profileMap"]);
  
  if (!Array.isArray(profileMap)) {
    await chrome.storage.local.set({ profileMap: Object.keys(vault).slice(0,4) });
    return;
  }
  
  // Add new key if room available
  if (newKey && !profileMap.includes(newKey) && profileMap.length < 4) {
    profileMap.push(newKey);
    await chrome.storage.local.set({ profileMap });
  }
  
  // Seed if empty
  if (profileMap.length === 0) {
    await chrome.storage.local.set({ profileMap: Object.keys(vault).slice(0,4) });
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
