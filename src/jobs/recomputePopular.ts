import { getPayloadClient } from '@/lib/payload'

/**
 * Recomputes each article's page_views from the raw analytics_events table
 * (counting scroll_100 as a "read"), rather than trusting incremental
 * increments alone. Run periodically so the "popular" ranking self-heals.
 */
export async function recomputePopular() {
  const payload = await getPayloadClient()
  const pool = (payload.db as any).pool

  const { rows } = await pool.query(
    `select article_id, count(*)::int as views
     from analytics_events
     where kind = 'scroll_100'
     group by article_id`,
  )

  for (const row of rows) {
    await payload.update({
      collection: 'articles',
      id: row.article_id,
      data: { page_views: row.views },
    })
  }

  return { updated: rows.length }
}
