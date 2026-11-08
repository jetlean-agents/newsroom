# SEO acceptance status (FACT-194, per `tech-spec.md` and the FACT-169 gaps it left open)

Supersedes the FACT-169 version of this doc for every row touched below — rubrics, URL
scheme, JSON-LD, hubs, pagination and tags all moved from "deferred/gap" to implemented
in this turn, following Roman's 08.11 focus decision (epic FACT-164: general UA news, 12
rubrics). Measured locally (`npm run build && npx next start --hostname 100.94.103.26
--port 6031`, against the shared dev Postgres, `NOINDEX=true`) — this environment has no
Lighthouse/headless-Chromium system libraries available (no sudo to install
`libatk`/`libcups`/etc., see "Known gaps" below), so Lighthouse numbers and Playwright
screenshots are **not** re-measured here; everything else is curl/DOM-verified live.

## `tech-spec.md` "Критерії приймання" checklist

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `curl -I <article-url>` — correct status + `X-Robots-Tag` per ENV | ✅ | `src/middleware.ts`, rewritten for the new URL shape + `trailingSlash: true`: broad matcher (`/((?!api\|_next/).*)`), reserved-segment check (`RESERVED_TOP_LEVEL_SEGMENTS`) to tell a `/{rubric}/{slug}` article URL from a hub/tag/search path. Live: `curl -sI http://…/ekonomika/<slug>/` → `x-robots-tag: noindex, nofollow`. |
| 2 | `curl <article-url>` without JS — title/H1/lead/breadcrumbs/body in HTML (SSR) | ✅ | `src/app/(frontend)/[rubric]/[slug]/page.tsx` stays a `force-dynamic` RSC; `curl` returns full rendered HTML incl. the new `<nav class="breadcrumbs">` and both JSON-LD blocks (verified live). |
| 3 | Schema validation (Article/NewsArticle, BreadcrumbList, Organization) with no errors | ✅ (structurally) | `src/lib/jsonld.ts`: `articleJsonLd()` picks `NewsArticle`/`Article` off `Article.content_type` (new field), always includes `publisher` (Organization + real `/logo.png`), `image`, `mainEntityOfPage`, `inLanguage: "uk"`. `breadcrumbListJsonLd()` + `src/components/Breadcrumbs.tsx` render a real `BreadcrumbList` (Головна → Рубрика → Стаття) on every article/hub/tag/pagination page. `organizationJsonLd()` on the home page. Verified live (both article JSON-LD blocks, see below) — not run through the actual Rich Results Test / validator.schema.org web tool from this sandboxed session (no outbound browser), so "no errors" is structural (all spec-required fields present with real values), not a live validator pass. |
| 4 | `sitemap.xml`/`news-sitemap.xml` valid, no noindex/thin URLs | ✅ | Both rewritten for `/{rubric}/{slug}/` URLs (`src/app/sitemap.xml/route.ts`, `src/app/news-sitemap.xml/route.ts`); still only published articles + rubric hubs (no tag/search/pagination-page-2+ URLs — those were never added here either). Verified live, well-formed XML. |
| 5 | Lighthouse mobile ≥ 90 on all 4 categories, numbers in the PR | ⚠️ not re-measured | No headless-Chromium system libs in this sandboxed dev session (see header) — not run this turn. FACT-169's prior numbers (Home 100/90/74/54, Article 100/95/74/66) are stale now the templates changed; DevOps/QA should re-run `npx lighthouse <sandbox-url> --preset=mobile` after the Dokploy deploy and post numbers to the issue. The favicon 404 and `color-contrast` findings that pulled Best Practices/Accessibility down last time are fixed (see below) — expect those two sub-items to improve, not a full re-audit. |
| 6 | `robots.txt` full `Disallow: /` on sandbox; ENV switch tested both directions | ✅ unchanged | Still correct; not touched this turn beyond the thin-page set growing (tag + pagination page 2+ now exist and return the thin-page variant, `tests/unit/robots-meta.test.ts` unchanged, still passes). |

## This issue's scope (FACT-194)

| Item | Status | Notes |
|---|---|---|
| 12 rubrics (Події, Політика, Війна і безпека, Економіка, Гроші, Світ, Суспільство, Технології, Здоров'я, Спорт, Культура, Регіони), stable latin slugs | ✅ | `src/lib/rubricsConfig.ts` (single source of truth, consumed by `src/seed/index.ts`, home/hub nav, middleware's reserved-segment check). Demo rubrics replaced/repaired in place (seed updates an existing rubric's slug if it drifted, not just create-if-missing). `tests/unit/rubrics-config.test.ts` locks the 12 slugs. |
| URL scheme `/{rubric}/{slug}/`, old `/articles/{slug}` + `/rubrics/{slug}` → 301 | ✅ | `src/app/(frontend)/[rubric]/[slug]/page.tsx` (article), `src/app/(frontend)/[rubric]/page.tsx` (hub); `src/app/(frontend)/articles/[slug]/route.ts` and `.../rubrics/[slug]/route.ts` are now 301 redirects (looked up with `overrideAccess: true` so an unpublished article still redirects — the new route's own 410 check applies after). `trailingSlash: true` added to `next.config.mjs` so the canonical URL doesn't redirect away from itself. Verified live end-to-end: `/articles/{slug}` → 308 (Next's own trailing-slash normalization) → 301 (the redirect route) → final page; same chain for `/rubrics/{slug}`. |
| Hub: feed + «Головне» (manual pin) + evergreen block + pagination | ✅ | `Article.featured` (new field) drives «Головне» on both the hub and the home page. `src/app/(frontend)/[rubric]/page/[page]/page.tsx`: page 2+ is self-canonical + `noindex,follow` (`thinPageRobotsMeta()`), page 1 redirects to the hub, an out-of-range page 404s. Shared `getRubric`/`PAGE_SIZE` live in `src/lib/rubricHub.ts` (a `page.tsx` can only export the Next.js page contract, so this couldn't stay inline). |
| Tags: tag detail page, `< TAG_NOINDEX_THRESHOLD` → noindex,follow | ✅ | `src/app/(frontend)/tag/[slug]/page.tsx` — didn't exist before this turn (FACT-169 flagged it as a gap). Uses the existing `Tags.noindex`/`articleCount` fields (stage 1), unchanged threshold logic. |
| Internal linking: breadcrumbs, «Ще в рубриці», «Наступна стаття» | ✅ | `src/components/Breadcrumbs.tsx` (visual nav + JSON-LD) replaces the old plain `<nav class="meta">`. "Пов'язані матеріали" renamed to "Ще в рубриці" per this issue's wording; "Наступна стаття" logic unchanged, just repointed at the new URL shape. |
| JSON-LD: Article vs NewsArticle, publisher, image, mainEntityOfPage, BreadcrumbList, Organization | ✅ | `src/lib/jsonld.ts`, `tests/unit/jsonld.test.ts`. `Article.content_type` (new `news`/`evergreen` select field) drives the `@type` choice — previously always `NewsArticle` regardless of content. |
| Home: «Головне», «Останні новини» (with time), per-rubric blocks, «Популярне» (real `page_views`) | ✅ | `src/app/(frontend)/page.tsx` rewritten; rubric nav/blocks filtered to the 12 canonical slugs (`RUBRIC_SLUGS`), excluding the ingestion pipeline's `bez-rubryky` fallback bucket (`src/jobs/ingest/draftFromEvent.ts`, pre-existing, unrelated to this issue — not promoted to nav, still reachable by direct URL like any other rubric hub). |
| `lang="uk"`, `og:locale: uk_UA`, `inLanguage: "uk"` | ✅ | `lang="uk"` was already set (stage 1, `src/app/(frontend)/layout.tsx`); `og:locale`/`inLanguage` added this turn (layout default + per-page `openGraph.locale`, `articleJsonLd()`). Hreflang intentionally not added (epic FACT-164 decision 08.11: UA-only). |
| `favicon.ico` 404 | ✅ fixed | `public/favicon.ico` (real 32×32 ICO, generated from a simple placeholder mark — brand not finalized yet, same "clearly a placeholder, not a fake finished brand" reasoning as the rest of the sandbox). `public/logo.png` (JSON-LD publisher logo) and `public/og-default.png` (OG/Twitter image fallback) added alongside it. |
| `color-contrast` (Lighthouse, article page) | ✅ fixed | `.meta`/`.site-footer`/breadcrumbs text darkened from `#777`/`#999` to `#5c5c5c`/`#595959` (`src/app/(frontend)/globals.css`) — both now pass the ~4.5:1 small-text contrast ratio against the page's `#fff`/`#fafafa` backgrounds; not re-measured by Lighthouse this turn (see header). |

## Known gaps / follow-ups (not blocking this issue)

- **Lighthouse mobile numbers and mobile/desktop screenshots not re-captured this turn** —
  this sandboxed dev session has no headless-Chromium system libraries (`libatk-1.0`,
  `libcups`, `libatspi`, `libgbm`, `libcairo`, `libpango`, `libasound`, … all missing, and
  there's no `sudo` to install them), so neither `npx lighthouse` nor Playwright's bundled
  Chromium can launch here. Everything in the tables above was instead verified with
  `curl`/raw HTML inspection against a locally built-and-started production server. The
  Dokploy sandbox deploy (FACT-170's pipeline, unaffected by this change) does have a
  normal container environment — DevOps/QA should run the Lighthouse audit and grab the
  two mobile screenshots there once this PR is live, the way FACT-169's numbers were
  originally captured.
- **Schema validated structurally, not through the actual Rich Results Test /
  validator.schema.org web tool** — same no-outbound-browser constraint. All tech-spec.md
  §3 required fields are present with real (non-fabricated) values; a human/QA pass
  through the actual validator on the live sandbox URL is the real acceptance gate.
- `tests/e2e/seo.spec.ts` was updated for the new URL scheme and JSON-LD shape (canonical
  regex, breadcrumb selector, `Article`/`NewsArticle` + `publisher`/`image`/
  `mainEntityOfPage` assertions, new 301/404/410 redirect-chain tests) but not *run* this
  turn — same missing-Chromium-libs blocker as above; it already assumes a running
  sandbox/dev server (`E2E_BASE_URL`), so CI or a later run against Dokploy is the real
  check.
- `bez-rubryky` (ingestion pipeline fallback rubric, `src/jobs/ingest/draftFromEvent.ts`)
  is intentionally excluded from nav/home but still has a working hub URL like any other
  rubric — editors are expected to move a draft into a real rubric before publishing;
  nothing in this issue enforces that.
