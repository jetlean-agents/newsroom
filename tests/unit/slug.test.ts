import { describe, expect, it } from 'vitest'
import { slugify, stableSlug, uniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('transliterates Ukrainian titles into a URL-safe slug', () => {
    expect(slugify('Привіт, Світ!')).toBe('pryvit-svit')
  })

  it('collapses whitespace and punctuation', () => {
    expect(slugify('  Hello   World -- test  ')).toBe('hello-world-test')
  })

  it('never produces leading or trailing dashes', () => {
    expect(slugify('***weird***')).toBe('weird')
  })

  it('transliterates Russian-only Cyrillic letters outside the Ukrainian alphabet', () => {
    expect(slugify('Ещё раз')).toBe('eshchio-raz')
  })

  it('falls back to a stable non-empty hash slug when the title has nothing translatable', () => {
    const slug = slugify('🎉🎉🎉')
    expect(slug).not.toBe('')
    expect(slug).toMatch(/^article-[a-z0-9]+$/)
    // Deterministic for the same input, so repeated runs on the same title don't drift.
    expect(slugify('🎉🎉🎉')).toBe(slug)
  })

  it('produces different fallback slugs for different untranslatable titles', () => {
    expect(slugify('🎉🎉🎉')).not.toBe(slugify('💥💥💥'))
  })
})

describe('uniqueSlug', () => {
  it('returns the base slug untouched when it is free', async () => {
    expect(await uniqueSlug('new-article', async () => false)).toBe('new-article')
  })

  it('appends a numeric suffix on collision, picking the first free one', async () => {
    const taken = new Set(['new-article', 'new-article-2'])
    const result = await uniqueSlug('new-article', async (s) => taken.has(s))
    expect(result).toBe('new-article-3')
  })
})

describe('stableSlug', () => {
  it('generates a slug from the title when none exists yet', () => {
    expect(stableSlug('New Article')).toBe('new-article')
  })

  it('keeps the existing slug even if the title changes later', () => {
    expect(stableSlug('Completely Different Title', 'original-slug')).toBe('original-slug')
  })
})
