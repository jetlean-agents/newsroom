import { describe, it, expect } from 'vitest'
import { rankFeaturedFill, type FillCandidate } from '@/lib/mainBlock'

describe('rankFeaturedFill (FACT-340, PO review 09.11 — "Головне" fallback)', () => {
  it('ranks by source count descending, not by recency', () => {
    const candidates: FillCandidate[] = [
      { id: 1, sourceCount: 1, publishedAt: '2026-11-09T12:00:00Z' }, // freshest, fewest sources
      { id: 2, sourceCount: 3, publishedAt: '2026-11-09T09:00:00Z' },
      { id: 3, sourceCount: 5, publishedAt: '2026-11-09T06:00:00Z' }, // oldest, most sources
    ]
    const result = rankFeaturedFill(candidates, 3)
    expect(result.map((c) => c.id)).toEqual([3, 2, 1])
  })

  it('breaks ties in source count by recency', () => {
    const candidates: FillCandidate[] = [
      { id: 1, sourceCount: 2, publishedAt: '2026-11-09T06:00:00Z' },
      { id: 2, sourceCount: 2, publishedAt: '2026-11-09T12:00:00Z' },
    ]
    const result = rankFeaturedFill(candidates, 2)
    expect(result.map((c) => c.id)).toEqual([2, 1])
  })

  it('respects the limit', () => {
    const candidates: FillCandidate[] = [
      { id: 1, sourceCount: 5, publishedAt: '2026-11-09T06:00:00Z' },
      { id: 2, sourceCount: 4, publishedAt: '2026-11-09T06:00:00Z' },
      { id: 3, sourceCount: 3, publishedAt: '2026-11-09T06:00:00Z' },
    ]
    expect(rankFeaturedFill(candidates, 1).map((c) => c.id)).toEqual([1])
  })

  it('does not mutate the input array', () => {
    const candidates: FillCandidate[] = [
      { id: 1, sourceCount: 1, publishedAt: '2026-11-09T06:00:00Z' },
      { id: 2, sourceCount: 5, publishedAt: '2026-11-09T06:00:00Z' },
    ]
    const original = [...candidates]
    rankFeaturedFill(candidates, 2)
    expect(candidates).toEqual(original)
  })
})
