import { getPayloadClient } from './payload'
import type { Pool } from 'pg'
import type { Tag } from '@/payload-types'

interface CoTagRow {
  tags_id: number
  n: number
}

/** "Схожі теги" (design/README.md tag page): tags that co-occur most often with
 * `tagId` on published articles, excluding itself. */
export async function getRelatedTags(tagId: number, limit = 6): Promise<Tag[]> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool: Pool }).pool
  const { rows } = await pool.query<CoTagRow>(
    `select other.tags_id, count(*)::int as n
     from articles_rels self
     join articles a on a.id = self.parent_id and a.status = 'published'
     join articles_rels other on other.parent_id = self.parent_id and other.path = 'tags' and other.tags_id != $1
     where self.path = 'tags' and self.tags_id = $1
     group by other.tags_id
     order by n desc
     limit $2`,
    [tagId, limit],
  )
  if (!rows.length) return []
  const ids = rows.map((r) => r.tags_id)
  const found = await payload.find({ collection: 'tags', where: { id: { in: ids } }, limit: ids.length })
  const byId = new Map(found.docs.map((t) => [t.id, t]))
  return ids.map((id) => byId.get(id)).filter((t): t is Tag => !!t)
}
