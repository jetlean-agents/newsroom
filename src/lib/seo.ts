import type { Metadata } from 'next'
import { TAG_NOINDEX_THRESHOLD, thinPageRobotsMeta } from './env'
import { rubricPageNPath, absoluteUrl } from './urls'

/** Tags below the threshold are considered too thin to index on their own. */
export function isTagNoindex(articleCount: number, threshold = TAG_NOINDEX_THRESHOLD): boolean {
  return articleCount < threshold
}

/**
 * Metadata for `/{rubric}/page/{page}/`, page >= 2 — tech-spec.md §1/§8: self-canonical
 * (never collapsed onto page 1, a different set of URLs) and always `noindex,follow`
 * (once the sandbox stops being sitewide-noindex). Pulled out of the route's
 * `generateMetadata` (FACT-261) so it's unit-testable without a Payload DB call.
 */
export function buildPaginationMetadata(rubricSlug: string, rubricTitle: string, pageNum: number): Metadata {
  if (!Number.isInteger(pageNum) || pageNum < 2) return {}
  const url = absoluteUrl(rubricPageNPath(rubricSlug, pageNum))
  return {
    title: `${rubricTitle} — стор. ${pageNum}`,
    alternates: { canonical: url },
    robots: thinPageRobotsMeta(),
  }
}
