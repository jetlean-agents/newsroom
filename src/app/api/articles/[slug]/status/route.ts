import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

/**
 * Used by middleware.ts to decide between 404 (never existed) and 410 (existed, now
 * unpublished), and to resolve the rubric slug for the legacy `/articles/{slug}` → 301
 * redirect (FACT-261) — middleware can't talk to Postgres directly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  const doc = result.docs[0]
  const rubricSlug = doc && typeof doc.rubric === 'object' && doc.rubric ? doc.rubric.slug : null
  return NextResponse.json({ status: doc ? doc.status : 'none', rubricSlug })
}
