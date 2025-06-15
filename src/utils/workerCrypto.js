/**
 * Cloudflare Workers compatible crypto utilities
 * Uses Web Crypto API instead of Node.js crypto module
 */

export class Crypto {
  constructor(encryptionKey) {
    this.encryptionKey = encryptionKey;
  }

  async getKey() {
    if (this.key) return this.key;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.encryptionKey.padEnd(32, '0').slice(0, 32));
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return this.key;
  }

  async encrypt(text) {
    try {
      const key = await this.getKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );
      
      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv)
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encryptedData) {
    try {
      const key = await this.getKey();
      const { encrypted, iv } = encryptedData;
      
      const encryptedBuffer = this.base64ToArrayBuffer(encrypted);
      const ivBuffer = this.base64ToArrayBuffer(iv);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer
        },
        key,
        encryptedBuffer
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltedData = new Uint8Array(data.length + salt.length);
    saltedData.set(data);
    saltedData.set(salt, data.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
    
    return {
      hash: this.arrayBufferToBase64(hashBuffer),
      salt: this.arrayBufferToBase64(salt)
    };
  }

  async verifyPassword(password, hash, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const saltBuffer = this.base64ToArrayBuffer(salt);
    
    const saltedData = new Uint8Array(data.length + saltBuffer.byteLength);
    saltedData.set(data);
    saltedData.set(new Uint8Array(saltBuffer), data.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
    const computedHash = this.arrayBufferToBase64(hashBuffer);
    
    return computedHash === hash;
  }

  generateSecureToken(length = 32) {
    const array = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Utility functions
export async function encrypt(text, key) {
  const crypto = new Crypto(key);
  return await crypto.encrypt(text);
}

export async function decrypt(encryptedData, key) {
  const crypto = new Crypto(key);
  return await crypto.decrypt(encryptedData);
}

export async function hashPassword(password) {
  const crypto = new Crypto('dummy-key');
  return await crypto.hashPassword(password);
}

export async function verifyPassword(password, hash, salt) {
  const crypto = new Crypto('dummy-key');
  return await crypto.verifyPassword(password, hash, salt);
}

export function generateSecureToken(length = 32) {
  const crypto = new Crypto('dummy-key');
  return crypto.generateSecureToken(length);
}