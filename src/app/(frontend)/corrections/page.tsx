import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export default async function CorrectionsPage() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    sort: '-updated_at',
    limit: 50,
  })

  const withCorrections = result.docs.filter((a: any) => (a.corrections || []).length > 0)

  return (
    <div>
      <h1>Виправлення</h1>
      <p>Усі суттєві виправлення до опублікованих матеріалів фіксуються тут та у самій статті.</p>
      {withCorrections.map((a: any) => (
        <article key={a.id} className="feed-item">
          <h2><Link href={`/articles/${a.slug}`}>{a.title}</Link></h2>
          <ul>
            {a.corrections.map((c: any, i: number) => (
              <li key={i}>{c.date ? new Date(c.date).toLocaleDateString('uk-UA') : ''}: {c.note}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
