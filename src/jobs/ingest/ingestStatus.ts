import { getPayloadClient } from '@/lib/payload'
import type { Pool } from 'pg'

interface PgBossQueueRow {
  name: string
  state: string
  count: number
}

/** One completed/failed `ingest-draft-from-event` run, as persisted by pg-boss into `output` (see worker.ts). */
export interface DraftFunnelRun {
  completedAt: string | null
  state: string
  eventsConsidered: number | null
  drafted: number | null
  autoPublished: number | null
  skippedBudget: number | null
  skippedError: number | null
  skippedErrorReasons: Record<string, number> | null
  skippedSpendLimit: number | null
  skippedRubricCap: number | null
  provider: string | null
  /**
   * Set when the run itself failed outside any single event (FACT-362 AC1) —
   * either `draftFromEvent()`'s own `fatalError` (setup before the loop threw,
   * see draftFromEvent.ts) or, for a run pg-boss marked `failed` with no
   * funnel output at all (e.g. a crash from before this fix shipped, or one
   * outside draftFromEvent()'s own try/catch), pg-boss's own serialized
   * error. `message` is truncated and `stack` is only its first 5 lines, with
   * common secret-shaped substrings (API keys, bearer tokens) redacted —
   * never a reason to assume this is safe to paste somewhere more public.
   */
  error: { message: string; stack: string | null } | null
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
  /**
   * events → draft → publish funnel (FACT-362 AC1) — makes the admin able to
   * tell where the pipeline is losing throughput without container logs.
   */
  funnel: {
    events: {
      /** `status=new AND independent_confirmation=true` — ready for draftFromEvent(), not yet picked up. */
      pendingConfirmed: number
    }
    /** Last pg-boss runs of `ingest-draft-from-event`, most recent first. */
    draftFromEventRuns: DraftFunnelRun[]
    /** How many stored articles each gate currently flags, independent of any single run. */
    articlesBlockedBy: {
      isSensitive: number
      originalityBlocked: number
      factFlags: number
    }
  }
}

const SECRET_LIKE_RE = /\b(sk-ant-[a-z0-9_-]{8,}|bearer\s+[\w.-]{10,}|[a-z0-9_-]{24,})\b/gi

/** Defense-in-depth redaction (FACT-362 AC1: "без секретов и промптов") — never a guarantee. */
function redact(text: string): string {
  return text.replace(SECRET_LIKE_RE, '[redacted]')
}

function truncateMessage(message: string): string {
  return redact(message).slice(0, 500)
}

function truncateStack(stack: string): string {
  return redact(stack).split('\n').slice(0, 5).join('\n')
}

/**
 * A failed/errored run's error, with message/stack short and redacted enough
 * to post in an issue comment or show an admin without exec/log access
 * (FACT-362 AC1). Two shapes land here:
 * - `output.fatalError` — draftFromEvent()'s own field when setup before the
 *   per-event loop threw (draftFromEvent.ts); the run still completes `job`-
 *   wise with real counters, this is just the extra context.
 * - pg-boss's own serialized error (`output.message`/`output.stack`, via the
 *   `serialize-error` package) for a run pg-boss itself marked `failed` with
 *   no funnel output at all — e.g. a crash from before this fix shipped, or
 *   one outside draftFromEvent()'s own try/catch (a worker.ts-level bug).
 */
export function extractError(output: Record<string, unknown>, state: string): DraftFunnelRun['error'] {
  const fatal = output.fatalError as { message?: string; stack?: string | null } | null | undefined
  if (fatal?.message) {
    return { message: truncateMessage(fatal.message), stack: fatal.stack ? truncateStack(fatal.stack) : null }
  }
  if (state === 'failed' && typeof output.message === 'string') {
    return {
      message: truncateMessage(output.message),
      stack: typeof output.stack === 'string' ? truncateStack(output.stack) : null,
    }
  }
  return null
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

  const pendingConfirmed = await payload
    .count({
      collection: 'events',
      where: { and: [{ status: { equals: 'new' } }, { independent_confirmation: { equals: true } }] },
    })
    .then((r) => r.totalDocs)

  // Most recent `ingest-draft-from-event` runs, job and archive combined (same
  // reason as the pgboss.queues query above): the output column is whatever
  // draftFromEvent() returned — see worker.ts — including `completed` runs
  // that drafted nothing as well as `failed` ones.
  const { rows: draftFromEventRows } = await pool.query<{
    completedon: string | null
    state: string
    output: Record<string, unknown> | null
  }>(
    `select completedon, state, output
     from (
       select completedon, state, output from pgboss.job where name = 'ingest-draft-from-event'
       union all
       select completedon, state, output from pgboss.archive where name = 'ingest-draft-from-event'
     ) recent
     order by completedon desc nulls last
     limit 20`,
  )
  const draftFromEventRuns: DraftFunnelRun[] = draftFromEventRows.map((row) => {
    const output = row.output ?? {}
    return {
      completedAt: row.completedon,
      state: row.state,
      eventsConsidered: (output.eventsConsidered as number) ?? null,
      drafted: (output.drafted as number) ?? null,
      autoPublished: (output.autoPublished as number) ?? null,
      skippedBudget: (output.skippedBudget as number) ?? null,
      skippedError: (output.skippedError as number) ?? null,
      skippedErrorReasons: (output.skippedErrorReasons as Record<string, number>) ?? null,
      skippedSpendLimit: (output.skippedSpendLimit as number) ?? null,
      skippedRubricCap: (output.skippedRubricCap as number) ?? null,
      provider: (output.provider as string) ?? null,
      error: extractError(output, row.state),
    }
  })

  const [isSensitiveCount, originalityBlockedCount, factFlagsRows] = await Promise.all([
    payload.count({ collection: 'articles', where: { sensitive: { equals: true } } }).then((r) => r.totalDocs),
    payload.count({ collection: 'articles', where: { originality_blocked: { equals: true } } }).then((r) => r.totalDocs),
    // `fact_flags` is an array field (own child table) — no direct "non-empty" Payload
    // `where`, so count distinct parents with at least one row via raw SQL.
    pool.query<{ count: number }>(`select count(distinct "_parent_id")::int as count from "articles_fact_flags"`),
  ])

  return {
    sources: { total, verifiedEnabled, polledLast24h, withErrors },
    pgboss: { queues, failedLast24h, lastDispatchAt: dispatchRows[0]?.last_dispatch_at ?? null },
    funnel: {
      events: { pendingConfirmed },
      draftFromEventRuns,
      articlesBlockedBy: {
        isSensitive: isSensitiveCount,
        originalityBlocked: originalityBlockedCount,
        factFlags: factFlagsRows.rows[0]?.count ?? 0,
      },
    },
  }
}
