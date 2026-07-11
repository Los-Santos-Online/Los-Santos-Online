from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
import base64
import hashlib

# Inputs
pubkey_b64 = "BL0CViJpdnzb50jMP7FTReZj42djSP7D4t4hdp0kbbA1QPTK8JoDVBltiEKgClR2UVX0+VHNAvjGCcwiArhEWoY="
signature_b64 = "rhOl32kk19UOmo6KV49sq1f3fEXOZtXvhtYOz7UP78wNglhpQMGHGeh/hn1gzrC6ervPtTBcJQ+nNr9M7CgnLg=="

# Step 1: Decode public key (assumed uncompressed point)
pubkey_bytes = base64.b64decode(pubkey_b64)
assert pubkey_bytes[0] == 0x04  # uncompressed EC point
x = int.from_bytes(pubkey_bytes[1:33], 'big')
y = int.from_bytes(pubkey_bytes[33:], 'big')

from cryptography.hazmat.primitives.asymmetric import ec
public_numbers = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1())
public_key = public_numbers.public_key()

# Step 2: Prepare message (assume it's just the raw pubkey bytes)
message = pubkey_bytes

# Step 3: Prepare signature (raw r||s to DER)
sig_bytes = base64.b64decode(signature_b64)
r = int.from_bytes(sig_bytes[:32], 'big')
s = int.from_bytes(sig_bytes[32:], 'big')
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
signature_der = encode_dss_signature(r, s)

# Step 4: Verify
try:
    public_key.verify(signature_der, message, ec.ECDSA(hashes.SHA256()))
    print("✅ Signature is VALID for the given public key and message.")
except Exception as e:
    print("❌ Signature is INVALID:", str(e))
