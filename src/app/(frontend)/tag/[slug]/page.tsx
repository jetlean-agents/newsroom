import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { NOINDEX } from '@/lib/env'
import { articlePath, tagPath, absoluteUrl } from '@/lib/urls'
import { formatFeedTime, formatDateOnly } from '@/lib/time'
import { getRelatedTags } from '@/lib/relatedTags'
import { getPopularArticles } from '@/lib/popular'
import Breadcrumbs from '@/components/Breadcrumbs'
import Cover from '@/components/Cover'
import RubricLabel from '@/components/RubricLabel'
import PopularList from '@/components/PopularList'
import Pagination from '@/components/Pagination'
import type { Article, Rubric } from '@/payload-types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

async function getTag(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'tags', where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0] || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return {}
  const url = absoluteUrl(tagPath(tag.slug!))
  return {
    title: `Тег: ${tag.title}`,
    alternates: { canonical: url },
    robots: NOINDEX ? 'noindex, nofollow' : tag.noindex ? 'noindex, follow' : 'index, follow',
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  const tag = await getTag(slug)
  if (!tag) notFound()

  const pageNum = Math.max(1, Number(page) || 1)
  const payload = await getPayloadClient()
  const [articles, total, relatedTags, popular] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { tags: { in: [tag.id] } }] },
      sort: '-published_at',
      limit: PAGE_SIZE,
      page: pageNum,
      depth: 1,
    }),
    payload.count({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { tags: { in: [tag.id] } }] },
    }),
    getRelatedTags(tag.id),
    getPopularArticles(24, 5),
  ])

  const totalPages = Math.max(1, Math.ceil(total.totalDocs / PAGE_SIZE))
  const oldest = articles.docs[articles.docs.length - 1]

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: `Тег: ${tag.title}`, url: absoluteUrl(tagPath(tag.slug!)) },
        ]}
      />
      <header className="phead" style={{ paddingTop: 0 }}>
        <span className="phead__kind">Тег</span>
        <h1 className="phead__title">{tag.title}</h1>
        <p>
          {total.totalDocs} матеріал{total.totalDocs === 1 ? '' : total.totalDocs < 5 ? 'и' : 'ів'}
          {oldest?.published_at ? ` з ${formatDateOnly(oldest.published_at)}` : ''}
        </p>
        {tag.noindex ? (
          <p className="meta">Матеріалів поки замало для окремого індексування цього тегу ({tag.articleCount ?? 0}).</p>
        ) : null}
      </header>

      <div className="listing-layout">
        <div className="listing">
          <ul className="list">
            {articles.docs.map((a) => {
              const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
              return (
                <li className="list__item" key={a.id} data-r={rubricSlug ?? undefined}>
                  <Cover rubricSlug={rubricSlug ?? 'podii'} media={a.cover} />
                  <div className="meta-row">
                    {rubricSlug ? <RubricLabel slug={rubricSlug} title={(a.rubric as Rubric).title} /> : null}
                    <span className="meta">
                      <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
                    </span>
                  </div>
                  <h3 className="hl hl--card">
                    {rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}
                  </h3>
                  <p className="list__excerpt">{a.lead}</p>
                </li>
              )
            })}
          </ul>
          <Pagination
            current={pageNum}
            total={totalPages}
            basePath={(p) => (p === 1 ? tagPath(tag.slug!) : `${tagPath(tag.slug!)}?page=${p}`)}
          />
        </div>
        <aside className="rail">
          {relatedTags.length ? (
            <section>
              <div className="section__head">
                <h2 className="section__title">Схожі теги</h2>
              </div>
              <ul className="chips">
                {relatedTags.map((t) => (
                  <li key={t.id}>
                    <Link className="chip" href={tagPath(t.slug!)}>{t.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <PopularList articles={popular.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]} />
        </aside>
      </div>
    </div>
  )
}
