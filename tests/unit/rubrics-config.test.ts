import { describe, expect, it } from 'vitest'
import { RUBRICS_CONFIG, RUBRIC_SLUGS, isKnownRubricSlug } from '@/lib/rubricsConfig'

// Slugs come straight from this issue's spec (FACT-194) — locking them in a test
// means a future refactor can't silently drift the stable public URLs.
const EXPECTED_SLUGS = [
  'podii',
  'polityka',
  'viina',
  'ekonomika',
  'groshi',
  'svit',
  'suspilstvo',
  'tekhnolohii',
  'zdorovia',
  'sport',
  'kultura',
  'rehiony',
]

describe('RUBRICS_CONFIG', () => {
  it('has exactly the 12 rubrics from the spec, with stable latin slugs', () => {
    expect(RUBRIC_SLUGS).toEqual(EXPECTED_SLUGS)
  })

  it('every rubric has a non-empty title and description', () => {
    for (const r of RUBRICS_CONFIG) {
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.description.length).toBeGreaterThan(0)
    }
  })

  it('slugs are unique', () => {
    expect(new Set(RUBRIC_SLUGS).size).toBe(RUBRIC_SLUGS.length)
  })
})

describe('isKnownRubricSlug', () => {
  it('recognizes a configured rubric slug', () => {
    expect(isKnownRubricSlug('podii')).toBe(true)
  })

  it('rejects an unknown slug', () => {
    expect(isKnownRubricSlug('tag')).toBe(false)
    expect(isKnownRubricSlug('bez-rubryky')).toBe(false)
  })
})
