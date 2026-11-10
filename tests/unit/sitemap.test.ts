import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FACT-382 AC1: sitemap.xml must not list a rubric hub that has zero
 * published articles (e.g. "bez-rubryky" — the FACT-382 /review holding pen
 * for drafts the classifier couldn't place — or any other rubric nobody has
 * published into yet).
 */

const mockFind = vi.fn()

vi.mock('@/lib/payload', () => ({
  getPayloadClient: () => ({ find: mockFind }),
}))

vi.mock('@/lib/env', () => ({ SITE_URL: 'https://news.bigear.uk', NOINDEX: true }))

beforeEach(() => {
  mockFind.mockReset()
})

describe('sitemap.xml', () => {
  it('omits a rubric with no published articles', async () => {
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'rubrics') {
        return Promise.resolve({
          docs: [
            { id: 1, slug: 'podii', title: 'Події' },
            { id: 2, slug: 'bez-rubryky', title: 'Без рубрики' },
          ],
        })
      }
      if (collection === 'articles') {
        return Promise.resolve({
          docs: [
            {
              id: 10,
              slug: 'some-article',
              rubric: { id: 1, slug: 'podii' },
              updated_at: '2026-11-10T00:00:00.000Z',
              published_at: '2026-11-09T00:00:00.000Z',
            },
          ],
        })
      }
      return Promise.resolve({ docs: [] })
    })

    const { GET } = await import('@/app/sitemap.xml/route')
    const res = await GET()
    const xml = await res.text()

    expect(xml).toContain('/podii/')
    expect(xml).not.toContain('/bez-rubryky/')
  })

  it('lists every rubric that has at least one published article', async () => {
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'rubrics') {
        return Promise.resolve({
          docs: [
            { id: 1, slug: 'podii', title: 'Події' },
            { id: 2, slug: 'sport', title: 'Спорт' },
          ],
        })
      }
      if (collection === 'articles') {
        return Promise.resolve({
          docs: [
            { id: 10, slug: 'a', rubric: { id: 1, slug: 'podii' }, updated_at: 't', published_at: 't' },
            { id: 11, slug: 'b', rubric: { id: 2, slug: 'sport' }, updated_at: 't', published_at: 't' },
          ],
        })
      }
      return Promise.resolve({ docs: [] })
    })

    const { GET } = await import('@/app/sitemap.xml/route')
    const res = await GET()
    const xml = await res.text()

    expect(xml).toContain('/podii/')
    expect(xml).toContain('/sport/')
  })
})
