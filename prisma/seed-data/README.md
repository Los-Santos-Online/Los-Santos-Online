# Database seed snapshots

These deterministic snapshots were exported from the existing production database:

- `stat_lookup.jsonl.b64`: legacy profile-stat definitions
- `gen9_stat_lookup.jsonl.b64`: Gen9 profile-stat definitions
- `mission_metadata.jsonl.b64`: official and verified mission metadata only
  (`UGC.category IN (rstar, verif)`)

Each line is a base64-encoded JSON record so embedded mission metadata is preserved.
`npx prisma db seed` invokes `prisma/seed.js`, which imports the snapshots with
batched `createMany({ skipDuplicates: true })` calls. The snapshots do not contain
users, sessions, photos, player-created `gta5mission` records, or mission binary
files. Mission payload files remain in S3-compatible UGC storage.
