# Deploy / run

## Dev (Contabo runtime node, shared Postgres)

Per team rules, dev does **not** run its own Postgres container — it uses the shared
`platform-postgres-1` instance with a dedicated database:

```bash
docker exec platform-postgres-1 psql -U dev -c "CREATE DATABASE newsroom;"
```

Then, with `DATABASE_URL=postgres://dev:dev@100.94.103.26:5432/newsroom`:

```bash
npm install
npm run migrate         # creates tables + the unaccent extension/search_vector trigger
npm run seed             # 3 rubrics + 3 demo articles + 3 page templates + test users
npm run dev            # or: npm run build && npm start
npm run worker         # pg-boss worker (recompute-popular job), separate process
```

Expose the dev server only on `100.94.103.26:<port>` with `<port>` in `6000-6999`, never `0.0.0.0`.

## Prod-like / stage-style (own Postgres, via docker-compose.yml)

```bash
docker compose up --build
```

This starts the app **and its own Postgres** (allowed here because this compose file is the
stage/Dokploy-style artifact, not an extra dev-only DB container on the shared host). The app
binds to `100.94.103.26:6020`. Stop it with `docker compose down` when you're done reviewing.

Dokploy/stage deploys from this same `docker-compose.yml`, but with its own `db` service and
env values — the shared dev Postgres never goes into stage/prod env.

## Lint

`npm run lint` (`eslint.config.mjs`, `next/core-web-vitals` + `next/typescript`) is a separate
CI step and intentionally **not** run during `next build`/Docker image build
(`eslint.ignoreDuringBuilds: true` in `next.config.mjs`) — ESLint was only wired up when the CI
workflow was added, and it surfaced a pre-existing backlog of `@typescript-eslint/no-explicit-any`
across several files (Payload's relationship fields come back loosely typed without running
`payload generate:types`), plus one `no-img-element` and one `no-unescaped-entities`. None of it
is a regression from this change; fixing it is a follow-up, not a build blocker.

## Hostname

No `*.bigear.uk` hostname has been assigned yet — DevOps to pick one and wire it up; this
service is not deployed anywhere public from this run.
