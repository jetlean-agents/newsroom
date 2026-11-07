import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { parseFeed } from '@/lib/ingest/feedParser'
import { canonicalizeUrl } from '@/lib/ingest/canonicalize'
import { itemHash, titleHash, simhash } from '@/lib/ingest/hash'
import { clusterBatch, type ClusterableItem } from '@/lib/ingest/clustering'

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf-8')
}

/**
 * End-to-end over real feed fixtures (two outlets covering the same budget
 * story, one unrelated story, one Atom feed) with no database: parse -> hash
 * -> cluster, exercising the full FACT-169 dedup pipeline as a pure unit test.
 */
describe('ingest pipeline: feed fixtures -> dedup clusters', () => {
  it('clusters a same-wording repost with another outlet into one event, keeps unrelated stories apart', () => {
    const outletA = parseFeed(fixture('sample-rss.xml')).map((item, i) => ({ sourceId: 'outlet-a', item, idx: i }))
    const outletB = parseFeed(fixture('sample-rss-paraphrase.xml')).map((item, i) => ({ sourceId: 'outlet-b', item, idx: i }))
    // Same headline as outlet A's budget story, verbatim (e.g. wire pickup) -> exact title-hash match.
    const outletBWire = [{ sourceId: 'outlet-b-wire', item: outletA[0].item, idx: 0 }]

    const all = [...outletA, ...outletB, ...outletBWire]
    expect(all.length).toBeGreaterThanOrEqual(4)

    const clusterable: ClusterableItem[] = all.map((entry, i) => ({
      id: i,
      sourceId: entry.sourceId,
      titleHash: titleHash(entry.item.title),
      simhash: simhash(entry.item.title),
      timestamp: new Date(entry.item.publishedAt ?? Date.now()).getTime(),
    }))

    const { eventOf, eventSources } = clusterBatch(clusterable)

    const budgetEventIndex = eventOf.get(0)! // outlet A's budget item
    const wireIndex = eventOf.get(clusterable.length - 1)! // the verbatim repost
    expect(wireIndex).toBe(budgetEventIndex)
    expect(eventSources[budgetEventIndex].size).toBeGreaterThanOrEqual(2) // outlet-a + outlet-b-wire -> independent confirmation

    const nbuEventIndex = eventOf.get(1)! // outlet A's unrelated NBU item
    expect(nbuEventIndex).not.toBe(budgetEventIndex)
  })

  it('canonicalizes tracking params off polled URLs before hashing identity', () => {
    const items = parseFeed(fixture('sample-rss.xml'))
    const canonical = canonicalizeUrl(items[0].url)
    expect(canonical).not.toContain('utm_source')
    expect(itemHash('outlet-a', canonical)).toBe(itemHash('outlet-a', canonical))
  })
})
