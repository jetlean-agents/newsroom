import { describe, expect, it } from 'vitest'
import { articleJsonLd, breadcrumbListJsonLd, organizationJsonLd, PUBLISHER_LOGO_URL } from '@/lib/jsonld'
import type { Article } from '@/payload-types'

function baseArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 1,
    title: 'Заголовок новини',
    lead: 'Короткий лід статті.',
    body: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
    rubric: 1,
    content_type: 'news',
    featured: false,
    published_at: '2026-11-08T09:00:00.000Z',
    updated_at: '2026-11-08T09:00:00.000Z',
    author: 1,
    status: 'published',
    ai_assisted: false,
    page_views: 0,
    ...overrides,
  } as Article
}

describe('articleJsonLd (tech-spec.md §3)', () => {
  it('uses NewsArticle for content_type: news', () => {
    const jsonLd = articleJsonLd(baseArticle({ content_type: 'news' }), 'https://example.test/podii/x/')
    expect(jsonLd['@type']).toBe('NewsArticle')
  })

  it('uses Article for content_type: evergreen', () => {
    const jsonLd = articleJsonLd(baseArticle({ content_type: 'evergreen' }), 'https://example.test/podii/x/')
    expect(jsonLd['@type']).toBe('Article')
  })

  it('always includes publisher (Organization + logo), mainEntityOfPage and inLanguage: uk', () => {
    const url = 'https://example.test/podii/x/'
    const jsonLd = articleJsonLd(baseArticle(), url)
    expect(jsonLd.inLanguage).toBe('uk')
    expect(jsonLd.mainEntityOfPage).toBe(url)
    expect(jsonLd.publisher).toMatchObject({ '@type': 'Organization', logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO_URL } })
    expect(Array.isArray(jsonLd.image)).toBe(true)
    expect(jsonLd.image.length).toBeGreaterThan(0)
  })

  it('falls back to Organization author when no Person author is populated', () => {
    const jsonLd = articleJsonLd(baseArticle({ author: 1 }), 'https://example.test/podii/x/')
    expect(jsonLd.author).toMatchObject({ '@type': 'Organization' })
  })
})

describe('breadcrumbListJsonLd (tech-spec.md §2)', () => {
  it('builds a positioned BreadcrumbList', () => {
    const jsonLd = breadcrumbListJsonLd([
      { name: 'Головна', url: 'https://example.test/' },
      { name: 'Події', url: 'https://example.test/podii/' },
    ])
    expect(jsonLd['@type']).toBe('BreadcrumbList')
    expect(jsonLd.itemListElement).toHaveLength(2)
    expect(jsonLd.itemListElement[0].position).toBe(1)
    expect(jsonLd.itemListElement[1].position).toBe(2)
  })
})

describe('organizationJsonLd (tech-spec.md §4)', () => {
  it('includes name, url and a real logo URL', () => {
    const jsonLd = organizationJsonLd()
    expect(jsonLd['@type']).toBe('Organization')
    expect(jsonLd.logo).toEqual({ '@type': 'ImageObject', url: PUBLISHER_LOGO_URL })
  })
})
