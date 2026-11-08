import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { NOINDEX } from '@/lib/env'
import { articlePath, rubricPath, absoluteUrl } from '@/lib/urls'
import { getRubric, PAGE_SIZE } from '@/lib/rubricHub'
import Breadcrumbs from '@/components/Breadcrumbs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rubric: string }>
}): Promise<Metadata> {
  const { rubric } = await params
  const doc = await getRubric(rubric)
  if (!doc) return {}
  const url = absoluteUrl(rubricPath(doc.slug!))
  return {
    title: doc.title,
    description: doc.description || undefined,
    alternates: { canonical: url },
    robots: NOINDEX ? 'noindex, nofollow' : 'index, follow',
    openGraph: { title: doc.title, description: doc.description || undefined, url, type: 'website', locale: 'uk_UA' },
  }
}

export default async function RubricHubPage({ params }: { params: Promise<{ rubric: string }> }) {
  const { rubric } = await params
  const doc = await getRubric(rubric)
  if (!doc) notFound()

  const payload = await getPayloadClient()
  const [featured, feed, evergreen, total] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }, { featured: { equals: true } }] },
      sort: '-published_at',
      limit: 3,
      depth: 1,
    }),
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
      sort: '-published_at',
      limit: PAGE_SIZE,
      depth: 1,
    }),
    payload.find({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'published' } },
          { rubric: { equals: doc.id } },
          { content_type: { equals: 'evergreen' } },
        ],
      },
      sort: '-published_at',
      limit: 4,
      depth: 1,
    }),
    payload.count({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
    }),
  ])

  const hasNextPage = total.totalDocs > PAGE_SIZE

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: doc.title, url: absoluteUrl(rubricPath(doc.slug!)) },
        ]}
      />
      <h1>{doc.title}</h1>
      {doc.description ? <p>{doc.description}</p> : null}

      {featured.docs.length ? (
        <section className="featured-block">
          <h2>Головне</h2>
          {featured.docs.map((a) => (
            <article key={a.id} className="feed-item">
              <h3><Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link></h3>
              <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section>
        <h2>Стрічка</h2>
        {feed.docs.map((a) => (
          <article key={a.id} className="feed-item">
            <h3><Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link></h3>
            <p>{a.lead}</p>
            <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
          </article>
        ))}
      </section>

      {evergreen.docs.length ? (
        <section className="evergreen-block">
          <h2>Поясняльні матеріали рубрики</h2>
          <ul>
            {evergreen.docs.map((a) => (
              <li key={a.id}><Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasNextPage ? (
        <nav className="pagination">
          <Link href={`${rubricPath(doc.slug!)}page/2/`}>Наступна сторінка →</Link>
        </nav>
      ) : null}
    </div>
  )
}
