import { describe, it, expect } from 'vitest'
import { getSourceFeedRubricSlug } from '@/lib/ingest/sourcesConfig'

/**
 * FACT-382 AC2 stage 1: config/sources.yaml's per-source `rubrics` list is
 * the feed-level rubric mapping the fallback classifier tries first. Only
 * trustworthy when a source declares exactly one rubric — most declare
 * several, which carries no per-item signal.
 */
describe('getSourceFeedRubricSlug', () => {
  it('returns the rubric for a source with exactly one declared rubric', () => {
    expect(getSourceFeedRubricSlug('un_news_all')).toBe('svit')
  })

  it('returns null for a source that covers multiple rubrics (ambiguous)', () => {
    expect(getSourceFeedRubricSlug('ukrinform_lastnews')).toBeNull()
  })

  it('returns null for an unknown source key or missing input', () => {
    expect(getSourceFeedRubricSlug('not-a-real-source')).toBeNull()
    expect(getSourceFeedRubricSlug(undefined)).toBeNull()
    expect(getSourceFeedRubricSlug(null)).toBeNull()
  })
})
