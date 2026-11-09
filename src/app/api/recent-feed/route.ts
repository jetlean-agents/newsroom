import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import type { Rubric } from '@/payload-types'

export const dynamic = 'force-dynamic'

/**
 * JSON feed for the 404 page's "Останні новини" rail (`not-found.tsx`). Next.js always
 * prerenders a static `not-found` shell at build time regardless of route config, and a
 * failed Postgres connection during that prerender crashes the whole build (pg Pool's
 * unhandled 'error' event, not just this request's promise) — not-found.tsx fetches this
 * client-side instead of calling Payload directly so the build never touches the DB here.
 */
export async function GET() {
  try {
    const payload = await getPayloadClient()
    const feed = await payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-published_at',
      limit: 5,
      depth: 1,
    })
    const articles = feed.docs
      .filter((a) => typeof a.rubric === 'object')
      .map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        published_at: a.published_at,
        updated_at: a.updated_at,
        breaking: a.breaking,
        breaking_until: a.breaking_until,
        rubric: { slug: (a.rubric as Rubric).slug, title: (a.rubric as Rubric).title },
      }))
    return NextResponse.json({ articles })
  } catch {
    return NextResponse.json({ articles: [] })
  }
}
