import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { thinPageRobotsMeta } from '@/lib/env'
import { articlePath, rubricPath, rubricPageNPath, absoluteUrl } from '@/lib/urls'
import { getRubric, PAGE_SIZE } from '@/lib/rubricHub'
import Breadcrumbs from '@/components/Breadcrumbs'

export const dynamic = 'force-dynamic'

/**
 * tech-spec.md §1/§8: page 2+ is self-canonical (never collapsed onto page 1 — a
 * different set of URLs), always `noindex,follow` once the sandbox stops being
 * sitewide-noindex.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ rubric: string; page: string }>
}): Promise<Metadata> {
  const { rubric, page } = await params
  const doc = await getRubric(rubric)
  const pageNum = Number(page)
  if (!doc || !Number.isInteger(pageNum) || pageNum < 2) return {}
  const url = absoluteUrl(rubricPageNPath(doc.slug!, pageNum))
  return {
    title: `${doc.title} — стор. ${pageNum}`,
    alternates: { canonical: url },
    robots: thinPageRobotsMeta(),
  }
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
  const hasNextPage = total.totalDocs > pageNum * PAGE_SIZE

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: doc.title, url: absoluteUrl(rubricPath(doc.slug!)) },
          { name: `Сторінка ${pageNum}`, url: absoluteUrl(rubricPageNPath(doc.slug!, pageNum)) },
        ]}
      />
      <h1>{doc.title} — сторінка {pageNum}</h1>

      <section>
        {feed.docs.map((a) => (
          <article key={a.id} className="feed-item">
            <h3><Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link></h3>
            <p>{a.lead}</p>
            <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
          </article>
        ))}
      </section>

      <nav className="pagination">
        <Link href={pageNum === 2 ? rubricPath(doc.slug!) : rubricPageNPath(doc.slug!, pageNum - 1)}>← Попередня</Link>
        {hasNextPage ? <Link href={rubricPageNPath(doc.slug!, pageNum + 1)}>Наступна →</Link> : null}
      </nav>
    </div>
  )
}
