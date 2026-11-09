import { getPayloadClient } from '@/lib/payload'
import type { Pool } from 'pg'

interface PgBossQueueRow {
  name: string
  state: string
  count: number
}

export interface IngestStatus {
  sources: {
    total: number
    verifiedEnabled: number
    polledLast24h: number
    withErrors: number
  }
  pgboss: {
    // Jobs are archived out of `job` into `archive` on completion/failure, so a 24h
    // window has to look at both tables to not miss anything pg-boss already swept.
    queues: PgBossQueueRow[]
    failedLast24h: number
    lastDispatchAt: string | null
  }
}

/**
 * Read-only ingestion health, surfaced over the admin API so a failing worker is
 * visible without container log/exec access (FACT-357) — same gap FACT-345 covers
 * from the editorial side; this is the pg-boss/sources side only.
 */
export async function getIngestStatus(): Promise<IngestStatus> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool: Pool }).pool

  const [total, verifiedEnabled, polledLast24h, withErrors] = await Promise.all([
    payload.find({ collection: 'sources', limit: 0 }).then((r) => r.totalDocs),
    payload
      .find({ collection: 'sources', where: { registry_status: { equals: 'verified' }, enabled: { equals: true } }, limit: 0 })
      .then((r) => r.totalDocs),
    payload
      .find({ collection: 'sources', where: { last_polled_at: { greater_than: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } }, limit: 0 })
      .then((r) => r.totalDocs),
    payload.find({ collection: 'sources', where: { consecutive_errors: { greater_than: 0 } }, limit: 0 }).then((r) => r.totalDocs),
  ])

  const { rows: queues } = await pool.query<PgBossQueueRow>(
    `select name, state, count(*)::int as count
     from (
       select name, state, createdon from pgboss.job where createdon > now() - interval '24 hours'
       union all
       select name, state, createdon from pgboss.archive where createdon > now() - interval '24 hours'
     ) recent
     group by name, state
     order by name, state`,
  )

  const failedLast24h = queues.filter((q) => q.state === 'failed').reduce((sum, q) => sum + q.count, 0)

  const { rows: dispatchRows } = await pool.query<{ last_dispatch_at: string | null }>(
    `select max(createdon) as last_dispatch_at
     from (
       select createdon from pgboss.job where name = 'ingest-dispatch-polls'
       union all
       select createdon from pgboss.archive where name = 'ingest-dispatch-polls'
     ) t`,
  )

  return {
    sources: { total, verifiedEnabled, polledLast24h, withErrors },
    pgboss: { queues, failedLast24h, lastDispatchAt: dispatchRows[0]?.last_dispatch_at ?? null },
  }
}
