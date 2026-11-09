import { getPayloadClient } from '@/lib/payload'
import type { Pool } from 'pg'
import type { Tag } from '@/payload-types'

/** Shared between the hub page and its pagination route — a `page.tsx` can only export
 * the Next.js page contract (default/generateMetadata/...), so this can't live there. */
export const PAGE_SIZE = 20

export async function getRubric(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'rubrics', where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0] || null
}

interface TagCountRow {
  tags_id: number
  n: number
}

/** Chips in the rubric header (design/README.md "Шапка рубрики"): the rubric's
 * most-used tags, by how many published articles in it carry each tag. */
export async function getPopularTagsForRubric(rubricId: number, limit = 6): Promise<Tag[]> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool: Pool }).pool
  const { rows } = await pool.query<TagCountRow>(
    `select ar.tags_id, count(*)::int as n
     from articles_rels ar
     join articles a on a.id = ar.parent_id
     where ar.path = 'tags' and ar.tags_id is not null
       and a.status = 'published' and a.rubric_id = $1
     group by ar.tags_id
     order by n desc
     limit $2`,
    [rubricId, limit],
  )
  if (!rows.length) return []
  const ids = rows.map((r) => r.tags_id)
  const found = await payload.find({ collection: 'tags', where: { id: { in: ids } }, limit: ids.length })
  const byId = new Map(found.docs.map((t) => [t.id, t]))
  return ids.map((id) => byId.get(id)).filter((t): t is Tag => !!t)
}
