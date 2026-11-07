import { getPayloadClient } from '@/lib/payload'
import { fetchFeed } from '@/lib/ingest/fetchFeed'
import { parseFeed } from '@/lib/ingest/feedParser'
import { isAllowedByRobots } from '@/lib/ingest/robots'
import { canonicalizeUrl } from '@/lib/ingest/canonicalize'
import { itemHash, titleHash, simhash } from '@/lib/ingest/hash'
import type { Source } from '@/payload-types'

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
 * `rss` and `press` registry entries are both RSS/Atom-shaped feeds (the
 * registry's `type` is an editorial category — official outlet vs. corporate
 * newsroom — not a transport format); `api` entries (Prozorro, NBU, CKAN) are
 * JSON REST APIs that need source-specific parsers, tracked as a follow-up.
 */
export async function pollSource(source: Source): Promise<PollResult> {
  const payload = await getPayloadClient()

  if (source.type !== 'rss' && source.type !== 'press') {
    return { sourceKey: source.source_key, skipped: 'api sources need a source-specific parser, out of scope for the generic poller', fetched: 0, stored: 0 }
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
