# Certificates and keys

[Back to documentation index](README.md)

The deployment uses three independent key sets:

1. A static HTTPS certificate pinned as a complete certificate by the game.
2. A static P2P CA used to issue short-lived player certificates locally.
3. A relay signing key pair that may rotate at any time.

All Docker certificate generation and P2P issuance uses exactly:

```text
OpenSSL 3.4.1 11 Feb 2025 (Library: OpenSSL 3.4.1 11 Feb 2025)
```

The Docker build downloads the [official OpenSSL 3.4.1 source
archive](https://openssl-library.org/source/old/3.4/), verifies its pinned SHA-256
checksum, compiles it, and fails if the runtime version string differs.

## Generate everything

```sh
docker compose --profile setup run --build --rm certificate-generator
```

Generated files:

| File | Purpose | Secret? |
| --- | --- | --- |
| `certs/tls/tls.key` | HTTPS private key used by Docker | Yes |
| `certs/tls/tls.crt` | PEM certificate served on port 443 | No |
| `certs/tls/<DOMAIN>.cer` | Complete DER certificate for the game's pin list | No |
| `certs/tls/tls-cert-sha256.txt` | Complete-certificate SHA-256 fingerprint | No |
| `certs/p2p/ca-key.pem` | P2P certificate-authority signing key | Yes |
| `certs/p2p/ca-cert.pem` | P2P CA in PEM form | No |
| `certs/p2p/ca-cert.cer` | P2P CA in DER form | No |
| `certs/relay/relay_private_key.pem` | Relay signing key | Yes |
| `certs/relay/relay_public_key.txt` | Relay public key returned to clients | No |

The command may generate a missing static pair while preserving an existing one,
which supports upgrading an installation that already has TLS. If both static
pairs exist, it refuses to replace them.

## TLS certificate pinning

The game uses complete-certificate pinning, not SPKI pinning. Add this exact DER
file to the game's public-certificate allowlist:

```text
certs/tls/<DOMAIN>.cer
```

The default hostname produces:

```text
certs/tls/dev.lossantosonline.com.cer
```

Its SAN list includes both `dev.lossantosonline.com` and
`*.dev.lossantosonline.com` so the same pinned certificate can be served by the
base development hostname and its direct subdomains.

Docker serves `tls.crt`; the named `.cer` is the same certificate encoded as DER.
Never ship `tls.key` in the game.

The generated certificate is self-signed. Browser warnings are expected because
the game establishes trust through its embedded certificate list. Set the one
public hostname before first generation:

```dotenv
DOMAIN="dev.lossantosonline.com"
```

Changing the key or certificate after distributing the client requires shipping
the replacement complete `.cer` certificate to every client.

Verify the running certificate:

```sh
docker compose exec api openssl x509 -in /run/secrets/tls_cert -noout -subject -issuer -dates -ext subjectAltName
```

## P2P CA

Both `CreateP2PCertificate` and `CreateP2PCertificateCyprus` issue certificates
locally using:

```text
certs/p2p/ca-key.pem
certs/p2p/ca-cert.pem
```

There is no production proxy or remote certificate issuer. Keep the P2P CA pair
static wherever clients trust its public certificate. Back up the private key
securely and never commit or distribute it.

## Relay key rotation

Relay keys are not pinned as permanent trust material and may rotate freely. Rotate
only the relay pair with:

```sh
docker compose --profile setup run --build --rm certificate-generator node /app/tools/generate_relay_keys.js
```

Restart the API afterward so it reloads the new files:

```sh
docker compose restart api
```

## Intentional static rotation

Only rotate TLS or the P2P CA when a coordinated client update is ready.

To rotate only TLS while preserving the P2P CA, use `FORCE_TLS_REGEN=1`:

```powershell
$env:FORCE_TLS_REGEN = "1"
docker compose --profile setup run --build --rm certificate-generator
Remove-Item Env:FORCE_TLS_REGEN
```

```sh
FORCE_TLS_REGEN=1 docker compose --profile setup run --build --rm certificate-generator
```

The broader `FORCE_CERT_REGEN=1` option below rotates both pinned trust sets.

PowerShell:

```powershell
$env:FORCE_CERT_REGEN = "1"
docker compose --profile setup run --build --rm certificate-generator
Remove-Item Env:FORCE_CERT_REGEN
```

Linux/macOS:

```sh
FORCE_CERT_REGEN=1 docker compose --profile setup run --build --rm certificate-generator
```

Rotation procedure:

1. Stop the public service.
2. Back up the entire `certs` directory securely.
3. Generate replacements intentionally.
4. Add the new TLS `.cer` and P2P CA public certificate to the game as required.
5. Distribute the updated client before removing trust in old certificates.
6. Rebuild and restart Docker.

## Public CA alternative

You may replace `certs/tls/tls.key` and `certs/tls/tls.crt` with a matching private
key and full-chain PEM certificate from a public CA. Convert the leaf certificate
to DER for the game's certificate list. Public CA renewals usually change the leaf
certificate, so complete-certificate pinning requires a client update on renewal.

## Backups

Keep encrypted offline copies of:

```text
certs/tls/tls.key
certs/tls/tls.crt
certs/p2p/ca-key.pem
certs/p2p/ca-cert.pem
```

Relay keys do not require permanent backups.
