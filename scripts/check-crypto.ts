// Minimal round-trip check for the token encryption. Run: npm run check:crypto
import { encrypt, decrypt } from '../src/lib/crypto';

process.env.APP_ENCRYPTION_KEY ||= 'a'.repeat(64); // key() reads env lazily, so set before use

const secret = 'qbo-refresh-token-abc123';
const restored = decrypt(encrypt(secret));
if (restored !== secret) throw new Error('crypto round-trip failed');

// tampered ciphertext must fail the GCM auth tag
let tamperRejected = false;
try {
  const blob = encrypt(secret);
  const bad = blob.slice(0, -2) + (blob.endsWith('0') ? '1' : '0');
  decrypt(bad);
} catch {
  tamperRejected = true;
}
if (!tamperRejected) throw new Error('tampered ciphertext should not decrypt');

console.log('crypto ok');
