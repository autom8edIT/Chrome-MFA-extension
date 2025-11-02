// Auto-inject only if MFA field is present
(function () {
  const secrets = {
    default: "ADD_YOUR_SECRET_HERE",
    o365: "ADD_YOUR_SECRET_HERE",
    passwordstate: "ADD_YOUR_SECRET_HERE"
    #ADD_MORE_SERVICES_IF_NEEDED
  };

  const service = "default";

  const base32ToBytes = (base32) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "", bytes = [];
    for (const char of base32.replace(/=+$/, "").toUpperCase()) {
      const val = alphabet.indexOf(char);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
  };

  const getTimeBuffer = () => {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter); // Big endian counter in lower 4 bytes
    return new Uint8Array(buffer);
  };

  const generateTOTP = async (secret) => {
    const keyBytes = base32ToBytes(secret);
    const timeBytes = getTimeBuffer();
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, timeBytes);
    const bytes = new Uint8Array(sig);
    const offset = bytes[bytes.length - 1] & 0xf;
    const binary = ((bytes[offset] & 0x7f) << 24) |
                   ((bytes[offset + 1] & 0xff) << 16) |
                   ((bytes[offset + 2] & 0xff) << 8) |
                   (bytes[offset + 3] & 0xff);
    return (binary % 1000000).toString().padStart(6, '0');
  };

  const inject = async () => {
    const inputEl = document.querySelector('#tokencode');
    if (!inputEl) {
      console.log("[Autom8ed] #tokencode not found. Skipping injection.");
      return;
    }

    const code = await generateTOTP(secrets[service]);
    console.log("[Autom8ed] Auto-injected TOTP:", code);

    const buttonSelectors = ['#LogonButton', 'button[name="_eventId_proceed"]', 'button[type="submit"]'];

    const fillInput = () => {
      inputEl.focus();
      inputEl.value = code;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      console.log("[Autom8ed] Code injected.");
    };

    fillInput();
    setTimeout(() => {
      fillInput();
      const btn = buttonSelectors.map(sel => document.querySelector(sel)).find(el => el);
      if (btn) {
        btn.click();
        console.log("[Autom8ed] Login button clicked.");
      } else {
        console.warn("[Autom8ed] No login button found.");
      }
    }, 500);
  };

  inject();
})();