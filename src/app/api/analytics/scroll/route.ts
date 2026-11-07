import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ANALYTICS_ENABLED } from '@/lib/env'

const VALID_KINDS = new Set(['scroll_25', 'scroll_50', 'scroll_75', 'scroll_100', 'next_article_click'])

export async function POST(req: Request) {
  if (!ANALYTICS_ENABLED) {
    return NextResponse.json({ ok: false, reason: 'analytics disabled' }, { status: 204 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.articleId || !VALID_KINDS.has(body.kind)) {
    return NextResponse.json({ ok: false, reason: 'invalid payload' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const article = await payload
    .findByID({ collection: 'articles', id: body.articleId })
    .catch(() => null)
  if (!article) {
    return NextResponse.json({ ok: false, reason: 'article not found' }, { status: 404 })
  }

  await payload.create({
    collection: 'analytics_events',
    data: { article: body.articleId, kind: body.kind },
  })

  if (body.kind === 'scroll_100') {
    await payload.update({
      collection: 'articles',
      id: body.articleId,
      data: { page_views: (article.page_views || 0) + 1 },
    })
  }

  return NextResponse.json({ ok: true })
}
