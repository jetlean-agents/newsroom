import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recategorizeBezRubrykyArticles } from '@/seed/fixups'

/**
 * FACT-382 PO review (PR #31): `recategorizeBezRubrykyArticles` runs on
 * every `npm run seed`, which `docker-compose.yml`'s `seed` service runs on
 * every redeploy. Since FACT-382, `bez-rubryky` is also where
 * draftFromEvent.ts deliberately parks an unclassifiable draft under
 * `in_review` for a human to review (/review) — this legacy cleanup of
 * already-published articles must never touch those, or every redeploy
 * would silently move fresh /review material to a keyword/suspilstvo guess
 * before anyone reviewed it.
 */

const mockFind = vi.fn()
const mockUpdate = vi.fn()

function makePayload() {
  return { find: mockFind, update: mockUpdate } as unknown as import('payload').Payload
}

beforeEach(() => {
  mockFind.mockReset()
  mockUpdate.mockReset().mockResolvedValue({})
})

describe('recategorizeBezRubrykyArticles', () => {
  it('only queries/moves published articles, leaving an in_review article in bez-rubryky untouched', async () => {
    mockFind.mockImplementation(({ collection, where }: { collection: string; where?: unknown }) => {
      if (collection === 'rubrics') return Promise.resolve({ docs: [{ id: 99, slug: 'bez-rubryky' }] })
      if (collection === 'articles') {
        // Assert the query is scoped to published — an in_review article
        // must never surface here in the first place.
        expect(JSON.stringify(where)).toContain('published')
        return Promise.resolve({
          docs: [{ id: 1, title: 'Старий опублікований матеріал', lead: 'Курс валют зріс', status: 'published' }],
        })
      }
      return Promise.resolve({ docs: [] })
    })

    const rubricIds: Record<string, number> = { groshi: 5 }
    const rubricBySlug = (slug: string) => ({ id: rubricIds[slug] })
    await recategorizeBezRubrykyArticles(makePayload(), rubricBySlug)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'articles', id: 1, data: { rubric: 5 } }),
    )
  })

  it('never includes an in_review article among the ones it moves', async () => {
    const articles = [
      { id: 1, title: 'Published piece', lead: 'Матч чемпіонату', status: 'published' },
      { id: 2, title: 'In-review FACT-382 weather draft', lead: 'Похолодання вночі', status: 'in_review' },
    ]

    mockFind.mockImplementation(({ collection, where }: { collection: string; where?: unknown }) => {
      if (collection === 'rubrics') return Promise.resolve({ docs: [{ id: 99, slug: 'bez-rubryky' }] })
      if (collection === 'articles') {
        // Simulate the DB applying the `status: published` filter from `where`.
        const onlyPublished = JSON.stringify(where).includes('published')
        return Promise.resolve({ docs: onlyPublished ? articles.filter((a) => a.status === 'published') : articles })
      }
      return Promise.resolve({ docs: [] })
    })

    const rubricIds: Record<string, number> = { sport: 2, suspilstvo: 7 }
    const rubricBySlug = (slug: string) => ({ id: rubricIds[slug] ?? 7 })
    await recategorizeBezRubrykyArticles(makePayload(), rubricBySlug)

    const movedIds = mockUpdate.mock.calls.map((call) => call[0].id)
    expect(movedIds).not.toContain(2)
  })
})
