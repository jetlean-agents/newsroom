import { getPayloadClient } from './payload'
import type { Article, Tag } from '@/payload-types'

function idOf(v: number | { id: number } | null | undefined): number | undefined {
  if (v == null) return undefined
  return typeof v === 'object' ? v.id : v
}

/**
 * "Читайте також" (design/README.md): by shared event first (same underlying
 * news event, strongest relation), then by tags/rubric — same approach the
 * ingestion pipeline uses to detect duplicates. De-duplicated, newest first.
 */
export async function getRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const payload = await getPayloadClient()
  const rubricId = idOf(article.rubric)
  const eventId = idOf(article.event)
  const tagIds = (article.tags || []).map((t) => idOf(t as number | Tag)).filter((id): id is number => id != null)

  const byEvent = eventId
    ? await payload.find({
        collection: 'articles',
        where: {
          and: [
            { status: { equals: 'published' } },
            { id: { not_equals: article.id } },
            { event: { equals: eventId } },
          ],
        },
        sort: '-published_at',
        limit,
        depth: 1,
      })
    : { docs: [] as Article[] }

  const remaining = limit - byEvent.docs.length
  const excludeIds = [article.id, ...byEvent.docs.map((a) => a.id)]
  const byTagsOrRubric =
    remaining > 0
      ? await payload.find({
          collection: 'articles',
          where: {
            and: [
              { status: { equals: 'published' } },
              { id: { not_in: excludeIds } },
              {
                or: [
                  { rubric: { equals: rubricId } },
                  ...(tagIds.length ? [{ tags: { in: tagIds } }] : []),
                ],
              },
            ],
          },
          sort: '-published_at',
          limit: remaining,
          depth: 1,
        })
      : { docs: [] as Article[] }

  return [...byEvent.docs, ...byTagsOrRubric.docs]
}
