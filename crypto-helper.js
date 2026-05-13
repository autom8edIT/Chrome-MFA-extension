/* crypto-helper.js - Advanced Encryption Layer for MFA Extension
   - Implements Master Password protection using Web Crypto API
   - Key Derivation: PBKDF2 with 100,000 iterations
   - Encryption: AES-GCM (256-bit) with unique IVs
*/

"use strict";

const CryptoHelper = {
  // Config
  ITERATIONS: 100000,
  SALT_LEN: 16,
  IV_LEN: 12,

  /**
   * Derive a robust AES-GCM key from a master password and salt
   */
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: this.ITERATIONS,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  /**
   * Encrypt a plain-text string using a master password
   * Returns: base64(salt + iv + ciphertext)
   */
  async encrypt(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
    const key = await this.deriveKey(password, salt);

    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );

    // Combine salt + iv + ciphertext into one buffer
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  },

  /**
   * Decrypt a blob using the master password
   */
  async decrypt(base64Data, password) {
    try {
      const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));

      const salt = combined.slice(0, this.SALT_LEN);
      const iv = combined.slice(this.SALT_LEN, this.SALT_LEN + this.IV_LEN);
      const ciphertext = combined.slice(this.SALT_LEN + this.IV_LEN);

      const key = await this.deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      throw new Error("Decryption failed. Incorrect password or corrupted data.");
    }
  }
};
