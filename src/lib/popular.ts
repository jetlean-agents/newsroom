import { getPayloadClient } from './payload'
import type { Pool } from 'pg'
import type { Article } from '@/payload-types'

interface PopularRow {
  article_id: number
  views: number
}

/**
 * "Популярне за 24 год / 7 днів" ranked by real `scroll_100` reads in the
 * window (same "a read" definition as src/jobs/recomputePopular.ts), not the
 * lifetime `page_views` counter. Falls back to `page_views` when the window
 * has no analytics rows yet (fresh sandbox / low traffic) so the block isn't
 * empty — never fabricated, just a wider, already-trusted signal.
 */
export async function getPopularArticles(
  hours: number,
  limit = 5,
  opts: { rubricId?: number } = {},
): Promise<Article[]> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool: Pool }).pool
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { rows } = await pool.query<PopularRow>(
    `select ae.article_id, count(*)::int as views
     from analytics_events ae
     join articles a on a.id = ae.article_id
     where ae.kind = 'scroll_100'
       and ae.created_at >= $1
       and a.status = 'published'
       ${opts.rubricId ? 'and a.rubric_id = $2' : ''}
     group by ae.article_id
     order by views desc
     limit ${opts.rubricId ? '$3' : '$2'}`,
    opts.rubricId ? [since, opts.rubricId, limit] : [since, limit],
  )

  if (rows.length === 0) {
    const fallback = await payload.find({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'published' } },
          ...(opts.rubricId ? [{ rubric: { equals: opts.rubricId } }] : []),
        ],
      },
      sort: '-page_views',
      limit,
      depth: 1,
    })
    return fallback.docs
  }

  const ids = rows.map((r) => r.article_id)
  const found = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { in: ids } }, { status: { equals: 'published' } }] },
    limit: ids.length,
    depth: 1,
  })
  // Preserve the view-count ranking — Payload's `in` doesn't guarantee it.
  const byId = new Map(found.docs.map((a) => [a.id, a]))
  return ids.map((id) => byId.get(id)).filter((a): a is Article => !!a)
}
