import { describe, expect, it } from 'vitest'
import { slugify, stableSlug } from '@/lib/slug'

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
})

describe('stableSlug', () => {
  it('generates a slug from the title when none exists yet', () => {
    expect(stableSlug('New Article')).toBe('new-article')
  })

  it('keeps the existing slug even if the title changes later', () => {
    expect(stableSlug('Completely Different Title', 'original-slug')).toBe('original-slug')
  })
})
