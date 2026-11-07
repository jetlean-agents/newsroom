import { getPayloadClient } from '@/lib/payload'
import { INGEST_INCLUDE_CANDIDATES } from '@/lib/env'

const INTERVAL_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 }

function intervalMs(pollInterval: string | undefined | null): number {
  const match = (pollInterval || '1h').match(/^(\d+)([mhd])$/)
  if (!match) return 3_600_000
  return Number(match[1]) * INTERVAL_MS[match[2]]
}

/**
 * Runs on a short fixed schedule (see worker.ts) and enqueues an
 * `ingest-poll-source` job for every source whose own `poll_interval` has
 * elapsed since it was last polled — this is how each source gets its own
 * cadence without pg-boss's one-schedule-per-job-name limit getting in the way.
 */
export async function dispatchDuePolls(enqueue: (sourceId: number) => Promise<void>) {
  const payload = await getPayloadClient()
  const sources = await payload.find({ collection: 'sources', limit: 200 })

  let dispatched = 0
  for (const source of sources.docs) {
    const eligible = source.enabled && (source.registry_status === 'verified' || INGEST_INCLUDE_CANDIDATES)
    if (!eligible) continue

    const due = !source.last_polled_at || Date.now() - new Date(source.last_polled_at).getTime() >= intervalMs(source.poll_interval)
    if (!due) continue

    await enqueue(source.id)
    dispatched++
  }

  return { dispatched, total: sources.docs.length }
}
