import * as crypto from 'node:crypto';

import { ENV } from '@/utils/env';

const ENCRYPTION_ALGORITHM = 'aes256';

export class EncryptionOld {
  static encrypt(value: string): string {
    if (!value) return value;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, EncryptionOld.saltedKey(), iv);
    const encrypted = cipher.update(value, 'utf8', 'hex');

    return [encrypted + cipher.final('hex'), Buffer.from(iv).toString('hex')].join('|');
  }

  static decrypt(value: string): string {
    const [encrypted, iv] = value.split('|');
    if (!iv) throw new Error('IV not found');
    if (!encrypted) throw new Error('Encrypted value not found');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, EncryptionOld.saltedKey(), Buffer.from(iv, 'hex'));

    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  }

  private static saltedKey(): Buffer {
    return crypto.scryptSync(ENV.ENCRYPTION_KEY, 'salt', 32);
  }
}
