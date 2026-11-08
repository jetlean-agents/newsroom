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

## Stage (Dokploy sandbox) — `docker-compose.yml` + `docker-compose.minio.yml`

Deployed as **two** Dokploy compose apps in one project (`Newsroom`), same split Avto-traffic
uses for Umami (`jetlean-agents/avto-traffic` `docs/deploy.md`): routing two domains to two
services inside a single Dokploy compose app has reproducibly `502`'d there, so media storage
is its own compose app instead of a second domain on the main one.

| compose app | compose file | services | domain → service:port |
|---|---|---|---|
| `newsroom` | `docker-compose.yml` | `app`, `worker`, `db` (own Postgres) | `news.bigear.uk` → `app:3000` |
| `newsroom-minio` | `docker-compose.minio.yml` | `minio`, `createbuckets` (one-shot) | `news-media.bigear.uk` → `minio:9000` |

No compose service publishes a host port — Dokploy/Traefik routes each domain straight to the
service's internal container port via the Dokploy domain config, not a compose `ports:` mapping
(there is no stable host IP on the Dokploy host to bind to, unlike the Contabo dev node).

Both this project's Postgres (`db`) and its MinIO (`minio`) are **this project's own** —
never the shared Contabo Postgres/Redis, never a Tailscale/`100.x` address in stage env (repo
`CLAUDE.md`, "Окружения: dev / stage / prod"). `app`/`worker` reach MinIO over its **public**
URL (`S3_ENDPOINT`/`S3_PUBLIC_URL` = `https://news-media.bigear.uk`), not a cross-compose-app
internal network — Docker Compose service DNS names only resolve within the same compose
project, and two separate Dokploy compose apps are two separate projects.

`createbuckets` (image `minio/mc`) runs once after `minio` is healthy: creates the `S3_BUCKET`
bucket if missing and sets it to anonymous-download (`mc anonymous set download`) so uploaded
media is publicly readable without signed URLs — matches the `media` collection's own
`access.read: () => true`. Re-running it on every deploy is safe (idempotent).

`app`'s migration runs automatically on every container start (`Dockerfile`'s `CMD`: `npm run
migrate && npm start`) — no separate migration step. Seeding (`npm run seed`) is manual, run
once against the stage `DATABASE_URL` after the first successful deploy; it creates the demo
`admin@newsroom.test` / `password123` account (hardcoded in `src/seed/index.ts`, not a secret —
sandbox-only, never used in prod) alongside 3 demo rubrics/articles/page templates.

Locally on Contabo, `docker compose up --build` still works for a quick prod-like smoke test
(builds the image, starts `app`+`worker`+`db`) — just without a published port; reach it with
`docker compose exec app curl localhost:3000/` or add a temporary `ports:` override file, not a
change to the tracked compose file.

## Lint

`npm run lint` (`eslint.config.mjs`, `next/core-web-vitals` + `next/typescript`) is a separate
CI step and intentionally **not** run during `next build`/Docker image build
(`eslint.ignoreDuringBuilds: true` in `next.config.mjs`) — kept that way so a lint-only failure
never blocks the Docker image. The one-time `@typescript-eslint/no-explicit-any` backlog from
when ESLint was first wired up is fixed (FACT-169: `payload generate:types` + typed
relationship/db-pool access); only a `no-img-element` warning on the article cover image
remains, intentionally not addressed (would need a width/height-aware `next/image` rework).

## Hostname

`news.bigear.uk` (app) and `news-media.bigear.uk` (MinIO, media only) — both already point at
the Dokploy server via the existing `*.bigear.uk` wildcard; no new Cloudflare DNS record was
created, only the domain/app config inside Dokploy (FACT-170).

## Prod checklist (not sandbox — do not action without Roman)

1. Register the real prod domain and point its DNS at the prod Dokploy host — not `*.bigear.uk`.
2. A **separate** Dokploy project/environment, not this sandbox project — same architecture
   (`app`+`worker`+own `db`, `minio` in its own compose app), real `SITE_URL`/`SITE_NAME`,
   `NOINDEX=false` only once the brand/content is actually ready to be indexed.
3. Swap MinIO for Cloudflare R2 (`S3_*` already provider-agnostic — only the env values change,
   no code change) per the team-wide media-storage rule; ops sets the bucket and keys, not
   agents.
4. Decide on `AI_PROVIDER`/`AI_API_KEY` only with Roman's explicit sign-off (epic FACT-164) —
   sandbox stays `none`.
5. A real scheduled Postgres backup — sandbox has none (data is reproducible from migrations +
   seed + the worker's next ingestion cycle).
