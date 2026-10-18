import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM. Key = APP_ENCRYPTION_KEY (32 bytes hex). Used to encrypt the QBO refresh token at rest.
function key(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k || k.length !== 64) {
    throw new Error('APP_ENCRYPTION_KEY must be 32 bytes as hex (64 chars). Generate: openssl rand -hex 32');
  }
  return Buffer.from(k, 'hex');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decrypt(blob: string): string {
  const [ivh, tagh, ench] = blob.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivh, 'hex'));
  decipher.setAuthTag(Buffer.from(tagh, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ench, 'hex')), decipher.final()]).toString('utf8');
}
