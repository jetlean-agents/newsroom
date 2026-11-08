import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { articlePath } from '@/lib/urls'

/**
 * Legacy stage-1 flat URL. Permanent redirect to `/{rubric}/{slug}/` — tech-spec.md §1 /
 * this issue's URL scheme. 404 only if the slug never existed at all; an article that
 * existed but is now unpublished still redirects (the new route's own 410 check applies there).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const article = result.docs[0]
  if (!article) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const rubricSlug = typeof article.rubric === 'object' ? article.rubric.slug : null
  if (!rubricSlug) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.redirect(new URL(articlePath(rubricSlug, slug), req.url), 301)
}
