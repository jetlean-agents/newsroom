import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { thinPageRobotsMeta } from '@/lib/env'
import type { Pool } from 'pg'

interface SearchRow {
  id: number
  title: string
  slug: string
  lead: string
  published_at: string | null
}

// tech-spec.md §8: internal search is never indexed, even once the site is otherwise indexable.
export const metadata: Metadata = { robots: thinPageRobotsMeta() }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const payload = await getPayloadClient()

  let results: SearchRow[] = []
  if (q && q.trim()) {
    const pool = (payload.db as unknown as { pool: Pool }).pool
    const { rows } = await pool.query<SearchRow>(
      `select id, title, slug, lead, published_at
       from articles
       where status = 'published'
         and search_vector @@ plainto_tsquery('simple', unaccent($1))
       order by published_at desc
       limit 20`,
      [q],
    )
    results = rows
  }

  return (
    <div>
      <h1>Пошук</h1>
      <form method="get">
        <input type="text" name="q" defaultValue={q} placeholder="Пошук новин..." />
        <button type="submit">Знайти</button>
      </form>
      {q ? <p className="meta">Знайдено: {results.length}</p> : null}
      {results.map((a) => (
        <article key={a.id} className="feed-item">
          <h2><Link href={`/articles/${a.slug}`}>{a.title}</Link></h2>
          <p>{a.lead}</p>
        </article>
      ))}
    </div>
  )
}
