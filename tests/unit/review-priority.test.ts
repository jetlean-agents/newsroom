import { describe, it, expect } from 'vitest'
import { prioritizeEvents, prioritizeReviewQueue } from '@/lib/review/priority'

describe('queue prioritization (FACT-236 scope item 6)', () => {
  it('ranks events with more sources first', () => {
    const ranked = prioritizeEvents([
      { id: 1, sourceCount: 2, firstSeenAt: '2026-11-08T10:00:00Z' },
      { id: 2, sourceCount: 5, firstSeenAt: '2026-11-08T09:00:00Z' },
    ])
    expect(ranked.map((e) => e.id)).toEqual([2, 1])
  })

  it('breaks a source-count tie by freshness (most recent first)', () => {
    const ranked = prioritizeEvents([
      { id: 1, sourceCount: 3, firstSeenAt: '2026-11-07T10:00:00Z' },
      { id: 2, sourceCount: 3, firstSeenAt: '2026-11-08T10:00:00Z' },
    ])
    expect(ranked.map((e) => e.id)).toEqual([2, 1])
  })

  it('review queue: more sources first, then freshness, then rubric order', () => {
    const ranked = prioritizeReviewQueue([
      { id: 1, sourceCount: 2, eventDate: '2026-11-08T08:00:00Z', rubricSlug: 'sport' },
      { id: 2, sourceCount: 4, eventDate: '2026-11-08T08:00:00Z', rubricSlug: 'kultura' },
      { id: 3, sourceCount: 2, eventDate: '2026-11-08T08:00:00Z', rubricSlug: 'podii' },
    ])
    // id 2: most sources wins outright; id 3 before id 1: same sources/date, "podii" outranks "sport".
    expect(ranked.map((a) => a.id)).toEqual([2, 3, 1])
  })

  it('an unset rubric sorts last among otherwise-tied articles', () => {
    const ranked = prioritizeReviewQueue([
      { id: 1, sourceCount: 2, eventDate: '2026-11-08T08:00:00Z', rubricSlug: null },
      { id: 2, sourceCount: 2, eventDate: '2026-11-08T08:00:00Z', rubricSlug: 'podii' },
    ])
    expect(ranked.map((a) => a.id)).toEqual([2, 1])
  })
})
