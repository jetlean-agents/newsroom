import { NextResponse, type NextRequest } from 'next/server'
import { robotsMeta, thinPageRobotsMeta, INTERNAL_BASE_URL } from '@/lib/env'

export const config = {
  // Content pages + /admin (sandbox must stay fully noindex, FACT-170 review) — never
  // /api: that must not inherit this header.
  matcher: ['/', '/articles/:slug', '/rubrics/:slug', '/search', '/corrections', '/admin', '/admin/:path*'],
}

/**
 * Edge middleware can't talk to Postgres directly, so it asks the Node API route
 * for the article's real status and turns "unpublished" into a true HTTP 410
 * (distinct from a slug that never existed, which stays a normal 404 from the page).
 *
 * It also sets `X-Robots-Tag` on every content page (tech-spec.md "Критерії
 * приймання": `curl -I` should show the right header, not just a `<meta>` tag
 * a header-only check never sees) — `/search` gets the thin-page variant.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/articles/')) {
    const slug = pathname.split('/').pop()
    // Internal loopback, never req.nextUrl.origin (the public hostname) — see
    // INTERNAL_BASE_URL in @/lib/env for why that self-fetch is unreliable (FACT-244).
    const statusUrl = new URL(`/api/articles/${slug}/status`, INTERNAL_BASE_URL)

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
  res.headers.set('X-Robots-Tag', pathname === '/search' ? thinPageRobotsMeta() : robotsMeta())
  return res
}
