import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

/** Used by middleware.ts to decide between 404 (never existed) and 410 (existed, now unpublished). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, limit: 1 })
  const doc = result.docs[0]
  return NextResponse.json({ status: doc ? doc.status : 'none' })
}
