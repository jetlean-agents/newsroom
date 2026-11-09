import { getPayloadClient } from '@/lib/payload'
import { fetchFeed } from '@/lib/ingest/fetchFeed'
import { parseFeed, type RawFeedItem } from '@/lib/ingest/feedParser'
import { isAllowedByRobots } from '@/lib/ingest/robots'
import { canonicalizeUrl } from '@/lib/ingest/canonicalize'
import { itemHash, titleHash, simhash } from '@/lib/ingest/hash'
import { getApiAdapter } from '@/lib/ingest/apiSources'
import type { Source } from '@/payload-types'
import type { getPayload } from 'payload'

export interface PollResult {
  sourceKey: string
  skipped?: string
  fetched: number
  stored: number
  error?: string
}

/** Consecutive poll failures before a source auto-disables itself (dead-letter). */
const MAX_CONSECUTIVE_ERRORS = 5

/**
 * Entry point for the `ingest-poll-source` pg-boss handler (src/jobs/worker.ts).
 * Wraps `pollSource` so a crash *before* it (bad job payload, `findByID` throwing,
 * a bug in `pollSource` itself) still lands on `sources.last_error`/`consecutive_errors`
 * instead of only existing in pg-boss's `retry`/`failed` job state, which isn't visible
 * without container log access (FACT-357).
 */
export async function handlePollSourceJob(
  job: { data: unknown; retrycount?: number; retrylimit?: number },
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<PollResult> {
  const { sourceId } = job.data as { sourceId: number }
  try {
    const source = await payload.findByID({ collection: 'sources', id: sourceId })
    return await pollSource(source)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // pg-boss retries this job up to retrylimit times (worker.ts); only record once pg-boss
    // won't try again, so one flaky attempt doesn't burn through consecutive_errors 4x
    // (retrycount/retrylimit need `includeMetadata: true` on boss.work, set in worker.ts).
    const isFinalAttempt = job.retrycount == null || job.retrylimit == null || job.retrycount >= job.retrylimit
    if (isFinalAttempt) {
      await recordHandlerCrash(payload, sourceId, message)
    }
    throw err
  }
}

async function recordHandlerCrash(payload: Awaited<ReturnType<typeof getPayload>>, sourceId: number, message: string): Promise<void> {
  try {
    const source = await payload.findByID({ collection: 'sources', id: sourceId })
    const consecutiveErrors = (source.consecutive_errors || 0) + 1
    const deadLetter = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
    await payload.update({
      collection: 'sources',
      id: sourceId,
      data: {
        last_polled_at: new Date().toISOString(),
        last_error: `handler crashed: ${message}${deadLetter ? ` (auto-disabled after ${consecutiveErrors} failures)` : ''}`,
        consecutive_errors: consecutiveErrors,
        ...(deadLetter ? { enabled: false } : {}),
      },
    })
  } catch {
    // Best effort — don't mask the original crash with a secondary one.
  }
}

/** Dedups + stores normalized items (shared by the RSS/Atom and API branches below). */
async function storeItems(
  payload: Awaited<ReturnType<typeof getPayload>>,
  source: Source,
  items: RawFeedItem[],
  now: string,
): Promise<number> {
  let stored = 0
  for (const item of items) {
    let canonicalUrl: string
    try {
      canonicalUrl = canonicalizeUrl(item.url)
    } catch {
      continue
    }
    const hash = itemHash(source.source_key, canonicalUrl)

    const existing = await payload.find({ collection: 'source-items', where: { hash: { equals: hash } }, limit: 1 })
    if (existing.docs[0]) continue

    await payload.create({
      collection: 'source-items',
      data: {
        source: source.id,
        title: item.title,
        url: item.url,
        canonical_url: canonicalUrl,
        summary: item.summary,
        published_at: item.publishedAt,
        fetched_at: now,
        hash,
        title_hash: titleHash(item.title),
        simhash: simhash(item.title).toString(),
        cluster_status: 'unclustered',
      },
    })
    stored++
  }
  return stored
}

/**
 * `rss` and `press` registry entries are both RSS/Atom-shaped feeds (the
 * registry's `type` is an editorial category — official outlet vs. corporate
 * newsroom — not a transport format). `api` entries (Prozorro, NBU, CKAN) are
 * JSON REST APIs polled by a source-specific adapter (FACT-195,
 * src/lib/ingest/apiSources) keyed by `source_key`; an `api` source without
 * an adapter yet (e.g. `eurostat_api`) is reported `skipped`.
 */
export async function pollSource(source: Source): Promise<PollResult> {
  const payload = await getPayloadClient()

  if (source.type === 'api') {
    return pollApiSource(payload, source)
  }

  if (source.type !== 'rss' && source.type !== 'press') {
    return { sourceKey: source.source_key, skipped: `unknown source type "${source.type}"`, fetched: 0, stored: 0 }
  }

  const allowed = await isAllowedByRobots(source.url)
  if (!allowed) {
    await payload.update({
      collection: 'sources',
      id: source.id,
      data: { last_polled_at: new Date().toISOString(), last_error: 'blocked by robots.txt' },
    })
    return { sourceKey: source.source_key, skipped: 'robots.txt disallow', fetched: 0, stored: 0 }
  }

  const result = await fetchFeed(source.url, { etag: source.etag, lastModified: source.last_modified })
  const now = new Date().toISOString()

  if (result.status === 'error') {
    const consecutiveErrors = (source.consecutive_errors || 0) + 1
    const deadLetter = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
    await payload.update({
      collection: 'sources',
      id: source.id,
      data: {
        last_polled_at: now,
        last_error: deadLetter ? `${result.error} (auto-disabled after ${consecutiveErrors} failures)` : result.error,
        consecutive_errors: consecutiveErrors,
        ...(deadLetter ? { enabled: false } : {}),
      },
    })
    return { sourceKey: source.source_key, fetched: 0, stored: 0, error: result.error }
  }

  if (result.status === 'not_modified') {
    await payload.update({
      collection: 'sources',
      id: source.id,
      data: { last_polled_at: now, last_success_at: now, last_error: null, consecutive_errors: 0 },
    })
    return { sourceKey: source.source_key, fetched: 0, stored: 0 }
  }

  const items = parseFeed(result.body ?? '')
  const stored = await storeItems(payload, source, items, now)

  await payload.update({
    collection: 'sources',
    id: source.id,
    data: {
      last_polled_at: now,
      last_success_at: now,
      last_error: null,
      consecutive_errors: 0,
      etag: result.etag ?? source.etag,
      last_modified: result.lastModified ?? source.last_modified,
    },
  })

  return { sourceKey: source.source_key, fetched: items.length, stored }
}

/**
 * `type: api` sources (registry `robots_ok: not_applicable`): REST JSON
 * endpoints, not pages, so there's no robots.txt or conditional-GET (ETag)
 * to honor — each adapter does its own rate limiting internally.
 */
async function pollApiSource(payload: Awaited<ReturnType<typeof getPayload>>, source: Source): Promise<PollResult> {
  const adapter = getApiAdapter(source.source_key)
  if (!adapter) {
    return { sourceKey: source.source_key, skipped: 'no API adapter implemented for this source yet', fetched: 0, stored: 0 }
  }

  const now = new Date().toISOString()
  const result = await adapter()

  if (result.status === 'error') {
    const consecutiveErrors = (source.consecutive_errors || 0) + 1
    const deadLetter = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
    await payload.update({
      collection: 'sources',
      id: source.id,
      data: {
        last_polled_at: now,
        last_error: deadLetter ? `${result.error} (auto-disabled after ${consecutiveErrors} failures)` : result.error,
        consecutive_errors: consecutiveErrors,
        ...(deadLetter ? { enabled: false } : {}),
      },
    })
    return { sourceKey: source.source_key, fetched: 0, stored: 0, error: result.error }
  }

  const stored = await storeItems(payload, source, result.items, now)

  await payload.update({
    collection: 'sources',
    id: source.id,
    data: { last_polled_at: now, last_success_at: now, last_error: null, consecutive_errors: 0 },
  })

  return { sourceKey: source.source_key, fetched: result.items.length, stored }
}
