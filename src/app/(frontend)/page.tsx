import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'

export const revalidate = 60

export default async function HomePage() {
  const payload = await getPayloadClient()

  const [feed, popular, rubrics] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-published_at',
      limit: 20,
      depth: 1,
    }),
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-page_views',
      limit: 5,
      depth: 0,
    }),
    payload.find({ collection: 'rubrics', limit: 50 }),
  ])

  return (
    <div>
      <nav className="rubric-nav">
        {rubrics.docs.map((r: any) => (
          <Link key={r.id} href={`/rubrics/${r.slug}`}>{r.title}</Link>
        ))}
      </nav>

      <section>
        <h1>Останні новини</h1>
        {feed.docs.map((a: any) => (
          <article key={a.id} className="feed-item">
            <h2>
              <Link href={`/articles/${a.slug}`}>{a.title}</Link>
              {a.ai_assisted ? <span className="demo-badge">AI-допомога</span> : null}
            </h2>
            <p>{a.lead}</p>
            <p className="meta">
              {a.rubric?.title} · {a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}
            </p>
          </article>
        ))}
      </section>

      <aside>
        <h2>Популярне</h2>
        <ul>
          {popular.docs.map((a: any) => (
            <li key={a.id}><Link href={`/articles/${a.slug}`}>{a.title}</Link></li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
