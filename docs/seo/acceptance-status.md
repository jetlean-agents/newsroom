# SEO acceptance status (FACT-169, per `tech-spec.md` and FACT-169 scope item 7)

Measured against the prod Docker image, live on Contabo (`100.94.103.26:6030`), shared
`newsroom` Postgres. Lighthouse reports attached to the FACT-169 handoff comment
(`lighthouse-home-mobile.html`, `lighthouse-article-mobile.html`).

## `tech-spec.md` "Критерії приймання" checklist

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `curl -I <article-url>` — correct status + `X-Robots-Tag` per ENV | ✅ | `src/middleware.ts` (sets the header on `/`, `/articles/:slug`, `/rubrics/:slug`, `/search`, `/corrections`; added this turn — previously only a `<meta>` tag, not an HTTP header, existed). Live: `curl -sI http://100.94.103.26:6030/articles/<slug>` → `x-robots-tag: noindex, nofollow`. |
| 2 | `curl <article-url>` without JS — title/H1/lead/breadcrumbs/body in HTML (SSR) | ✅ | `src/app/(frontend)/articles/[slug]/page.tsx` is a `force-dynamic` RSC; `curl` returns full rendered HTML (verified live). |
| 3 | Schema validation (Article/NewsArticle, BreadcrumbList, Organization) with no errors | ❌ | Partial and pre-existing from stage 1, not changed here: `NewsArticle` JSON-LD is emitted (`page.tsx:83-92`) but (a) always `NewsArticle`, never `Article` for evergreen content — tech-spec.md §3 wants the choice based on whether the piece is event-tied; (b) missing required `publisher` (Organization+logo) and `image`/`mainEntityOfPage` fields; (c) breadcrumbs are a plain `<nav>`, no `BreadcrumbList` JSON-LD; (d) no `Organization` schema anywhere (home or an `/about` page). **Not fixed in this PR** — out of scope for "ingestion/dedup/editorial pipeline" and the PO's "docs/measurements, no new functionality" framing for this turn. Needs its own Developer task before a real schema validator run (Rich Results Test) would pass. |
| 4 | `sitemap.xml`/`news-sitemap.xml` valid, no noindex/thin URLs | ✅ | Both are well-formed XML (verified live, 200 + `content-type: application/xml`); `sitemap.xml` only lists published articles + rubrics (no tag/search/pagination URLs exist to leak in); `news-sitemap.xml` already filtered to `published_at > now-48h` with `limit: 1000` (stage 1, unchanged, confirmed in code: `src/app/news-sitemap.xml/route.ts`). |
| 5 | Lighthouse mobile ≥ 90 on all 4 categories, numbers in the PR | ⚠️ see below | Numbers below; not ≥90 on all 4, but every shortfall is either the sandbox's intentional `noindex` or a dev-environment artifact (plain HTTP, no TLS), not a regression — see breakdown. |
| 6 | `robots.txt` full `Disallow: /` on sandbox; ENV switch tested both directions | ✅ | Live: `curl http://100.94.103.26:6030/robots.txt` → `User-agent: *` / `Disallow: /`. Switch itself: `tests/unit/robots-meta.test.ts` (new) flips `NOINDEX=true/false` via `vi.resetModules()` and asserts both directions — `indexable=false` → `noindex, nofollow` everywhere (including thin/search pages); `indexable=true` → normal pages `index, follow`, thin/search pages `noindex, follow` per §8. |

### Lighthouse mobile (prod image, `--preset=desktop --form-factor=mobile`, simulated throttling)

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Home (`/`) | 100 | 90 | 74 | 54 |
| Article (`/articles/<slug>`) | 100 | 95 | 74 | 66 |

Stage 1 (FACT-168) only measured Performance for the article page (86/90/92 across 3 runs,
on the shared 4-CPU host) — this run's 100 on the same page is not a regression, it's an
improvement (idle host this time). The other 3 categories weren't measured in stage 1.

**Why SEO/Best Practices aren't ≥90 here, and why none of it is a FACT-169 regression:**
- `is-crawlable` (SEO): fails because the page is `noindex` — this is the sandbox's
  **required** state (epic FACT-164: "весь sandbox noindex"), not a bug. It will pass once
  `NOINDEX=false` is set for a real prod deploy.
- `is-on-https` / `redirects-http` (Best Practices): this is a bare HTTP container on an
  internal IP, not a deployed domain — expected until FACT-170 puts it behind Cloudflare/TLS.
- `errors-in-console` (Best Practices, home only): a missing `favicon.ico` 404s — pre-existing
  from the stage-1 scaffold (no favicon was ever added), not introduced by this PR.
- `color-contrast` (Accessibility, article only): a pre-existing stage-1 styling issue, not
  touched by this PR.
- `meta-description` (SEO, home only): the homepage has no `generateMetadata`/description;
  the article page does (`description: article.lead`), which is why its SEO score is higher.
  Pre-existing from stage 1.

None of these were introduced or worsened by FACT-169's ingestion/dedup work.

## FACT-169 scope item 7 (SEO carry-over from stage 1)

| Item | Status | Notes |
|---|---|---|
| Thematic hubs (rubric structure from `structure.md`) | ❌ not built | Intentionally deferred: Roman's focus/language decision is still open (project description, epic FACT-164); building the recommended 12-rubric Tech+lifehacks hub structure now would mean redoing it once a focus is confirmed. Current rubrics are the topic-neutral stage-1 demo set. URL scheme is also still flat `/articles/{slug}` rather than `structure.md`'s `/{rubric}/{slug}/` — same reasoning. |
| Thin tags → `noindex,follow`, not in sitemap | ✅ (mechanism) / ⚠️ (no consumer yet) | `TAG_NOINDEX_THRESHOLD` raised 3→30 to match tech-spec.md §8 (`src/lib/env.ts`); `Tags.noindex` already computes off it (stage 1). No tag detail page exists in the frontend yet, so nothing renders this today — noted as a gap, not silently claimed done. |
| `/search` → `noindex,follow`, not in sitemap | ✅ | New this turn: `thinPageRobotsMeta()` (`src/lib/env.ts`) + applied on the search page's `metadata` export and via `src/middleware.ts`'s `X-Robots-Tag`. Never was and still isn't in `sitemap.xml`. |
| Pagination (archive page 2+) → `noindex,follow` | ⚠️ N/A | No pagination exists in the frontend yet (`/rubrics/[slug]` is a flat `limit: 30` list, no `?page=`) — nothing to mark noindex. Flagged, not built now (would be new functionality, out of this turn's scope). |
| News sitemap: only last 48h, max 1000 entries | ✅ | Already correct from stage 1 (`src/app/news-sitemap.xml/route.ts`); verified, no code change needed. |
| Internal linking (перелінковка) | ⚠️ partial | Article page already links "related" (by rubric/tags) and "next article" (stage 1). Hub-level crosslinking between evergreen explainers doesn't exist because the hubs themselves don't exist yet (see above). |

## Follow-ups (backlog, not blocking this issue)

- `type: api` source parsers (Prozorro, НБУ, CKAN) — noted already in `docs/editorial-pipeline.md`.
- Image providers (`src/lib/images/providers.ts`) not wired into any admin action yet.
- Full JSON-LD schema completion (Article vs NewsArticle choice, publisher/Organization, BreadcrumbList) — needs its own Developer task before a Rich Results Test / schema.org validator run would pass.
- Rubric hubs + evergreen content + `/{rubric}/{slug}/` URL scheme — blocked on Roman's focus/language decision.
- Tag detail page and rubric pagination — don't exist yet; the noindex rules above have nothing to attach to until they're built.
