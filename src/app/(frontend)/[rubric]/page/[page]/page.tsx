import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { articlePath, rubricPath, rubricPageNPath, absoluteUrl } from '@/lib/urls'
import { getRubric, PAGE_SIZE } from '@/lib/rubricHub'
import { buildPaginationMetadata } from '@/lib/seo'
import { formatFeedTime } from '@/lib/time'
import Breadcrumbs from '@/components/Breadcrumbs'
import Cover from '@/components/Cover'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rubric: string; page: string }>
}): Promise<Metadata> {
  const { rubric, page } = await params
  const doc = await getRubric(rubric)
  if (!doc) return {}
  return buildPaginationMetadata(doc.slug!, doc.title, Number(page))
}

export default async function RubricHubPaginatedPage({
  params,
}: {
  params: Promise<{ rubric: string; page: string }>
}) {
  const { rubric, page } = await params
  const pageNum = Number(page)
  if (!Number.isInteger(pageNum) || pageNum < 1) notFound()
  if (pageNum === 1) redirect(rubricPath(rubric))

  const doc = await getRubric(rubric)
  if (!doc) notFound()

  const payload = await getPayloadClient()
  const [feed, total] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
      sort: '-published_at',
      limit: PAGE_SIZE,
      page: pageNum,
      depth: 1,
    }),
    payload.count({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
    }),
  ])

  if (feed.docs.length === 0) notFound()
  const totalPages = Math.max(1, Math.ceil(total.totalDocs / PAGE_SIZE))

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: doc.title, url: absoluteUrl(rubricPath(doc.slug!)) },
          { name: `Сторінка ${pageNum}`, url: absoluteUrl(rubricPageNPath(doc.slug!, pageNum)) },
        ]}
      />
      <header className="phead">
        <h1 className="phead__title">{doc.title} — сторінка {pageNum}</h1>
      </header>

      <ul className="list">
        {feed.docs.map((a) => (
          <li className="list__item" key={a.id} data-r={doc.slug!}>
            <Cover rubricSlug={doc.slug!} media={a.cover} />
            <span className="meta">
              <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
            </span>
            <h3 className="hl hl--card">
              <Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link>
            </h3>
            <p className="list__excerpt">{a.lead}</p>
          </li>
        ))}
      </ul>

      <Pagination
        current={pageNum}
        total={totalPages}
        basePath={(p) => (p === 1 ? rubricPath(doc.slug!) : rubricPageNPath(doc.slug!, p))}
      />
    </div>
  )
}
