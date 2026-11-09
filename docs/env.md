# Environment variables

| Name | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/newsroom` | Postgres connection string. |
| `PAYLOAD_SECRET` | yes | (random 32+ char string) | Never commit a real value. |
| `SEED_ADMIN_EMAIL` | prod | `admin@newsroom.test` | Admin account `npm run seed` creates/rotates. Required in production (`NODE_ENV=production`, always true in the Docker image) — seed throws instead of falling back to a guessable default. |
| `SEED_ADMIN_PASSWORD` | prod | (random) | Never commit a real value. Re-running seed (e.g. the compose `seed` service on a redeploy) rotates the existing admin account to whatever this is currently set to — the way to change the admin password without Dokploy exec/SSH access. |
| `SEED_DEMO_PASSWORD` | prod | (random) | Password for the demo `editor@newsroom.test`/`author@newsroom.test` accounts `npm run seed` creates/rotates. Required in production for the same reason as `SEED_ADMIN_PASSWORD` — `editor` can publish/unpublish articles and edit rubrics/tags/pages, so a hardcoded demo password there is the same risk as on `admin`. Never commit a real value; a redeploy rotates both accounts to this. |
| `SITE_URL` | yes | `https://news-sandbox.bigear.uk` | Used for canonical URLs, sitemap, OG, RSS. |
| `SITE_NAME` | yes | `Newsroom (sandbox)` | Brand name is not finalized yet; keep generic. |
| `NOINDEX` | yes | `true` | While `true`: `noindex,nofollow` on every page, `X-Robots-Tag: noindex` on sitemap/feed, `Disallow: /` in robots.txt. Must stay `true` for every sandbox deployment. |
| `ANALYTICS_ENABLED` | no | `false` | Enables the `/api/analytics/scroll` endpoint and page_views tracking. No cookies/consent banner either way. |
| `TAG_NOINDEX_THRESHOLD` | no | `30` | Tags with fewer published articles than this are marked `noindex` (tech-spec.md §8: thin tags need >= 30 articles). No tag detail page exists yet in the frontend (stage 1 scaffold) — this only drives the `Tags.noindex` field today. |
| `INGEST_ENABLED` | no | `false` | Master switch for `npm run worker`'s ingestion jobs (poll/dedup/draft). `false` = worker only runs the pre-existing `recompute-popular` job. See `docs/editorial-pipeline.md`. |
| `INGEST_INCLUDE_CANDIDATES` | no | `false` | Also autopoll `status: candidate` sources from `config/sources.yaml` (normally excluded — needs manual review first). |
| `EVENT_CONFIRMATION_MIN_SOURCES` | no | `2` | Distinct publishers an event cluster needs before a draft article is created. |
| `AI_PROVIDER` | no | `none` | Draft-assist provider: `none` (plain source digest, no AI prose), `mock` (deterministic stand-in, used in tests/e2e, no key needed), or `anthropic` (real provider — Roman's 09.11 v3 decision: Claude, key from Autoreg's secrets vault, FACT-337). See `docs/editorial-pipeline.md`. |
| `AI_MODEL` | no | `claude-haiku-5-5` | Model name passed to the `anthropic` provider — defaults to Haiku 5.5, the cheapest current Claude model (budget: $10/week via Autoreg secret id 3). Unused by `none`/`mock`. |
| `AI_API_KEY` | no | (unset) | **Fallback only.** The `anthropic` provider fetches its key from Autoreg first (`AUTOREG_*` below); this is only read when Autoreg is unconfigured, unreachable, or has no key for this site. No value is ever committed; `AnthropicDraftProvider` throws a clear error (not a silent call-out) if neither source has a key. |
| `AUTOREG_API_URL` | no | (unset) | Autoreg base URL, e.g. `https://autoreg.bigear.uk`. Unset = Autoreg not wired up, `anthropic` provider falls back straight to `AI_API_KEY`. Contract: `docs/integration-secrets.md` in `jetlean-agents/autoreg`. |
| `AUTOREG_SERVICE_TOKEN` | no | (unset) | Service token scoped `secrets:read usage:write`, granted access to `AUTOREG_SITE_SLUG` only (`manage.py create_service_token ... --sites <slug>` on the Autoreg side). Never logged, never committed. |
| `AUTOREG_SITE_SLUG` | no | (unset) | This site's slug in Autoreg (`registry.Site.slug`), e.g. `news`. |
| `AUTOREG_SECRET_ID` | no | (unset) | Secret id to fetch, e.g. `3` ("Новини — Claude (sandbox)", $10/week — Roman's 09.11 decision). Unset = fetch the first active `anthropic`-provider key bound to the site instead. |
| `AUTOREG_KEY_TTL_SECONDS` | no | `3600` | How long the Autoreg-fetched key is cached in memory (never on disk) before being re-fetched. A vault lookup, not a hot path. |
| `AI_SPEND_LIMIT_USD` | no | `10` | Local, same-process spend guard — independent of whatever limit Autoreg enforces on the key itself. Clamped to <= 10 in code regardless of what's set (Roman's 09.11 budget decision). When the rolling-window spend (summed from `Article.ai_cost_usd`) reaches this, the `anthropic` pipeline stops generating for the rest of the window; the site itself keeps working. |
| `AI_SPEND_PERIOD` | no | `week` | Rolling window `AI_SPEND_LIMIT_USD` applies over: `day`, `week`, or `month`. |
| `AUTO_PUBLISH` | no | `false` | Sandbox-only auto-publish gate (FACT-337): when `true`, an `anthropic`-pipeline draft with no `originality_blocked`, no `fact_flags`, and no sensitive-topic match (war/safety, politics, medicine, accusations, deaths/disasters — `src/lib/ai/sensitivity.ts`) publishes itself under the byline "Редакція (автоматично)" with AI-disclosure. Everything else still needs a human in `/review`. **Must stay `false` in prod** — Roman's 09.11 decision: sandbox autopublish is allowed, prod needs a separate sign-off. |
| `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` | no | (unset) | Override the built-in Haiku 5.5 pricing table in `src/lib/ai/pricing.ts` ($/million tokens) if Anthropic's price changes — both must be set together or neither is used. |
| `ORIGINALITY_MAX_OVERLAP` | no | `0.5` | Anti-copypaste threshold (0-1): a draft whose word-shingle overlap with its most-copied-from source exceeds this is `originality_blocked` and can't be published until rewritten (`src/lib/ai/originality.ts`). Only applies to AI-generated drafts (`mock`/`anthropic`); the `none` provider's plain digest is never AI prose, so it's exempt. |
| `DRAFTS_PER_DAY` | no | `20` | Hard cap on new drafts `draftFromEvent()` creates per UTC calendar day (any provider), so the review queue can't outgrow the editor(s) actually clearing it. The epic's "≥30 published/day" acceptance target needs this raised to >= 40 (issue brief) once AUTO_PUBLISH is on — set via env, not a code default, since it also governs the none/mock human-review flow. |
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
