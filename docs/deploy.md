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
                         # (includes 20261107_220653_ingest_pipeline: sources/source-items/events
                         # tables + the Articles.event/duplicate_warning columns — required before
                         # starting the worker with INGEST_ENABLED=true, see below)
npm run seed             # 3 rubrics + 3 demo articles + 3 page templates + test users
npm run dev            # or: npm run build && npm start
npm run worker         # pg-boss worker, separate process — see "Ingestion worker" below
```

Expose the dev server only on `100.94.103.26:<port>` with `<port>` in `6000-6999`, never `0.0.0.0`.

## Ingestion worker (FACT-169)

`npm run worker` always runs the stage-1 `recompute-popular` job. It additionally runs the
ingestion/dedup/editorial-draft jobs (`ingest-sync-sources`, `ingest-dispatch-polls`,
`ingest-poll-source`, `ingest-cluster-events`, `ingest-draft-from-event`) when
`INGEST_ENABLED=true` — see `docs/editorial-pipeline.md` for what each job does.

```bash
DATABASE_URL=... PAYLOAD_SECRET=... INGEST_ENABLED=true npm run worker
```

Recommended sandbox values: `INGEST_ENABLED=true`, `INGEST_INCLUDE_CANDIDATES=false` (only
`config/sources.yaml`'s `verified` sources autopoll), `EVENT_CONFIRMATION_MIN_SOURCES=2`,
`AI_PROVIDER=none` (no `AI_API_KEY` without Roman's sign-off — see epic FACT-164).

On startup the worker syncs `config/sources.yaml` into the `sources` collection (idempotent,
re-run on every worker restart and every 15 minutes), then polls each enabled source on its own
`poll_interval`. No separate one-time setup step is needed beyond the migration above — a fresh
`sources` table populates itself on first worker start.

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
(`eslint.ignoreDuringBuilds: true` in `next.config.mjs`) — kept that way so a lint-only failure
never blocks the Docker image. The one-time `@typescript-eslint/no-explicit-any` backlog from
when ESLint was first wired up is fixed (FACT-169: `payload generate:types` + typed
relationship/db-pool access); only a `no-img-element` warning on the article cover image
remains, intentionally not addressed (would need a width/height-aware `next/image` rework).

## Hostname

No `*.bigear.uk` hostname has been assigned yet — DevOps to pick one and wire it up; this
service is not deployed anywhere public from this run.
