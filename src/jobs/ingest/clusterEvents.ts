import { getPayloadClient } from '@/lib/payload'
import { findMatchingEvent, CLUSTER_WINDOW_MS, type ExistingClusterMember } from '@/lib/ingest/clustering'
import { EVENT_CONFIRMATION_MIN_SOURCES } from '@/lib/env'
import type { SourceItem, Event } from '@/payload-types'

function sourceIdOf(item: SourceItem): number {
  return typeof item.source === 'object' ? item.source.id : item.source
}

function eventIdOf(item: SourceItem): number | null {
  if (!item.event) return null
  return typeof item.event === 'object' ? item.event.id : item.event
}

/**
 * Groups unclustered source-items into event clusters (FACT-169 scope item 3)
 * using the pure matching logic in `lib/ingest/clustering.ts`. An event gets
 * `independent_confirmation` once >= EVENT_CONFIRMATION_MIN_SOURCES distinct
 * publishers are in its cluster.
 */
export async function clusterEvents() {
  const payload = await getPayloadClient()
  const unclustered = await payload.find({
    collection: 'source-items',
    where: { cluster_status: { equals: 'unclustered' } },
    sort: 'fetched_at',
    limit: 500,
  })

  let clustered = 0
  let eventsCreated = 0
  const touchedEvents = new Set<number>()

  for (const item of unclustered.docs) {
    const itemTimestamp = new Date(item.published_at || item.fetched_at).getTime()
    const since = new Date(itemTimestamp - CLUSTER_WINDOW_MS).toISOString()

    const candidates = await payload.find({
      collection: 'source-items',
      where: {
        and: [
          { cluster_status: { equals: 'clustered' } },
          { fetched_at: { greater_than: since } },
        ],
      },
      limit: 300,
      sort: '-fetched_at',
    })

    const existing: ExistingClusterMember[] = candidates.docs
      .map((c): ExistingClusterMember | null => {
        const eventId = eventIdOf(c)
        return eventId === null
          ? null
          : { eventId, titleHash: c.title_hash, simhash: BigInt(c.simhash), timestamp: new Date(c.published_at || c.fetched_at).getTime() }
      })
      .filter((m): m is ExistingClusterMember => m !== null)

    const matchedEventId = findMatchingEvent(
      { id: item.id, sourceId: sourceIdOf(item), titleHash: item.title_hash, simhash: BigInt(item.simhash), timestamp: itemTimestamp },
      existing,
    )

    let eventId = matchedEventId as number | null
    if (!eventId) {
      const created = await payload.create({
        collection: 'events',
        data: {
          title: item.title,
          first_seen_at: item.published_at || item.fetched_at,
          last_seen_at: item.published_at || item.fetched_at,
          source_count: 1,
          independent_confirmation: false,
          status: 'new',
        },
      })
      eventId = created.id
      eventsCreated++
    }

    await payload.update({ collection: 'source-items', id: item.id, data: { cluster_status: 'clustered', event: eventId } })
    touchedEvents.add(eventId)
    clustered++
  }

  for (const eventId of touchedEvents) {
    await recomputeEventStats(eventId)
  }

  return { processed: unclustered.docs.length, clustered, eventsCreated }
}

async function recomputeEventStats(eventId: number) {
  const payload = await getPayloadClient()
  const members = await payload.find({
    collection: 'source-items',
    where: { event: { equals: eventId } },
    limit: 500,
  })

  const distinctSources = new Set(members.docs.map(sourceIdOf))
  const timestamps = members.docs.map((m) => new Date(m.published_at || m.fetched_at).getTime())
  const event = await payload.findByID({ collection: 'events', id: eventId })
  if (event.status === 'dismissed') return // editor decision wins over recompute

  const data: Partial<Event> = {
    source_count: distinctSources.size,
    independent_confirmation: distinctSources.size >= EVENT_CONFIRMATION_MIN_SOURCES,
    first_seen_at: new Date(Math.min(...timestamps)).toISOString(),
    last_seen_at: new Date(Math.max(...timestamps)).toISOString(),
  }

  await payload.update({ collection: 'events', id: eventId, data })
}
