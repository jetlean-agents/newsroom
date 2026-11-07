import { describe, it, expect } from 'vitest'
import { canonicalizeUrl } from '@/lib/ingest/canonicalize'

describe('canonicalizeUrl', () => {
  it('strips tracking params and normalizes host/scheme/trailing slash', () => {
    const a = canonicalizeUrl('http://www.Example.com/news/article/?utm_source=telegram&id=5')
    const b = canonicalizeUrl('https://example.com/news/article?id=5')
    expect(a).toBe(b)
  })

  it('keeps meaningful query params, sorted', () => {
    const a = canonicalizeUrl('https://example.com/page?b=2&a=1')
    const b = canonicalizeUrl('https://example.com/page?a=1&b=2')
    expect(a).toBe(b)
  })

  it('drops the fragment', () => {
    expect(canonicalizeUrl('https://example.com/a#section')).toBe('https://example.com/a')
  })
})
