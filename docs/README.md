# Documentation

Use this directory as the GitHub handbook for deploying and maintaining the Los
Santos Online backend.

## Start here

1. [Getting started](getting-started.md) — install a new server.
2. [Certificates and keys](certificates.md) — generate and pin all required trust material.
3. [Configuration](configuration.md) — configure networking, PostgreSQL, R2, BlueSphere, and Discord.
4. [Operations](operations.md) — update, monitor, back up, and restore the deployment.

## Reference

- [Troubleshooting](troubleshooting.md)
- [Project overview](../README.md)

## Deployment flow

```text
Clone repository
    ↓
Create and edit .env
    ↓
Generate static TLS + P2P CA and rotatable relay keys
    ↓
Pin the generated TLS DER certificate in the game
    ↓
Start Docker Compose
    ↓
PostgreSQL health check → schema sync → seed import → API startup
    ↓
Verify HTTP, HTTPS, relay mapping, and logs
```
