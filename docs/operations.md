# Operations

[Back to documentation index](README.md)

## Service status

```sh
docker compose ps
```

The API and PostgreSQL should report healthy. `database-init` is a one-shot service
and should exit with code 0.

## Logs

```sh
docker compose logs -f api
docker compose logs -f discord-bot
docker compose logs postgres
docker compose logs --no-color database-init
```

## Restarting

Restart only the API:

```sh
docker compose restart api
```

Stop all services while preserving PostgreSQL data:

```sh
docker compose down
```

Start them again:

```sh
docker compose up -d
```

## Updating

Back up PostgreSQL before deploying schema changes, then run:

```sh
git pull --ff-only
docker compose up --build -d
docker compose ps
```

Compose recreates changed containers and runs the idempotent database initializer
before starting the API.

## Database shell

```sh
docker compose exec postgres psql -U lso -d lso
```

Replace `lso` with the configured PostgreSQL user/database if changed.

## Database backups

Create a compressed PostgreSQL backup inside the private container, copy it to the
host, then remove the temporary container copy:

```sh
docker compose exec postgres pg_dump -U lso -d lso -Fc -f /tmp/lso.dump
docker compose cp postgres:/tmp/lso.dump ./lso.dump
docker compose exec postgres rm /tmp/lso.dump
```

Store backups encrypted and outside the repository.

## Database restore

Restore into the configured database:

```sh
docker compose cp ./lso.dump postgres:/tmp/lso.dump
docker compose exec postgres pg_restore -U lso -d lso --clean --if-exists /tmp/lso.dump
docker compose exec postgres rm /tmp/lso.dump
```

Stop the API during a production restore if clients could write data concurrently.

## Database initialization and seeds

The one-shot initializer runs:

```sh
npx prisma db push
npx prisma db seed
```

Seed snapshots contain:

- Legacy `StatLookup` definitions.
- `Gen9StatLookup` definitions.
- `rstar` and `verif` mission metadata.

Seed inserts use duplicate protection and are safe to run repeatedly.

The deployment currently uses `prisma db push`, so inspect schema changes and take
a backup before deploying a revision that modifies `prisma/schema.prisma`.

## Persistent volume safety

`docker compose down` keeps the `postgres-data` volume. This command permanently
deletes it and must not be used during routine updates:

```sh
docker compose down -v
```

## Certificate and relay operations

See [Certificates and keys](certificates.md). TLS and P2P CA rotation requires a
coordinated client update. Relay keys can be regenerated independently and the API
must then be restarted to load them.
