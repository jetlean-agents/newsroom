# Ingestion, dedup, editorial pipeline (FACT-169, extended by FACT-236)

## Overview

```
config/sources.yaml (FACT-167 registry)
  -> Sources collection (runtime state: enabled, etag, errors)
  -> ingest-dispatch-polls (every 1m, checks each source's own poll_interval)
    -> ingest-poll-source (fetch + parse + store) -> SourceItems
      -> ingest-cluster-events (every 5m, simhash/title-hash dedup) -> Events
        -> ingest-draft-from-event (every 10m, confirmed events only,
           priority-ranked, DRAFTS_PER_DAY-capped) -> AI_PROVIDER draft
             -> draft Article (originality_overlap/fact_flags set)
               -> /review queue -> author/editor rewrite+verify -> in_review
                 -> editor publishes (blocked if originality_blocked)
```

All of this is **off by default** (`INGEST_ENABLED=false`). Nothing it produces
auto-publishes: every draft lands in the `draft` status and needs a human
author and editor before it is ever public.

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
- `anthropic` — the real provider (Roman's 08.11 decision: Claude, $30/mo
  budget). Calls the Messages API with a system prompt that forbids inventing
  quotes/people/numbers/dates and requires every claim to cite a supplied
  fact; expects strict JSON back. Only selected via `AI_PROVIDER=anthropic`,
  and only once `AI_API_KEY` is set from Autoreg's secrets store (FACT-262) —
  until then this throws a clear per-event error (skipped, not fatal to the
  job) rather than silently calling out with no key.

**Anti-copypaste** (`src/lib/ai/originality.ts`): for AI-generated drafts
(`mock`/`anthropic`), `maxOverlap()` computes the word-shingle (5-word)
overlap between the full draft text and each source's title+summary — the
overlap against the single most-copied-from source, not an averaged-down
figure. Stored as `Article.originality_overlap` (visible in the admin list).
Above `ORIGINALITY_MAX_OVERLAP` (default 0.5), `originality_blocked: true` is
set and `Articles`' publish-transition guard (`src/collections/Articles.ts`)
rejects `in_review -> published` with a 400 until the draft is rewritten —
the one AI-pipeline check that actually blocks publication.

**Fact-check assist** (`src/lib/ai/factCheck.ts`): for AI-generated drafts,
`factCheckFlags()` flags numbers, dates and capitalized-name sequences in the
draft that don't appear in any source text — a "перевірити" pointer for the
reviewing editor, stored as `Article.fact_flags[]`. Heuristic, non-blocking:
it never stops a publish by itself.

- `sources[]` is populated from every clustered item (title/url/publisher/accessed_at).
- `ai_assisted`/`ai_disclosure` are set together: `ai_disclosure` carries the
  reader-facing editorial-policy line whenever a draft came from `mock`/
  `anthropic`. `author` stays the system ingest account until a real editor
  claims the draft and rewrites/verifies it — that hand-off, not this job, is
  what AC item 7's "author = real editor" means in practice.
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
- **Source status**: `/admin/collections/sources` (sort by `consecutive_errors` to find a dead-lettered source)

## Running the worker locally

```
DATABASE_URL=... PAYLOAD_SECRET=... INGEST_ENABLED=true npm run worker
```

`INGEST_ENABLED=false` (the default) only runs the pre-existing
`recompute-popular` job — safe to run in any environment without touching
outbound network calls to third-party feeds.
