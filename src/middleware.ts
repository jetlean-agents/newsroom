import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/articles/:slug'],
}

/**
 * Edge middleware can't talk to Postgres directly, so it asks the Node API route
 * for the article's real status and turns "unpublished" into a true HTTP 410
 * (distinct from a slug that never existed, which stays a normal 404 from the page).
 */
export async function middleware(req: NextRequest) {
  const slug = req.nextUrl.pathname.split('/').pop()
  const statusUrl = new URL(`/api/articles/${slug}/status`, req.nextUrl.origin)

  try {
    const res = await fetch(statusUrl)
    const { status } = await res.json()
    if (status === 'unpublished') {
      return new NextResponse(
        '<html><body><h1>410 — матеріал знято з публікації</h1><p>Ця сторінка більше не доступна.</p></body></html>',
        { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } },
      )
    }
  } catch {
    // If the status check fails, fall through to normal page rendering/404.
  }

  return NextResponse.next()
}
