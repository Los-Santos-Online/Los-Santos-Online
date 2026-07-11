# Getting started

This guide takes a new host from a clean clone to a verified Docker deployment.

[Back to documentation index](README.md)

## Requirements

- Git.
- Docker Desktop on Windows/macOS, or Docker Engine with Compose v2 on Linux.
- A DNS hostname pointed at the server, such as `dev.lossantosonline.com`.
- Two private S3-compatible buckets. Cloudflare R2 is supported: one bucket for
  saves/stats and one for UGC.
- A public IPv4 address and forwarded UDP port for the relay, unless an existing
  external relay is intentionally configured.
- TCP ports 80 and 443 available or mapped through the firewall/router.

Node.js, PostgreSQL, Prisma, and OpenSSL do not need to be installed on the host.
The Docker images compile the checksum-verified OpenSSL 3.4.1 source release and
assert the exact runtime string during the build.

## 1. Clone the repository

```sh
git clone <YOUR-REPOSITORY-URL>
cd los-santos-online-backend
```

## 2. Create `.env`

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```sh
cp .env.example .env
```

Replace the placeholders. `DOMAIN` is the only hostname setting: it configures
ROS and first-time TLS certificate generation. `SERVER_SECRET` is the only core
server secret: Compose uses it for private PostgreSQL authentication and signed
photo-upload tokens.

Generate `SERVER_SECRET` with Docker:

```sh
docker run --rm node:22-alpine node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the result into `SERVER_SECRET`. Then configure the two explicit R2 groups:
one for saves/stats and one for UGC.

For a deployment without Discord, leave these blank:

```dotenv
DISCORD_TOKEN=""
DISCORD_GUILD_ID=""
```

See [Configuration](configuration.md) for every setting and the R2 setup.

## 3. Generate certificates and keys

Run once on a new installation:

```sh
docker compose --profile setup run --build --rm certificate-generator
```

This creates the static HTTPS certificate, static P2P CA, and initial relay key
pair. The static pairs are protected against accidental replacement.

Before continuing, add this complete DER certificate to the game's certificate
allowlist:

```text
certs/tls/<DOMAIN>.cer
```

Read [Certificates and keys](certificates.md) before distributing a game build.

## 4. Start the stack

```sh
docker compose up --build -d
```

On first boot Compose:

1. Starts PostgreSQL 16 and waits for it to become healthy.
2. Applies `prisma/schema.prisma` with `prisma db push`.
3. Runs `prisma db seed` for legacy stats, Gen9 stats, and `rstar`/`verif`
   mission metadata.
4. Starts the HTTP/HTTPS API and UDP relay.
5. Starts the Discord player-count bot container, which exits cleanly when disabled.

Seed imports are idempotent and do not duplicate records during normal restarts.

## 5. Verify startup

```sh
docker compose ps
docker compose logs --no-color database-init
curl http://localhost/healthz
curl -k https://localhost/healthz
```

Expected health response:

```json
{"status":"ok"}
```

Expected service state:

- `api`: healthy.
- `postgres`: healthy.
- `database-init`: `Exited (0)` because it is a successful one-shot task.
- `discord-bot`: running when enabled or cleanly stopped when disabled.

Inspect the certificate served by Docker:

```sh
docker compose exec api openssl x509 -in /run/secrets/tls_cert -noout -subject -issuer -dates -ext subjectAltName
```

Verify the required OpenSSL runtime:

```sh
docker compose exec api openssl version
```

Expected output:

```text
OpenSSL 3.4.1 11 Feb 2025 (Library: OpenSSL 3.4.1 11 Feb 2025)
```

Finally, test from another machine using the public hostname. Confirm TCP 80,
TCP 443, and the configured public UDP relay port pass through the firewall/NAT.

## Next steps

- Create a first [database backup](operations.md#database-backups).
- Learn the [update workflow](operations.md#updating).
