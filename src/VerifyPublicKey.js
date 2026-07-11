import crypto from 'crypto';

// Your inputs
const pubKeyBase64 = 'BL0CViJpdnzb50jMP7FTReZj42djSP7D4t4hdp0kbbA1QPTK8JoDVBltiEKgClR2UVX0+VHNAvjGCcwiArhEWoY=';
const signatureBase64 = 'rhOl32kk19UOmo6KV49sq1f3fEXOZtXvhtYOz7UP78wNglhpQMGHGeh/hn1gzrC6ervPtTBcJQ+nNr9M7CgnLg==';

// Step 1: Decode public key
const pubKeyBytes = Buffer.from(pubKeyBase64, 'base64');
if (pubKeyBytes[0] !== 0x04) throw new Error('Expected uncompressed EC point');

const x = pubKeyBytes.slice(1, 33);
const y = pubKeyBytes.slice(33, 65);

// Step 2: Construct SPKI public key (needed by crypto module)
const pubKeyObject = crypto.createPublicKey({
  key: Buffer.concat([
    Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'), // SECP256R1 uncompressed header
    pubKeyBytes
  ]),
  format: 'der',
  type: 'spki',
});

// Step 3: Message is the raw public key bytes
const message = pubKeyBytes;

// Step 4: Signature (r || s)
const sig = Buffer.from(signatureBase64, 'base64');
const r = sig.slice(0, 32);
const s = sig.slice(32);

// Step 5: DER encode the signature (needed for verify)
function derEncode(r, s) {
  function encodeInt(i) {
    if (i[0] & 0x80) i = Buffer.concat([Buffer.from([0]), i]);
    return Buffer.concat([Buffer.from([0x02, i.length]), i]);
  }
  const encoded = Buffer.concat([encodeInt(r), encodeInt(s)]);
  return Buffer.concat([Buffer.from([0x30, encoded.length]), encoded]);
}
const signatureDER = derEncode(r, s);

// Step 6: Verify
const verified = crypto.verify(
  'sha256',
  message,
  pubKeyObject,
  signatureDER
);

console.log(verified ? '✅ Signature is VALID' : '❌ Signature is INVALID');
