import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import type { Article } from '@/payload-types'
import { lastActivityDate, selectCorrectionsArticles } from '@/lib/corrections'
import { articlePath } from '@/lib/urls'

export const dynamic = 'force-dynamic'

export default async function CorrectionsPage() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { status: { in: ['published', 'unpublished'] } },
        // Filter non-empty `corrections` in the query itself, not after fetch —
        // otherwise a DB with >50 published articles silently drops real
        // corrections/retractions that just didn't land in the first page.
        { 'corrections.note': { exists: true } },
      ],
    },
    sort: '-updated_at',
    limit: 50,
    depth: 1,
  })

  const items = selectCorrectionsArticles(result.docs as Article[])

  return (
    <div className="container">
      <header className="phead" style={{ paddingTop: 0 }}>
        <h1 className="phead__title" style={{ fontSize: 'var(--fs-36)' }}>Виправлення</h1>
        <p>Усі суттєві виправлення до опублікованих матеріалів фіксуються тут та у самій статті.</p>
      </header>
      <div className="cards cards--divided" style={{ maxWidth: 'var(--measure)' }}>
        {items.map((a: Article) => {
          const retractedAt = a.status === 'unpublished' ? lastActivityDate(a) : null
          const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
          return (
            <article key={a.id} className="card">
              <h2 className="hl hl--card">
                {rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}
              </h2>
              {a.status === 'unpublished' && (
                <p className="meta">
                  Матеріал знято{retractedAt ? `: ${new Date(retractedAt).toLocaleDateString('uk-UA')}` : ''}
                </p>
              )}
              <ul className="corrections" style={{ borderLeftWidth: 4 }}>
                {(a.corrections || []).map((c: NonNullable<Article['corrections']>[number], i: number) => (
                  <li key={i}>{c.date ? new Date(c.date).toLocaleDateString('uk-UA') : ''}: {c.note}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}
