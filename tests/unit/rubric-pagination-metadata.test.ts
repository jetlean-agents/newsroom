import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `buildPaginationMetadata` (src/lib/seo.ts) is what `/{rubric}/page/{page}/`'s
 * `generateMetadata` delegates to (FACT-261) — tech-spec.md §1/§8: page >= 2 is
 * self-canonical (never collapsed onto page 1, a different set of URLs) and always
 * `noindex,follow`, unless the sitewide `NOINDEX` kill switch wins.
 */
describe('buildPaginationMetadata', () => {
  const originalNoindex = process.env.NOINDEX

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NOINDEX = originalNoindex
  })

  it('page >= 2 is self-canonical (not collapsed onto page 1)', async () => {
    const { buildPaginationMetadata } = await import('@/lib/seo')
    const meta = buildPaginationMetadata('podii', 'Події', 2)
    expect(meta.alternates?.canonical).toBe(`${process.env.SITE_URL || 'http://localhost:3000'}/podii/page/2/`)

    const metaPage5 = buildPaginationMetadata('podii', 'Події', 5)
    expect(metaPage5.alternates?.canonical).toBe(`${process.env.SITE_URL || 'http://localhost:3000'}/podii/page/5/`)
  })

  it('returns no metadata for page 1 (that is the hub page itself) or an invalid page number', async () => {
    const { buildPaginationMetadata } = await import('@/lib/seo')
    expect(buildPaginationMetadata('podii', 'Події', 1)).toEqual({})
    expect(buildPaginationMetadata('podii', 'Події', 0)).toEqual({})
    expect(buildPaginationMetadata('podii', 'Події', NaN)).toEqual({})
  })

  it('once indexable (NOINDEX=false), page >= 2 is noindex,follow — never fully indexed', async () => {
    process.env.NOINDEX = 'false'
    const { buildPaginationMetadata } = await import('@/lib/seo')
    expect(buildPaginationMetadata('podii', 'Події', 2).robots).toBe('noindex, follow')
  })

  it('sitewide NOINDEX=true still wins over the thin-page rule', async () => {
    process.env.NOINDEX = 'true'
    const { buildPaginationMetadata } = await import('@/lib/seo')
    expect(buildPaginationMetadata('podii', 'Події', 2).robots).toBe('noindex, nofollow')
  })
})
