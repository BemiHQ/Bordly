import * as crypto from 'node:crypto';

import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';

const VERSION = 'v1';
const ENCRYPTION_ALGORITHM: crypto.CipherGCMTypes = 'aes-256-gcm';
const DELIMITER = '|';

const IV_LENGTH = 12; // 96 bits recommended for GCM
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16;

const MIN_SALT_LENGTH = 16;
const MAX_CACHE_SIZE = 1_000;

export class Encryption {
  private static keyCache = {} as Record<string, Buffer>;

  static encrypt(value: string, { salt }: { salt: string }) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Encryption.deriveKey(salt);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(DELIMITER);
  }

  static decrypt(value: string, { salt }: { salt: string }) {
    try {
      const parts = value.split(DELIMITER);
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted value format');
      }
      const [version, ivBase64, authTagBase64, encryptedBase64] = parts;
      if (!version || !ivBase64 || !authTagBase64 || !encryptedBase64) {
        throw new Error('Invalid encrypted value format');
      }
      if (version !== VERSION) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }
      const iv = Buffer.from(ivBase64, 'base64');
      if (iv.length !== IV_LENGTH) {
        throw new Error('Invalid IV length');
      }
      const authTag = Buffer.from(authTagBase64, 'base64');
      if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid auth tag length');
      }

      const encrypted = Buffer.from(encryptedBase64, 'base64');
      const key = Encryption.deriveKey(salt);

      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (error) {
      reportError(error);
      throw new Error('Decryption failed');
    }
  }

  private static deriveKey(salt: string): Buffer {
    if (salt.length < MIN_SALT_LENGTH) throw new Error(`Salt must be at least ${MIN_SALT_LENGTH} characters long`);

    const cached = Encryption.keyCache[salt];
    if (cached) return cached;

    const key = crypto.scryptSync(ENV.ENCRYPTION_KEY, salt, KEY_LENGTH);

    if (Object.keys(Encryption.keyCache).length >= MAX_CACHE_SIZE) {
      reportError(new Error('Encryption key cache size exceeded, clearing cache'));
      Encryption.keyCache = {};
    }
    Encryption.keyCache[salt] = key;

    return key;
  }
}
