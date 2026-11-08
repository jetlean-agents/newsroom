import type { Article } from '@/payload-types'

const CORRECTIONS_STATUSES = ['published', 'unpublished']

function toTime(value?: string | null): number {
  return value ? new Date(value).getTime() : 0
}

/**
 * Most recent of updated_at / any correction date — used both as the sort key
 * and as the "Матеріал знято" timestamp for a retracted article (status
 * transitions to `unpublished` don't bump `updated_at`, but the retraction is
 * always recorded as a correction entry at the same time).
 */
export function lastActivityDate(article: Article): string | null {
  const candidates: Array<string | null | undefined> = [
    article.updated_at,
    ...(article.corrections || []).map((c) => c.date),
  ]
  let best: string | null = null
  for (const candidate of candidates) {
    if (candidate && toTime(candidate) >= toTime(best)) best = candidate
  }
  return best
}

/**
 * Articles eligible for /corrections: published or retracted (`unpublished`),
 * with at least one recorded correction. Drafts/in_review never qualify,
 * regardless of their `corrections` field. Newest activity first.
 */
export function selectCorrectionsArticles(articles: Article[]): Article[] {
  return articles
    .filter((a) => CORRECTIONS_STATUSES.includes(a.status))
    .filter((a) => (a.corrections || []).length > 0)
    .sort((a, b) => toTime(lastActivityDate(b)) - toTime(lastActivityDate(a)))
}
