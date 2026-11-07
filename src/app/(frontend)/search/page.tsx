import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const payload = await getPayloadClient()

  let results: any[] = []
  if (q && q.trim()) {
    const pool = (payload.db as any).pool
    const { rows } = await pool.query(
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
