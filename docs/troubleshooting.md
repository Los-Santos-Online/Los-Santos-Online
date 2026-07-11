# Troubleshooting

[Back to documentation index](README.md)

## `docker` is not recognized in PowerShell

Install Docker Desktop, enable the WSL 2/Linux-container engine, restart Docker
Desktop, and open a new PowerShell window.

```powershell
docker version
docker compose version
```

## Docker Desktop internal server/API error

Confirm Docker Desktop is running and set to Linux containers. Restart Docker
Desktop. If needed:

```powershell
wsl --shutdown
```

Reopen Docker Desktop and wait until its engine reports ready.

## Missing TLS secret files

If `tls.key` or `tls.crt` is missing, run:

```sh
docker compose --profile setup run --build --rm certificate-generator
```

The generator may create a missing static pair while preserving a complete
existing pair. It refuses incomplete/mismatched pairs and refuses to overwrite
both existing static pairs without an explicit force rotation.

## The game rejects HTTPS

Check all of the following:

1. The requested hostname appears in the certificate SAN list.
2. DNS resolves to the correct server.
3. TCP 443 reaches the Docker host.
4. Docker serves `certs/tls/tls.crt`.
5. The game embeds the matching complete DER certificate at
   `certs/tls/<DOMAIN>.cer`.

Inspect the running certificate:

```sh
docker compose exec api openssl x509 -in /run/secrets/tls_cert -noout -subject -issuer -dates -ext subjectAltName
```

The game uses complete-certificate pinning. An SPKI hash is not a substitute.

## P2P certificate issuance fails

Confirm these files exist and are readable:

```text
certs/p2p/ca-key.pem
certs/p2p/ca-cert.pem
```

Then inspect API logs:

```sh
docker compose logs --since 10m api
```

Both P2P endpoints sign locally. There is no production proxy fallback.

Confirm the API container is using the required OpenSSL build:

```sh
docker compose exec api openssl version
```

Expected:

```text
OpenSSL 3.4.1 11 Feb 2025 (Library: OpenSSL 3.4.1 11 Feb 2025)
```

## Relay clients connect to the wrong server

Check the values inside the running API container:

```sh
docker compose exec -T api sh -ec 'printf "RELAY_PUBLIC_ADDRESS=%s\nRELAY_PUBLIC_PORT=%s\n" "$RELAY_PUBLIC_ADDRESS" "$RELAY_PUBLIC_PORT"'
```

`RELAY_PUBLIC_ADDRESS` and `RELAY_PUBLIC_PORT` are what clients receive. The relay
is external and Docker does not listen on or map its UDP port.

## Port 80 or 443 is allocated

Stop the conflicting service or change the relevant public port in `.env`.

Windows listeners:

```powershell
Get-NetTCPConnection -State Listen
```

Linux listeners:

```sh
ss -lntup
```

## `database-init` fails

```sh
docker compose logs --no-color postgres database-init
```

Confirm:

- `SERVER_SECRET` is present and URL-safe.
- Docker has sufficient memory and disk space.
- The PostgreSQL volume is writable.
- The schema change is compatible with existing data.

OpenSSL is installed in the Prisma build image.

## R2 uploads fail

Confirm the endpoint includes the correct R2 account ID, bucket names match
exactly, and credentials have object read/write permission. The main and UGC
credentials may differ.

Storage failures do not fall back to local filesystem writes.

## BlueSphere reports a self-signed certificate error

BlueSphere validation uses a dedicated HTTP client that accepts BlueSphere's
self-signed certificate. Rebuild the API to ensure current code is running:

```sh
docker compose up --build -d api
```

## Inspect service health

```sh
docker compose ps
curl http://localhost/healthz
curl -k https://localhost/healthz
```

For more operational commands, see [Operations](operations.md).
