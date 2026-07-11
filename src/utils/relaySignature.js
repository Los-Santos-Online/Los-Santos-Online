import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load private key from file
const privateKeyPath = path.join(__dirname, '..', '..', 'certs', 'relay', 'relay_private_key.pem');
const publicKeyPath = path.join(__dirname, '..', '..', 'certs', 'relay', 'relay_public_key.txt');
let privateKey = null;

try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch (error) {
  console.warn('Warning: relay_private_key.pem not found. Relay signatures will not work.');
  console.warn('Run generate_relay_keys.js to create a new key pair.');
}

// Public key (base64) - can be shared publicly
export const PUBLIC_KEY = fs.existsSync(publicKeyPath)
  ? fs.readFileSync(publicKeyPath, 'utf8').trim()
  : '';

/**
 * Convert DER signature to raw format (r||s concatenated)
 */
function derToRaw(derSig) {
  let pos = 2; // Skip sequence tag and length

  // Parse r
  if (derSig[pos] !== 0x02) throw new Error('Invalid DER signature');
  pos++;
  const rLen = derSig[pos++];
  let r = derSig.slice(pos, pos + rLen);
  pos += rLen;

  // Remove leading zero if present (added for DER encoding)
  if (r[0] === 0x00) r = r.slice(1);

  // Pad to 32 bytes if needed
  if (r.length < 32) {
    const padding = Buffer.alloc(32 - r.length);
    r = Buffer.concat([padding, r]);
  }

  // Parse s
  if (derSig[pos] !== 0x02) throw new Error('Invalid DER signature');
  pos++;
  const sLen = derSig[pos++];
  let s = derSig.slice(pos, pos + sLen);

  // Remove leading zero if present
  if (s[0] === 0x00) s = s.slice(1);

  // Pad to 32 bytes if needed
  if (s.length < 32) {
    const padding = Buffer.alloc(32 - s.length);
    s = Buffer.concat([padding, s]);
  }

  return Buffer.concat([r, s]);
}

/**
 * Sign a relay server host string (e.g., "192.168.1.100:61456")
 * @param {string} hostString - The host:port string to sign
 * @returns {string} Base64-encoded signature
 */
export function signRelayHost(hostString) {
  if (!privateKey) {
    throw new Error('Private key not loaded. Cannot sign relay hosts.');
  }

  const sign = crypto.createSign('SHA256');
  sign.update(hostString);
  sign.end();

  // Sign and get DER format signature
  const derSignature = sign.sign(privateKey);

  // Convert DER to raw format (r||s) which is what the XML expects
  const rawSignature = derToRaw(derSignature);

  return rawSignature.toString('base64');
}

/**
 * Generate relay server configuration with signature
 * @param {string} address - IP address or hostname
 * @param {string|number} port - Port number
 * @returns {object} Server configuration with host and signature
 */
export function generateRelayServer(address, port) {
  const host = `${address}:${port}`;
  const signature = signRelayHost(host);

  return {
    host,
    signature
  };
}
