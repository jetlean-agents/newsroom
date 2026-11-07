import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'

export const revalidate = 60

export default async function RubricPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()

  const rubric = await payload.find({ collection: 'rubrics', where: { slug: { equals: slug } }, limit: 1 })
  const doc = rubric.docs[0]
  if (!doc) notFound()

  const articles = await payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
    sort: '-published_at',
    limit: 30,
  })

  return (
    <div>
      <h1>{doc.title}</h1>
      {doc.description ? <p>{doc.description}</p> : null}
      {articles.docs.map((a: any) => (
        <article key={a.id} className="feed-item">
          <h2><Link href={`/articles/${a.slug}`}>{a.title}</Link></h2>
          <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
        </article>
      ))}
    </div>
  )
}
