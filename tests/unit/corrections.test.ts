import { describe, expect, it } from 'vitest'
import { lastActivityDate, selectCorrectionsArticles } from '@/lib/corrections'
import type { Article } from '@/payload-types'

function article(overrides: Partial<Article>): Article {
  return {
    id: 1,
    title: 'Test',
    slug: 'test',
    lead: 'lead',
    body: {} as Article['body'],
    rubric: 1,
    author: 1,
    status: 'draft',
    ai_assisted: false,
    corrections: [],
    page_views: 0,
    ...overrides,
  } as Article
}

describe('selectCorrectionsArticles', () => {
  it('includes published articles with corrections', () => {
    const a = article({
      status: 'published',
      corrections: [{ date: '2026-01-01', note: 'fix' }],
    })
    expect(selectCorrectionsArticles([a])).toEqual([a])
  })

  it('includes retracted (unpublished) articles with corrections', () => {
    const a = article({
      status: 'unpublished',
      corrections: [{ date: '2026-01-02', note: 'Матеріал знято з публікації' }],
    })
    expect(selectCorrectionsArticles([a])).toEqual([a])
  })

  it('excludes published/unpublished articles with no corrections', () => {
    const published = article({ status: 'published', corrections: [] })
    const unpublished = article({ status: 'unpublished', corrections: [] })
    expect(selectCorrectionsArticles([published, unpublished])).toEqual([])
  })

  it('never includes draft or in_review articles, even with a corrections entry', () => {
    const draft = article({ status: 'draft', corrections: [{ date: '2026-01-01', note: 'x' }] })
    const inReview = article({ status: 'in_review', corrections: [{ date: '2026-01-01', note: 'x' }] })
    expect(selectCorrectionsArticles([draft, inReview])).toEqual([])
  })

  it('sorts by most recent activity (updated_at or latest correction date) first', () => {
    const older = article({
      id: 1,
      status: 'published',
      updated_at: '2026-01-01T00:00:00.000Z',
      corrections: [{ date: '2026-01-01', note: 'old fix' }],
    })
    const newerByCorrection = article({
      id: 2,
      status: 'unpublished',
      updated_at: '2026-01-01T00:00:00.000Z',
      corrections: [{ date: '2026-03-01', note: 'retracted' }],
    })
    const newerByUpdate = article({
      id: 3,
      status: 'published',
      updated_at: '2026-02-01T00:00:00.000Z',
      corrections: [{ date: '2026-01-15', note: 'edited' }],
    })

    expect(selectCorrectionsArticles([older, newerByCorrection, newerByUpdate])).toEqual([
      newerByCorrection,
      newerByUpdate,
      older,
    ])
  })
})

describe('lastActivityDate', () => {
  it('picks the latest of updated_at and correction dates', () => {
    const a = article({
      updated_at: '2026-01-01T00:00:00.000Z',
      corrections: [
        { date: '2026-02-01', note: 'a' },
        { date: '2026-01-15', note: 'b' },
      ],
    })
    expect(lastActivityDate(a)).toBe('2026-02-01')
  })

  it('falls back to null when nothing is dated', () => {
    const a = article({ updated_at: null, corrections: [] })
    expect(lastActivityDate(a)).toBeNull()
  })
})
