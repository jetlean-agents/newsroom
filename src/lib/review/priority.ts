import { RUBRIC_SLUGS } from '@/lib/rubricsConfig'

/**
 * Queue prioritization (FACT-236 scope item 6): more sources and fresher events
 * first, so the limited daily draft budget (DRAFTS_PER_DAY) and the editor's
 * limited review time both go to the stories most likely to matter.
 */

export type RankableEvent = {
  id: string | number
  sourceCount: number
  firstSeenAt: string | Date
}

/** Highest source_count first; within a tie, the most recently first-seen event first. */
export function prioritizeEvents<T extends RankableEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
    return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime()
  })
}

export type RankableArticle = {
  id: string | number
  sourceCount: number
  eventDate?: string | Date | null
  rubricSlug?: string | null
}

/**
 * Rubric order follows RUBRICS_CONFIG (Події/Політика/Війна і безпека first —
 * Roman's 08.11 rubric order, see rubricsConfig.ts) as the tie-breaker after
 * sources and freshness; an unrecognized/unset rubric sorts last.
 */
function rubricRank(slug: string | null | undefined): number {
  if (!slug) return RUBRIC_SLUGS.length
  const idx = RUBRIC_SLUGS.indexOf(slug)
  return idx === -1 ? RUBRIC_SLUGS.length : idx
}

export function prioritizeReviewQueue<T extends RankableArticle>(articles: T[]): T[] {
  return [...articles].sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
    const aDate = a.eventDate ? new Date(a.eventDate).getTime() : 0
    const bDate = b.eventDate ? new Date(b.eventDate).getTime() : 0
    if (bDate !== aDate) return bDate - aDate
    return rubricRank(a.rubricSlug) - rubricRank(b.rubricSlug)
  })
}
