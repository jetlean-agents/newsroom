# Ingestion, dedup, editorial pipeline (FACT-169, extended by FACT-236/FACT-337)

## Overview

```
config/sources.yaml (FACT-167 registry)
  -> Sources collection (runtime state: enabled, etag, errors)
  -> ingest-dispatch-polls (every 1m, checks each source's own poll_interval)
    -> ingest-poll-source (fetch + parse + store) -> SourceItems
      -> ingest-cluster-events (every 5m, simhash/title-hash dedup) -> Events
        -> ingest-draft-from-event (every 10m, confirmed events only,
           priority-ranked, DRAFTS_PER_DAY- and rubric-cap-limited,
           AI_SPEND_LIMIT_USD-guarded for AI_PROVIDER=anthropic)
          -> none/mock -> draft Article (digest) -> /review -> author/editor
             rewrite+verify -> in_review -> editor publishes
          -> anthropic (key from Autoreg, FACT-337) -> in_review Article
             (originality_overlap/fact_flags/sensitive set)
               -> AUTO_PUBLISH=true & eligible -> published ("Редакція
                  (автоматично)", AI-disclosed)
               -> otherwise -> /review queue, same as any other in_review
```

`INGEST_ENABLED=false` keeps all of this off by default. With it on and
`AI_PROVIDER` at `none`/`mock` (or `AUTO_PUBLISH=false`), nothing
auto-publishes: every draft still needs a human author and editor before
going public. `AUTO_PUBLISH=true` (sandbox only, FACT-337) is the one
exception — see "Auto-publish gate" below for exactly what it requires.

## Sources (`config/sources.yaml` + `Sources` collection)

`config/sources.yaml` is the editorial source of truth (FACT-167): what each
feed is, its reuse terms, attribution requirements, and whether it's
`verified` (autopoll-eligible) or `candidate` (needs manual review first).

`npm run worker` syncs that file into the `sources` Payload collection on
startup and every 15 minutes. The collection is what the poller actually
reads — an admin can flip `enabled` off there to kill a misbehaving source
without touching the registry file. A source that fails 5 polls in a row
auto-disables itself (dead-letter) and records the error in `last_error`.

`type: rss` and `type: press` sources are both polled by the generic poller
(RSS 2.0 and Atom) — the registry's `press` category is an editorial label
(corporate newsroom vs. official outlet), not a different transport format;
every `press` entry checked is itself an RSS/Atom feed.

`type: api` entries are JSON REST APIs with no common "news item" shape, so
each one gets a source-specific adapter (FACT-195,
`src/lib/ingest/apiSources/`) keyed by `source_key`, dispatched from
`pollSource()` instead of `fetchFeed`/`parseFeed`. Implemented so far:

- **`prozorro_tenders_api`** (`prozorro.ts`) — paginates openprocurement's
  most-recently-modified tenders (`descending=1`), then fetches a bounded
  number of tender details one at a time with a 1s delay between requests
  (the registry's "не чаще 1 запрос/сек" note). One `SourceItem` per tender:
  title, `prozorro.gov.ua/tender/<tenderID>` link, procuring entity + value
  as the summary.
- **`nbu_exchange_api`** (`nbu.ts`) — NBUStatService's daily exchange-rate
  array, folded into a single dated headline item (USD/EUR/PLN) per calendar
  date; the full rate list goes into the summary. The item's `url` is
  date-keyed so re-polling the same day dedupes via the generic
  `source_key::canonical_url` identity hash instead of creating a new row.
- **`data_gov_ua_ckan`** (`ckan.ts`) — CKAN `package_search` keyed by a
  Ukrainian-language query (`зареєстровані транспортні засоби`) rather than a
  fixed dataset id: the MVS vehicle-registrations dataset id wasn't
  confirmed during FACT-167 registry verification (`package_show` by the
  guessed id 404'd), and searching survives the dataset being
  renamed/recreated. Results are filtered to the publishing organization
  (`МВС`) to drop unrelated municipal datasets that match the same keywords;
  deliberately left on CKAN's default relevance sort rather than
  `metadata_modified desc`, which buries the MVS dataset under municipal
  datasets that get re-saved more often.

A `type: api` source without an adapter yet (currently `eurostat_api`) still
syncs into the `Sources` collection and gets dispatched like any other
source, but `pollSource()` reports it `skipped` so the gap is visible in the
worker log rather than silently doing nothing. Unlike `rss`/`press`, API
adapters skip the robots.txt check and ETag/If-Modified-Since headers (the
registry marks all `api` entries `robots_ok: not_applicable` — they're REST
endpoints, not pages) and do their own rate limiting internally. Each
adapter's response-shape mapping is covered by
`tests/unit/ingest-api-sources.test.ts` against fixtures captured from real
API responses (`tests/fixtures/prozorro-tender.json`,
`nbu-exchange.json`, `ckan-package-search.json`).

Each poll: sends `If-None-Match`/`If-Modified-Since` (honors 304), retries
network/5xx errors 3x with exponential backoff, and checks `robots.txt`
before fetching (best-effort substring match on `Disallow`, cached per
origin). Only title/summary/link/dates are stored — never full article
bodies — per each source's `reuse_terms`.

## Dedup (`SourceItems` -> `Events`)

- **Identity**: `hash = sha1(source_key::canonical_url)`, unique — a re-fetch
  of the same item is a no-op, not a duplicate row.
- **Exact duplicate**: `title_hash` (normalized, stopwords dropped, tokens
  sorted) — catches wire-service reposts and near-verbatim headlines.
- **Near duplicate**: 64-bit simhash over normalized title tokens, within a
  72h window, Hamming distance <= `NEAR_DUPLICATE_THRESHOLD` (16) — catches
  different outlets headlining the same story with different wording. This
  is intentionally approximate: a full paraphrase that keeps few shared words
  may not cluster. The pure matching/clustering logic lives in
  `src/lib/ingest/clustering.ts` and is covered by
  `tests/unit/ingest-pipeline.test.ts` (parses real feed fixtures end-to-end
  through clustering, no database needed).
- An event's `independent_confirmation` flips true once it has
  `>= EVENT_CONFIRMATION_MIN_SOURCES` (default 2) **distinct** sources — the
  signal the registry/epic calls "є незалежне підтвердження".

## Editorial pipeline (`Events` -> draft `Article`) — FACT-169, extended by FACT-236

`draftFromEvent()` turns `new` + `independent_confirmation` events into Articles
in `draft` status, highest-priority events first (most sources, then freshest —
`src/lib/review/priority.ts` `prioritizeEvents`), capped at `DRAFTS_PER_DAY` new
drafts per UTC calendar day across the whole run (any provider) so the review
queue can never outgrow what an editor can actually clear. Only facts allowed
in `SourceItems` (title/summary/url/publisher/dates) ever reach the draft —
never a scraped full article body.

**Draft provider** (`src/lib/ai/draftProvider.ts`, `AI_PROVIDER` env):

- `none` (sandbox default) — no AI call at all. The draft is a plain
  facts-with-citations scaffold labeled "факти для самостійного
  переписування (не копіювати)" — never prose the author could accidentally
  ship unedited. `ai_assisted` stays `false`, originality/fact-check checks
  don't run (there's no AI prose to check).
- `mock` — deterministic stand-in for tests/e2e. Builds real UA paragraphs +
  lead + "Що відомо"/"Що невідомо" purely by templating the supplied facts —
  never invents a detail. `ai_assisted: true`.
- `anthropic` — the real provider (Roman's 09.11 v3 decision: Claude, key
  from Autoreg's secrets vault, $10/week budget, FACT-337). Calls the
  Messages API with a system prompt that forbids inventing quotes/people/
  numbers/dates, requires every claim to cite a supplied fact, and also asks
  the same call to judge sensitive topics (see "Auto-publish gate" below);
  expects strict JSON back. The key comes from `resolveAnthropicKey()`
  (`src/lib/autoreg/client.ts`) — Autoreg first, `AI_API_KEY` only as a
  fallback — and generateDraft throws a clear per-event error (skipped, not
  fatal to the job) if neither source has one.

### Autoreg integration (FACT-337 scope item 1)

Contract: `docs/integration-secrets.md` in `jetlean-agents/autoreg`; Node/TS
client here is `src/lib/autoreg/client.ts` (Python reference:
`avto-traffic` PR #68 / `worker/src/avto_worker/autoreg.py`).

- **Key fetch**: `GET /api/v1/secrets/<AUTOREG_SECRET_ID>/?site=<AUTOREG_SITE_SLUG>`
  (or the list form if `AUTOREG_SECRET_ID` is unset), cached in memory only
  for `AUTOREG_KEY_TTL_SECONDS` — never written to disk or logged. 401/403
  (bad token), 404 (key not bound/inactive), and network/5xx/timeout all
  degrade the same way: fall back to `AI_API_KEY` on a *first* resolution,
  or keep the last working Autoreg key if a later refresh fails mid-run.
  Never blocks the worker's own startup waiting on Autoreg.
- **Usage reporting**: after every successful Anthropic call,
  `POST /api/v1/usage/` with `secret_id`, `requests`, `input_tokens`,
  `output_tokens`, `cost_usd`, `model` — best-effort, fire-and-forget; a
  failure here is logged and dropped, never fails the draft itself. Only
  sent when the key actually came from Autoreg (`source: "autoreg"`) — the
  `env_fallback` case has no Autoreg-side key id to attribute spend to.
- **Site lifecycle events — gap, not implemented**: the issue brief also
  asks for an Autoreg event per collector run / published / sent-to-review /
  error, "если в контракте есть такой эндпоинт". `docs/integration-secrets.md`
  (FACT-264) only documents `/api/v1/secrets/`, `/api/v1/usage/`, and
  `/api/v1/secrets/<id>/spend/` — there's no site-events endpoint today.
  Flagged here rather than invented.

### Cost and the local spend guard (FACT-337 scope item 2)

`src/lib/ai/pricing.ts` prices Haiku 5.5 (the `AI_MODEL` default) at
$0.10/$0.50 per million input/output tokens — a realistic ~800-input/
~700-output draft call costs roughly **$0.0004**, well under the ~$0.04/
article the issue brief's $10-week / 30-drafts-day budget implies (see
`tests/unit/ai-pricing.test.ts`; re-verify against
https://platform.claude.com/docs/en/about-claude/pricing before trusting
this for a real budget decision — override via `AI_PRICE_INPUT_PER_MTOK`/
`AI_PRICE_OUTPUT_PER_MTOK` if it's drifted).

Each `anthropic` draft's actual cost is stored on `Article.ai_cost_usd`.
`src/lib/ai/spendGuard.ts` sums that column over the `AI_SPEND_PERIOD`
rolling window; once the total reaches `AI_SPEND_LIMIT_USD`, `draftFromEvent()`
stops making new Anthropic calls for the rest of the window (`skippedSpendLimit`
in its return value) — the site and every other `AI_PROVIDER` keep working.
This is independent of whatever limit Autoreg itself enforces on the key
(`GET /api/v1/secrets/<id>/spend/`, not currently checked here, see
`AnthropicDraftProvider` TODO-free note in `src/lib/autoreg/client.ts
getSpendPct()` which is wired for a future remote check) — a same-process
guard that works even if Autoreg is unreachable or misconfigured.

### Auto-publish gate (FACT-337 scope item 4)

**Routing**: an `anthropic`-pipeline draft (the model writes a complete,
publish-ready article — not a digest like `none`/`mock`) is created directly
in `in_review`, skipping `draft`, since there's no separate "author writes it
from scratch" step. `none`/`mock` drafts are unaffected and still start at
`draft`.

**Eligibility** for immediate self-publish, checked in `draftFromEvent.ts`
right after creation, requires ALL of:

- `AUTO_PUBLISH=true` (sandbox only — see `docs/env.md`);
- not `originality_blocked` (anti-copypaste, unchanged from FACT-236);
- `fact_flags` is empty (no unsupported number/date/name found);
- not sensitive — **neither** signal alone decides this:
  - the dictionary classifier (`src/lib/ai/sensitivity.ts`) on the drafted
    text: war/safety, politics, medicine, accusations-against-people,
    deaths/disasters (Ukrainian keyword lists, pure/no network, also what
    `Articles.ts` recomputes into `Article.sensitive`/`sensitive_categories`
    on every save, server-owned like originality/fact_flags above);
  - **and** the same Anthropic call's own `sensitive`/`sensitiveCategories`
    judgment from its JSON response (`draftProvider.ts`'s
    `ANTHROPIC_SYSTEM_PROMPT`) — catches phrasing the keyword list can't.
  - Either signal alone is enough to route to human review; only when BOTH
    say "not sensitive" does the gate proceed.

A draft that fails any of the above simply stays `in_review` for a human —
exactly the issue brief's "чувствительные темы... идут в /review", not a
separate queue.

**Publishing without a human session**: the eligible draft is moved
`in_review -> published` via a Local API `payload.update()` call carrying
`context: { autoPublish: true, autoEditorId }` — a flag only reachable from
this job's own Local API call, never from the REST/GraphQL API, so it can
never be a role-check bypass an outside caller can trigger
(`src/collections/Articles.ts assertValidTransition`). The
`originality_blocked` check is **not** bypassed by this flag — the job's own
eligibility check and the hook's independent recompute must both agree.
Both `author` and `editor` are set to a dedicated, real, disclosed account —
**"Редакція (автоматично)"** (`AUTO_EDITOR_EMAIL` in
`src/lib/ingest/systemAuthor.ts`) — distinct from the ingest placeholder
(`SYSTEM_AUTHOR_EMAIL`) that un-auto-published drafts still carry until a
human claims them. `ai_disclosure` for an `anthropic`-pipeline draft reads
"Цей матеріал повністю згенеровано AI (Claude)..." rather than the
none/mock "...перевірений редактором перед публікацією" line, since an
auto-published article by definition had no human review before going live.

**Rhythm / rubric spread** (scope item 5): `DRAFT_FROM_EVENT` already runs
every 10 minutes (`src/jobs/worker.ts`); reaching the epic's "≥30
published/day" target needs `DRAFTS_PER_DAY` raised to >= 40 via env (see
`docs/env.md`) once this is deployed with `AUTO_PUBLISH=true` — left as an
env knob, not a code default, since it also governs the none/mock
human-review flow. No single rubric can take more than ~40% of that daily
budget (`rubricDailyCap()` in `draftFromEvent.ts`): once a rubric hits its
share, its events stay `new` for a later run (or the next day's reset)
instead of drafting into an already-full rubric — this doesn't consume the
`DRAFTS_PER_DAY` budget, only the attempt. One draft per event is already
guaranteed by the existing dedup pipeline (an event flips to `drafted` and is
excluded from the `status: new` query), so "без повторов одного события"
needs no extra code here.

**Anti-copypaste** (`src/lib/ai/originality.ts` + `recomputeOriginality()` in
`src/collections/Articles.ts`): for `ai_assisted` articles, every save
re-fetches the event's SourceItems and recomputes `originality_overlap`
(word-shingle, 5-word, overlap against the single most-copied-from source —
`maxOverlap()`) and `fact_flags` from the *current* title/lead/body — not
once at draft time. This is deliberate and load-bearing, not just an
optimization: it's what lets a rewrite actually lift the block (originally it
was computed once in `draftFromEvent()` and then frozen forever, so no amount
of editing could get a flagged draft published — fixed in PO review). These
three fields are also **entirely server-owned**: `recomputeOriginality()`
overwrites them unconditionally and ignores whatever the request body sent
for them, so a client can't PATCH `originality_blocked: false` to skip the
check (`tests/unit/articles-transition-errors.test.ts` covers this directly).
Above `ORIGINALITY_MAX_OVERLAP` (default 0.5), `originality_blocked: true` is
set and `Articles`' publish-transition guard rejects `in_review -> published`
with a 400 until the draft is rewritten enough to drop back under the
threshold — the one AI-pipeline check that actually blocks publication.
Non-`ai_assisted` articles always get `originality_overlap: null`,
`originality_blocked: false` — the check never runs for them regardless of
what's in the request.

**Fact-check assist** (`src/lib/ai/factCheck.ts`): for `ai_assisted` articles,
`factCheckFlags()` flags numbers, dates and capitalized-name sequences in the
current draft text that don't appear in any source text — a "перевірити"
pointer for the reviewing editor, stored as `Article.fact_flags[]` (same
recompute-on-every-save, server-owned treatment as the overlap check above).
Heuristic, non-blocking: it never stops a publish by itself.

- `sources[]` is populated from every clustered item (title/url/publisher/accessed_at).
- `ai_assisted`/`ai_disclosure` are set together: `ai_disclosure` carries the
  reader-facing editorial-policy line whenever a draft came from `mock`/
  `anthropic`, and renders on the article page right under the headline
  (`src/app/(frontend)/[rubric]/[slug]/page.tsx`).
- `author` is the system ingest account (`src/lib/ingest/systemAuthor.ts`)
  until the actual `in_review -> published` transition: `Articles.ts` then
  sets `editor` to the publishing user and, if `author` is still the system
  placeholder, replaces it with that same user — AC item 7's "author = real
  editor who verified it" is enforced at publish time, not left as a
  convention an editor has to remember to apply by hand.
- The event flips to `drafted` and links to the created article.

From there the pipeline is the stage-1 Articles state machine: an author
claims the draft, writes/verifies the text, moves it to `in_review`; only
editor/admin can move `in_review` -> `published` (and only when not
`originality_blocked`). Publishing is never automatic.

**Duplicate warning on publish**: if an article's `event` already has a
different `published` article, publishing sets `duplicate_warning` (visible,
non-blocking — it's a column in the admin list, not a hard stop) rather than
silently allowing two public articles for the same event.

## Review queue (`/review`) — FACT-236 scope item 5

A dedicated screen for editor/admin (redirects anyone else to `/admin` to log
in) at `/review` (`src/app/(frontend)/review/`): every `in_review` article,
ranked by `prioritizeReviewQueue()` (most sources, then freshest event, then
rubric order — same tie-break order as `prioritizeEvents`), shown one at a
time with its sources side by side, originality overlap %, and fact-check
flags all on one screen — no tab-switching between the article and its
sources the way the generic Payload admin edit view requires.

Actions, each a single `PATCH /api/articles/:id` with the normal
Articles state-machine rules (so an author-role session still can't publish
from here): **Опублікувати** (1, disabled when `originality_blocked`) ->
`published`; **Повернути** (2) -> back to `draft` for the author to revise;
**Відхилити** (3) -> `unpublished` (never published, not a retraction of a
live article — reuses the existing status rather than adding a new one).
`←`/`→` move between queue items without acting. Target: under 3 minutes per
material (issue AC) — one screen, one keypress per decision, no page reloads.

## Images

`src/lib/images/providers.ts` is a provider interface for Unsplash/Pexels/
Wikimedia Commons image search (FACT-169 scope item 5). Unsplash/Pexels are
disabled with no error unless `UNSPLASH_ACCESS_KEY`/`PEXELS_API_KEY` is set
(no paid key is wired up anywhere); Wikimedia Commons needs no key. This is a
library, not yet wired into an admin action — the `Media` collection's rights
fields (`credit`, `author`, `license`, `license_url`, `source_url`,
`ai_generated`) from stage 1 are what actually get used today via manual
upload. Any AI-generated illustration must have `ai_generated: true` and a
visible caption — never a pseudo-photo of a real event/person.

## Corrections / unpublish (stage 1, unchanged)

Already implemented and still the active path: `Articles.corrections[]`,
the `/corrections` page, and `src/middleware.ts` turning an `unpublished`
article into a true `410` (distinct from a 404 for a slug that never
existed).

## Admin screens

Payload doesn't need bespoke views for simple status queues — the same
deep-link-filter pattern FACT-168 used for the articles review queue:

- **Events queue**: `/admin/collections/events?where[status][equals]=new`
- **Fast review queue** (FACT-236, see above): `/review` — one draft at a time, sources/overlap/flags alongside, hotkeys.
- **Review queue, generic list view** (stage 1, still works): `/admin/collections/articles?where[status][equals]=in_review`
- **Source status** (FACT-345): `/admin/collections/sources` — sort by `consecutive_errors` to find a dead-lettered source; `last_http_status`/`last_fetched`/`last_stored`/`items_24h`/`items_7d` columns show the last poll's outcome and the 24h/7d item counts per source, written by `pollSource.ts` on every poll.

## Ingestion health without container logs (FACT-357)

Dokploy sandbox gives agents no `docker logs`/`exec` access, so a crashing
worker handler is otherwise invisible. `GET /api/ingest/status` (admin-JWT
only — `Authorization: JWT <token>` from `/api/users/login`, or the Payload
admin session cookie) returns:

- `sources`: total/verified-enabled/polled-in-last-24h/with-errors counts.
- `pgboss`: per-queue job counts by state over the last 24h (`job` + already
  `archive`d rows), `failedLast24h`, and `lastDispatchAt` (last
  `ingest-dispatch-polls` tick — a stale value means the worker itself isn't
  running, not just one source failing).

See `src/jobs/ingest/ingestStatus.ts`. Any handler-level crash in
`ingest-poll-source` (bad job payload, a bug before `pollSource` even runs)
also now writes `sources.last_error`/`consecutive_errors` itself
(`handlePollSourceJob` in `src/jobs/ingest/pollSource.ts`), instead of only
existing in pg-boss's own `retry`/`failed` job state.

## Running the worker locally

```
DATABASE_URL=... PAYLOAD_SECRET=... INGEST_ENABLED=true npm run worker
```

`INGEST_ENABLED=false` (the default) only runs the pre-existing
`recompute-popular` job — safe to run in any environment without touching
outbound network calls to third-party feeds.
