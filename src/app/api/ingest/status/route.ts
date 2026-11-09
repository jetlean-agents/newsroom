import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getIngestStatus } from '@/jobs/ingest/ingestStatus'

/** Admin-only read-only ingestion health (FACT-357) — see ingestStatus.ts. */
export async function GET(req: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, reason: 'admin auth required' }, { status: 401 })
  }

  const status = await getIngestStatus()
  return NextResponse.json({ ok: true, ...status })
}
