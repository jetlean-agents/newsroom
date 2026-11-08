import { describe, expect, it } from 'vitest'
import { articlePath, rubricPath, rubricPageNPath, tagPath, absoluteUrl } from '@/lib/urls'

describe('URL builders (tech-spec.md §1 URL scheme)', () => {
  it('builds a rubric hub path', () => {
    expect(rubricPath('podii')).toBe('/podii/')
  })

  it('builds an article path nested under its rubric', () => {
    expect(articlePath('podii', 'test-article')).toBe('/podii/test-article/')
  })

  it('builds a rubric pagination path', () => {
    expect(rubricPageNPath('podii', 2)).toBe('/podii/page/2/')
  })

  it('builds a tag path', () => {
    expect(tagPath('vybory')).toBe('/tag/vybory/')
  })

  it('prefixes SITE_URL for absolute links (sitemap/RSS/JSON-LD need absolute URLs)', () => {
    expect(absoluteUrl('/podii/')).toBe(`${process.env.SITE_URL || 'http://localhost:3000'}/podii/`)
  })
})
