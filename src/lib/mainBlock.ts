import { getPayloadClient } from './payload'
import type { Pool } from 'pg'
import type { Article } from '@/payload-types'

export interface FillCandidate {
  id: number
  sourceCount: number
  publishedAt: string
}

/**
 * «Головне» fallback (PO review 09.11, FACT-340): when fewer than `limit` articles are
 * editor-pinned (`featured`), top the block up with the articles that have the most
 * sources, not just the freshest — a pure, unit-testable ranking so the DB query only
 * has to supply counts. Ties (equal source count) break by recency.
 */
export function rankFeaturedFill(candidates: FillCandidate[], limit: number): FillCandidate[] {
  return [...candidates]
    .sort((a, b) => {
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
    .slice(0, limit)
}

interface CandidateRow {
  id: number
  source_count: number
  published_at: string
}

async function queryCandidates(
  pool: Pool,
  excludeIds: number[],
  since: string | null,
): Promise<FillCandidate[]> {
  const params: (string | number[])[] = [excludeIds.length ? excludeIds : [0]]
  let sinceClause = ''
  if (since) {
    params.push(since)
    sinceClause = `and a.published_at >= $${params.length}`
  }
  const { rows } = await pool.query<CandidateRow>(
    `select a.id, count(s.id)::int as source_count, a.published_at
     from articles a
     left join articles_sources s on s._parent_id = a.id
     where a.status = 'published'
       and a.content_type = 'news'
       and a.id != all($1::int[])
       ${sinceClause}
     group by a.id, a.published_at`,
    params,
  )
  return rows.map((r) => ({ id: r.id, sourceCount: r.source_count, publishedAt: r.published_at }))
}

/**
 * Picks up to `limit` articles to fill the "Головне" block, ranked by source count
 * (freshest `windowHours` first; broadens to all published news if the window doesn't
 * have enough candidates) and returns the full `Article` docs in that ranked order.
 */
export async function getFeaturedFill(
  excludeIds: number[],
  limit: number,
  windowHours = 48,
): Promise<Article[]> {
  if (limit <= 0) return []
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool: Pool }).pool
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  let candidates = await queryCandidates(pool, excludeIds, since)
  if (candidates.length < limit) {
    const broader = await queryCandidates(pool, [...excludeIds, ...candidates.map((c) => c.id)], null)
    candidates = [...candidates, ...broader]
  }

  const picked = rankFeaturedFill(candidates, limit)
  if (!picked.length) return []

  const ids = picked.map((c) => c.id)
  const found = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { in: ids } }, { status: { equals: 'published' } }] },
    limit: ids.length,
    depth: 1,
  })
  const byId = new Map(found.docs.map((a) => [a.id, a]))
  return ids.map((id) => byId.get(id)).filter((a): a is Article => !!a)
}
