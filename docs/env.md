# Environment variables

| Name | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/newsroom` | Postgres connection string. |
| `PAYLOAD_SECRET` | yes | (random 32+ char string) | Never commit a real value. |
| `SEED_ADMIN_EMAIL` | prod | `admin@newsroom.test` | Admin account `npm run seed` creates/rotates. Required in production (`NODE_ENV=production`, always true in the Docker image) — seed throws instead of falling back to a guessable default. |
| `SEED_ADMIN_PASSWORD` | prod | (random) | Never commit a real value. Re-running seed (e.g. the compose `seed` service on a redeploy) rotates the existing admin account to whatever this is currently set to — the way to change the admin password without Dokploy exec/SSH access. |
| `SITE_URL` | yes | `https://news-sandbox.bigear.uk` | Used for canonical URLs, sitemap, OG, RSS. |
| `SITE_NAME` | yes | `Newsroom (sandbox)` | Brand name is not finalized yet; keep generic. |
| `NOINDEX` | yes | `true` | While `true`: `noindex,nofollow` on every page, `X-Robots-Tag: noindex` on sitemap/feed, `Disallow: /` in robots.txt. Must stay `true` for every sandbox deployment. |
| `ANALYTICS_ENABLED` | no | `false` | Enables the `/api/analytics/scroll` endpoint and page_views tracking. No cookies/consent banner either way. |
| `TAG_NOINDEX_THRESHOLD` | no | `30` | Tags with fewer published articles than this are marked `noindex` (tech-spec.md §8: thin tags need >= 30 articles). No tag detail page exists yet in the frontend (stage 1 scaffold) — this only drives the `Tags.noindex` field today. |
| `INGEST_ENABLED` | no | `false` | Master switch for `npm run worker`'s ingestion jobs (poll/dedup/draft). `false` = worker only runs the pre-existing `recompute-popular` job. See `docs/editorial-pipeline.md`. |
| `INGEST_INCLUDE_CANDIDATES` | no | `false` | Also autopoll `status: candidate` sources from `config/sources.yaml` (normally excluded — needs manual review first). |
| `EVENT_CONFIRMATION_MIN_SOURCES` | no | `2` | Distinct publishers an event cluster needs before a draft article is created. |
| `AI_PROVIDER` | no | `none` | Draft-assist provider. `none` keeps drafts a plain source digest with no AI-written prose. Do not point this at a real provider, and do not set `AI_API_KEY`, without Roman's explicit sign-off (see epic FACT-164). |
| `AI_API_KEY` | no | (unset) | Only a name reserved for the future AI provider; no value is ever committed. |
| `UNSPLASH_ACCESS_KEY` | no | (unset) | Enables the Unsplash image-search provider (`src/lib/images/providers.ts`). Unset = provider disabled, no error. |
| `PEXELS_API_KEY` | no | (unset) | Same, for Pexels. Wikimedia Commons needs no key and is always enabled. |
| `S3_ENDPOINT` | stage/prod | `https://minio.internal:9000` | S3-compatible endpoint for the `media` collection. Unset `S3_BUCKET` = Payload falls back to local-disk upload (dev-only). |
| `S3_REGION` | no | `auto` | Passed through to the S3 client; MinIO/R2 both accept `auto`. |
| `S3_BUCKET` | stage/prod | `newsroom-media` | Bucket for uploaded media. Presence of this var is what turns the S3 plugin on (`src/payload.config.ts`). |
| `S3_ACCESS_KEY_ID` | stage/prod | (random) | Never commit a real value. |
| `S3_SECRET_ACCESS_KEY` | stage/prod | (random) | Never commit a real value. |
| `S3_FORCE_PATH_STYLE` | no | `true` | Required for MinIO; AWS S3 itself also accepts it. |
| `S3_PUBLIC_URL` | stage/prod | `https://news-media-sandbox.bigear.uk` | Base URL used to build public links to uploaded files (`generateFileURL` in `src/payload.config.ts`). |

No secret values are committed anywhere in this repo — only variable names, in `.env.example`.
