import { hammingDistance, NEAR_DUPLICATE_THRESHOLD } from './hash'

export interface ClusterableItem {
  id: number | string
  sourceId: number | string
  titleHash: string
  simhash: bigint
  timestamp: number
}

export interface ExistingClusterMember {
  eventId: number | string
  titleHash: string
  simhash: bigint
  timestamp: number
}

/** Only cluster against events this recent — an old simhash match is probably coincidence. */
export const CLUSTER_WINDOW_MS = 72 * 60 * 60 * 1000

/**
 * Decides which existing event (if any) a new item belongs to: exact
 * title-hash match first, then near-duplicate simhash within the cluster
 * window. Pure function — no I/O — so the ingest pipeline is testable without
 * a live database (FACT-169 AC: unit tests on dedup/clustering).
 */
export function findMatchingEvent(item: ClusterableItem, existing: ExistingClusterMember[]): number | string | null {
  const exact = existing.find((m) => m.titleHash === item.titleHash)
  if (exact) return exact.eventId

  const nearDup = existing.find(
    (m) =>
      Math.abs(item.timestamp - m.timestamp) <= CLUSTER_WINDOW_MS &&
      hammingDistance(m.simhash, item.simhash) <= NEAR_DUPLICATE_THRESHOLD,
  )
  return nearDup ? nearDup.eventId : null
}

/**
 * Groups a batch of items into events purely in-memory (used by both the
 * pg-boss job and tests). Returns, per input item, which synthetic event
 * index it joined, plus per-event distinct-source counts.
 */
export function clusterBatch(items: ClusterableItem[]): { eventOf: Map<number | string, number>; eventSources: Set<number | string>[] } {
  const eventOf = new Map<number | string, number>()
  const eventSources: Set<number | string>[] = []
  const members: ExistingClusterMember[] = []

  for (const item of items) {
    const matchedEventId = findMatchingEvent(item, members)
    const eventIndex = matchedEventId !== null ? (matchedEventId as number) : eventSources.length

    if (matchedEventId === null) eventSources.push(new Set())
    eventSources[eventIndex].add(item.sourceId)
    eventOf.set(item.id, eventIndex)
    members.push({ eventId: eventIndex, titleHash: item.titleHash, simhash: item.simhash, timestamp: item.timestamp })
  }

  return { eventOf, eventSources }
}
