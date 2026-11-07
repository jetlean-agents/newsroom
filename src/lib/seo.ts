import { TAG_NOINDEX_THRESHOLD } from './env'

/** Tags below the threshold are considered too thin to index on their own. */
export function isTagNoindex(articleCount: number, threshold = TAG_NOINDEX_THRESHOLD): boolean {
  return articleCount < threshold
}
