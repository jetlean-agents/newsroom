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
npm run test:e2e    # playwright — homepage + article page smoke test
```

### Demo data

`npm run seed` creates 3 rubrics, 3 articles (clearly marked "Демо-матеріал" in their own
text, not real news), and 3 page templates (editorial policy / AI disclosure / contacts)
with `[TBD]` placeholders instead of invented real contact details.
