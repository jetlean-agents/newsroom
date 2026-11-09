import PgBoss from 'pg-boss'
import { recomputePopular } from './recomputePopular'
import { syncSources } from './ingest/syncSources'
import { handlePollSourceJob } from './ingest/pollSource'
import { clusterEvents } from './ingest/clusterEvents'
import { draftFromEvent } from './ingest/draftFromEvent'
import { dispatchDuePolls } from './ingest/dispatchDuePolls'
import { getPayloadClient } from '@/lib/payload'
import { INGEST_ENABLED } from '@/lib/env'

const RECOMPUTE_POPULAR = 'recompute-popular'
const SYNC_SOURCES = 'ingest-sync-sources'
const POLL_SOURCE = 'ingest-poll-source'
const DISPATCH_POLLS = 'ingest-dispatch-polls'
const CLUSTER_EVENTS = 'ingest-cluster-events'
const DRAFT_FROM_EVENT = 'ingest-draft-from-event'

async function main() {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'pgboss',
  })

  boss.on('error', (err) => console.error('[pg-boss]', err))
  await boss.start()

  await boss.work(RECOMPUTE_POPULAR, async () => {
    const result = await recomputePopular()
    console.log('[recompute-popular]', result)
  })

  // Every 10 minutes.
  await boss.schedule(RECOMPUTE_POPULAR, '*/10 * * * *')
  console.log('pg-boss worker started, watching:', RECOMPUTE_POPULAR)

  if (!INGEST_ENABLED) {
    console.log('[ingest] INGEST_ENABLED is not "true" — ingestion/dedup/editorial jobs are not scheduled.')
    return
  }

  await boss.work(SYNC_SOURCES, async () => {
    const result = await syncSources()
    console.log('[ingest-sync-sources]', result)
  })

  await boss.work(
    POLL_SOURCE,
    // dead-letter: pg-boss retries a failed job up to 3x with backoff before giving up on it.
    // No `batchSize` here, so pg-boss 9 hands the handler one job object, not an array
    // (batched arrays only became the default in pg-boss 10) — handlePollSourceJob takes a single job.
    // `includeMetadata` adds retrycount/retrylimit to that job object, so the handler can tell
    // a mid-retry crash from the final attempt before writing to sources.consecutive_errors.
    { retryLimit: 3, retryBackoff: true, includeMetadata: true },
    async (job) => {
      const payload = await getPayloadClient()
      const result = await handlePollSourceJob(job, payload)
      console.log('[ingest-poll-source]', result)
    },
  )

  await boss.work(DISPATCH_POLLS, async () => {
    const result = await dispatchDuePolls((sourceId) => boss.send(POLL_SOURCE, { sourceId }).then(() => undefined))
    console.log('[ingest-dispatch-polls]', result)
  })

  await boss.work(CLUSTER_EVENTS, async () => {
    const result = await clusterEvents()
    console.log('[ingest-cluster-events]', result)
  })

  await boss.work(DRAFT_FROM_EVENT, async () => {
    const result = await draftFromEvent()
    console.log('[ingest-draft-from-event]', result)
    // Returned (not just logged) so pg-boss persists it as the job's `output`
    // (FACT-362 AC1) — the funnel becomes visible over `GET /api/ingest/status`
    // without container log/exec access, same gap FACT-357 closed for sources.
    return result
  })

  // Sync the registry into `sources` every 15 minutes (cheap, idempotent) so an
  // admin edit to config/sources.yaml shows up without a worker restart.
  await boss.schedule(SYNC_SOURCES, '*/15 * * * *')
  // Every source has its own poll_interval; this just checks who's due (see dispatchDuePolls).
  await boss.schedule(DISPATCH_POLLS, '*/1 * * * *')
  await boss.schedule(CLUSTER_EVENTS, '*/5 * * * *')
  await boss.schedule(DRAFT_FROM_EVENT, '*/10 * * * *')

  await syncSources()

  console.log('pg-boss ingestion jobs started:', SYNC_SOURCES, DISPATCH_POLLS, POLL_SOURCE, CLUSTER_EVENTS, DRAFT_FROM_EVENT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
