import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const certsRoot = process.env.CERT_OUTPUT_DIR
  ? path.resolve(process.env.CERT_OUTPUT_DIR)
  : path.resolve(scriptDir, '..', '..', 'certs');
const certsDir = path.join(certsRoot, 'relay');
fs.mkdirSync(certsDir, { recursive: true });

console.log('Generating ECDSA P-256 key pair for relay server signing...\n');

// Generate key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // P-256 curve
  publicKeyEncoding: {
    type: 'spki',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to base64 (for XML)
const publicKeyB64 = Buffer.from(publicKey).toString('base64');

console.log('✓ Key pair generated!\n');
console.log('=== PUBLIC KEY (base64) ===');
console.log(publicKeyB64);
console.log('\nPrivate key generated and written to disk (contents intentionally hidden).');

// Save keys to files
fs.writeFileSync(path.join(certsDir, 'relay_private_key.pem'), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(certsDir, 'relay_public_key.txt'), publicKeyB64);

console.log('\n✓ Keys saved:');
console.log(`  - ${path.join(certsDir, 'relay_private_key.pem')} (KEEP SECRET!)`);
console.log(`  - ${path.join(certsDir, 'relay_public_key.txt')}`);
