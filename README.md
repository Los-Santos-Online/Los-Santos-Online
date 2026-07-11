# Los Santos Online backend

Self-hosted Node.js backend for Los Santos Online. The supported deployment is a
Docker Compose stack containing the API, PostgreSQL, automatic
database initialization, and an optional Discord player-count bot.

## Quick start

```sh
git clone <YOUR-REPOSITORY-URL>
cd los-santos-online-backend
cp .env.example .env
```

Windows PowerShell users should replace the copy command with:

```powershell
Copy-Item .env.example .env
```

Edit `.env`, then generate the keys/certificates and start the stack:

```sh
docker compose --profile setup run --build --rm certificate-generator
docker compose up --build -d
```

The complete walkthrough is in [Getting started](docs/getting-started.md).

## Services and ports

| Service | Default exposure |
| --- | --- |
| HTTP API | `80/tcp` for legacy clients |
| HTTPS API | `443/tcp`, with TLS terminated inside the API container |
| Relay | Configurable UDP public port mapped to the internal relay listener |
| PostgreSQL | Private Compose network only; not published to the host |

P2P certificates are always issued locally using the static CA under `certs/p2p`.
Certificate requests are never proxied to a production server.
Docker builds and runs certificate operations with the checksum-pinned OpenSSL
`3.4.1` release.

## Documentation

| Guide | Contents |
| --- | --- |
| [Documentation index](docs/README.md) | Browse every guide |
| [Getting started](docs/getting-started.md) | New server installation from clone to health check |
| [Certificates and keys](docs/certificates.md) | TLS pinning, P2P CA, relay keys, and rotation |
| [Configuration](docs/configuration.md) | Environment variables, R2, Discord, and networking |
| [Operations](docs/operations.md) | Updates, logs, backups, restores, and database maintenance |
| [Troubleshooting](docs/troubleshooting.md) | Common Docker, TLS, database, and R2 failures |

## Verify a running deployment

```sh
docker compose ps
curl http://localhost/healthz
curl -k https://localhost/healthz
```

Expected response:

```json
{"status":"ok"}
```

Generated secrets, `.env`, and database dumps must never be committed. The
repository ignore rules cover the standard generated paths.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
