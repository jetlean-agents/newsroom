## Newsroom (sandbox, working name)

Independent news resource scaffold for a Ukrainian-language audience. Brand, domain and
final focus are not chosen yet — see the project description. Stage 1 built the CMS/site
foundation; stage 2 (this repo, current state) adds ingestion, dedup and the
source-to-draft editorial pipeline — see `docs/editorial-pipeline.md`. Everything it
produces still needs a human author + editor before it's ever public; nothing auto-publishes.

### Stack

- Next.js 15 (App Router, SSR/ISR)
- Payload CMS 3 (admin UI, drafts/roles, media) on Postgres
- pg-boss for background jobs (same Postgres, no Redis)
- Postgres full-text search (`unaccent` + `simple` config — see `src/sql/001_search.sql`
  for why a true Ukrainian tsearch config isn't used)

### Collections

`Articles`, `Rubrics`, `Tags`, `Media`, `Pages`, `Users` (admin/editor/author roles),
`AnalyticsEvents` (internal, scroll-depth + "next article" click tracking),
`Sources`, `SourceItems`, `Events` (ingestion/dedup — see `docs/editorial-pipeline.md`).

Publication is a strict state machine: `draft -> in_review -> published -> unpublished`.
Only `editor`/`admin` can publish, and only from `in_review` — see
`src/collections/Articles.ts`. The admin's default Articles list, filtered to
`status: in_review`, is the human-review queue.

### Quick start

See `docs/deploy.md` for the full dev and prod-like run instructions, and `docs/env.md`
for every environment variable. Everything here defaults to `NOINDEX=true` — this is a
sandbox project, not a public site.

### Tests

```bash
npm run test:unit   # vitest — slug stability, tag-noindex threshold, schema shape,
                     # ingest dedup/clustering (canonicalize/hash/simhash + feed fixtures)
npm run test:e2e    # playwright — home, rubric hub, tag, article, search (incl. rubric
                     # filter + highlighting), rubric RSS feeds, sitemaps, 404/410/redirects
```

### Demo data

`npm run seed` creates 3 rubrics, 3 articles (clearly marked "Демо-матеріал" in their own
text, not real news), and 3 page templates (editorial policy / AI disclosure / contacts)
with `[TBD]` placeholders instead of invented real contact details.

### Design (v3)

`design/` holds the v3 portal design (FACT-339): tokens (`design/tokens.css`), HTML prototypes
and PNG mockups for home / rubric / tag / article / search / 404 at 390 and 1440 px, 12 rubric
cover illustrations (`design/covers/*.svg`, fallback when an article has no licensed photo) and a
placeholder logo. Implementation rules for the frontend: `design/README.md`.

FACT-340 implements this design across all six templates (`src/app/(frontend)/`), reusing
`design/tokens.css` directly (`@import` in `globals.css`) and the `design/prototype/prototype.css`
component classes ported into the app. Fonts load via `next/font/google` (Literata, Golos Text),
not `design/fonts`. Shared UI pieces — masthead/rubric nav, time-spine feed, cards, popular list,
pagination, search highlighting — live in `src/components/`.

### Portal functions (FACT-340)

- RSS: `/feed.xml` (site-wide) and `/{rubric}/feed.xml` (per rubric), both shared via
  `src/lib/rss.ts`.
- `/tag/{slug}/` tag pages, with "Схожі теги" (co-occurring tags, `src/lib/relatedTags.ts`).
- "Популярне" (home/rubric/article rail): real `scroll_100` reads in the last 24h, not the
  lifetime `page_views` counter — `src/lib/popular.ts`, falls back to `page_views` when a
  window has no analytics rows yet.
- "Читайте також": same `event` first, then shared tags/rubric — `src/lib/related.ts`.
- "Головне": pinned `Article.featured`; if fewer than 5 are pinned, topped up with the
  `news` articles that have the most sources in the last 48h (broadening to all published
  news if that window is too thin), not just the freshest — `src/lib/mainBlock.ts`
  (`getFeaturedFill`/`rankFeaturedFill`, unit-tested in `tests/unit/main-block.test.ts`).
- "Терміново" badge: editor-only `Article.breaking` + `breaking_until` (defaults to
  `published_at` + 2h if unset) — server-owned like `ai_assisted`, see
  `enforceBreakingOwnership` in `src/collections/Articles.ts`.
- Search: Postgres full-text + rubric filter + period filter, matches highlighted with `<mark>`
  (`src/components/Highlight.tsx`, safe — no `dangerouslySetInnerHTML`).
