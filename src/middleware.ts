import { NextResponse, type NextRequest } from 'next/server'
import { robotsMeta, thinPageRobotsMeta, INTERNAL_BASE_URL } from '@/lib/env'
import { RESERVED_TOP_LEVEL_SEGMENTS } from '@/lib/rubricsConfig'
import { articlePath, rubricPath } from '@/lib/urls'

export const config = {
  // Everything except /api and Next's own internals — content pages + /admin (sandbox
  // must stay fully noindex, FACT-170 review) need the X-Robots-Tag header, and the
  // rubric/article URL shape (`/{rubric}/{slug}/`, with `trailingSlash: true` in
  // next.config.mjs) is too dynamic for a literal `:param` matcher list to track safely —
  // a broad matcher + an in-function reserved-segment check (RESERVED_TOP_LEVEL_SEGMENTS)
  // is the one that can't silently miss a shape. /api must never inherit this header.
  matcher: ['/((?!api|_next/).*)'],
}

function isThinPagePath(pathname: string): boolean {
  if (pathname === '/search') return true
  if (pathname.startsWith('/tag/')) return true
  const segments = pathname.split('/').filter(Boolean)
  // /{rubric}/page/{n} — pagination page 2+, tech-spec.md §1/§8 (self-canonical, noindex,follow).
  return segments.length === 3 && segments[1] === 'page'
}

/**
 * Edge middleware can't talk to Postgres directly, so it asks the Node API route
 * for the article's real status and turns "unpublished" into a true HTTP 410
 * (distinct from a slug that never existed, which stays a normal 404 from the page).
 *
 * It also sets `X-Robots-Tag` on every content page (tech-spec.md "Критерії
 * приймання": `curl -I` should show the right header, not just a `<meta>` tag
 * a header-only check never sees) — thin pages (search, tag, pagination 2+) get
 * the thin-page variant.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const segments = pathname.split('/').filter(Boolean)

  // Legacy stage-1 flat URLs. `next.config.mjs` sets `skipTrailingSlashRedirect: true` so
  // these can redirect straight to the final canonical URL with a real 301 (FACT-261 / QA
  // FACT-259) — Next's own trailing-slash normalization is hardcoded to 308 and (being baked
  // into the build's redirect table) runs *before* Middleware, so it would otherwise answer
  // the bare path itself and our 301 below would never be the response the client sees.
  const legacyRubricSlug = segments.length === 2 && segments[0] === 'rubrics' ? segments[1] : null
  if (legacyRubricSlug) {
    return NextResponse.redirect(new URL(rubricPath(legacyRubricSlug), req.url), 301)
  }
  const legacyArticleSlug = segments.length === 2 && segments[0] === 'articles' ? segments[1] : null
  if (legacyArticleSlug) {
    const statusUrl = new URL(`/api/articles/${legacyArticleSlug}/status/`, INTERNAL_BASE_URL)
    try {
      const res = await fetch(statusUrl)
      const { rubricSlug } = await res.json()
      if (rubricSlug) {
        return NextResponse.redirect(new URL(articlePath(rubricSlug, legacyArticleSlug), req.url), 301)
      }
    } catch (err) {
      console.error(`[middleware] legacy article redirect lookup failed for ${statusUrl}:`, err)
    }
    // No rubric (never existed, or data issue) — fall through to the route handler's 404.
  }

  // With Next's own trailing-slash redirect off, replicate it ourselves for every other path
  // (same rule it used: a path whose last segment has no dot gets a trailing slash added; one
  // ending in "/" whose last segment has a dot — e.g. a stray "/robots.txt/" — gets it
  // stripped) so `trailingSlash: true` elsewhere in the site keeps working exactly as before,
  // just still at 308 since those aren't this issue's legacy URLs.
  if (!pathname.startsWith('/.well-known')) {
    const lastSegment = segments[segments.length - 1] || ''
    const looksLikeFile = lastSegment.includes('.')
    if (pathname !== '/' && pathname.endsWith('/') && looksLikeFile) {
      return NextResponse.redirect(new URL(pathname.slice(0, -1) + search, req.url), 308)
    }
    if (!pathname.endsWith('/') && !looksLikeFile) {
      return NextResponse.redirect(new URL(`${pathname}/${search}`, req.url), 308)
    }
  }

  // Only a genuine `/{rubric}/{slug}` article URL (2 segments, first one not a reserved
  // top-level route like /tag, /search, /admin) can be an unpublished-article 410 case.
  const looksLikeArticlePath = segments.length === 2 && !RESERVED_TOP_LEVEL_SEGMENTS.includes(segments[0])
  if (looksLikeArticlePath || pathname.startsWith('/articles/')) {
    const slug = segments[segments.length - 1]
    // Internal loopback, never req.nextUrl.origin (the public hostname) — see
    // INTERNAL_BASE_URL in @/lib/env for why that self-fetch is unreliable (FACT-244).
    // Trailing slash matters here: `trailingSlash: true` (next.config.mjs) 308s the
    // no-slash form, and `fetch` doesn't auto-follow that into valid JSON.
    const statusUrl = new URL(`/api/articles/${slug}/status/`, INTERNAL_BASE_URL)

    try {
      const res = await fetch(statusUrl)
      const { status } = await res.json()
      if (status === 'unpublished') {
        return new NextResponse(
          '<html><body><h1>410 — матеріал знято з публікації</h1><p>Ця сторінка більше не доступна.</p></body></html>',
          { status: 410, headers: { 'content-type': 'text/html; charset=utf-8', 'X-Robots-Tag': robotsMeta() } },
        )
      }
    } catch (err) {
      // Fall through to normal page rendering/404, but don't swallow the error silently —
      // a failing status check here otherwise looks indistinguishable from "slug doesn't exist".
      console.error(`[middleware] status check failed for ${statusUrl}:`, err)
    }
  }

  const res = NextResponse.next()
  res.headers.set('X-Robots-Tag', isThinPagePath(pathname) ? thinPageRobotsMeta() : robotsMeta())
  return res
}
