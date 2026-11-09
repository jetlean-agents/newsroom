import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { NOINDEX } from '@/lib/env'
import { articlePath, rubricPath, rubricPageNPath, tagPath, absoluteUrl } from '@/lib/urls'
import { getRubric, getPopularTagsForRubric, PAGE_SIZE } from '@/lib/rubricHub'
import { getPopularArticles } from '@/lib/popular'
import { formatFeedTime } from '@/lib/time'
import Breadcrumbs from '@/components/Breadcrumbs'
import Cover from '@/components/Cover'
import RubricLabel from '@/components/RubricLabel'
import PopularList from '@/components/PopularList'
import Pagination from '@/components/Pagination'
import type { Rubric, Article } from '@/payload-types'

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
    alternates: { canonical: url, types: { 'application/rss+xml': `${url}feed.xml` } },
    robots: NOINDEX ? 'noindex, nofollow' : 'index, follow',
    openGraph: { title: doc.title, description: doc.description || undefined, url, type: 'website', locale: 'uk_UA' },
  }
}

export default async function RubricHubPage({ params }: { params: Promise<{ rubric: string }> }) {
  const { rubric } = await params
  const doc = await getRubric(rubric)
  if (!doc) notFound()

  const payload = await getPayloadClient()
  const [feed, total, popular, evergreen, popularTags] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
      sort: '-published_at',
      limit: PAGE_SIZE,
      depth: 1,
    }),
    payload.count({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
    }),
    getPopularArticles(24, 5, { rubricId: doc.id }),
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
      limit: 3,
      depth: 1,
    }),
    getPopularTagsForRubric(doc.id),
  ])

  const top = feed.docs[0]
  const sideCards = feed.docs.slice(1, 3)
  const rest = feed.docs.slice(3)
  const totalPages = Math.max(1, Math.ceil(total.totalDocs / PAGE_SIZE))

  return (
    <div>
      <header className="rhead" data-r={doc.slug!}>
        <div className="container rhead__inner">
          <div className="rhead__text">
            <h1>{doc.title}</h1>
            {doc.description ? <p>{doc.description}</p> : null}
          </div>
          <div className="rhead__art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/covers/${doc.slug}.svg`} alt="" width={1200} height={675} />
          </div>
        </div>
      </header>
      <div className="container">
        <Breadcrumbs
          items={[
            { name: 'Головна', url: absoluteUrl('/') },
            { name: doc.title, url: absoluteUrl(rubricPath(doc.slug!)) },
          ]}
        />
        {popularTags.length ? (
          <header className="phead" style={{ paddingTop: 0 }}>
            <ul className="chips" aria-label="Популярні теми рубрики">
              {popularTags.map((t) => (
                <li key={t.id}>
                  <Link className="chip" href={tagPath(t.slug!)}>{t.title}</Link>
                </li>
              ))}
            </ul>
          </header>
        ) : null}

        <div className="listing-layout">
          <div className="listing">
            {top ? (
              <div className="listing-lead">
                <article className="top" data-r={doc.slug!}>
                  <Cover rubricSlug={doc.slug!} media={top.cover} priority />
                  <div className="top__body">
                    <span className="meta">
                      <time dateTime={top.published_at ?? undefined}>{formatFeedTime(top.published_at)}</time>
                    </span>
                    <h2 className="hl hl--display" style={{ fontSize: 'var(--fs-30)' }}>
                      <Link href={articlePath(doc.slug!, top.slug!)}>{top.title}</Link>
                    </h2>
                    <p className="lead" style={{ fontSize: 'var(--fs-16)' }}>{top.lead}</p>
                  </div>
                </article>
                {sideCards.length ? (
                  <div className="cards cards--divided">
                    {sideCards.map((a) => (
                      <article className="card card--row" data-r={doc.slug!} key={a.id}>
                        <Cover rubricSlug={doc.slug!} media={a.cover} />
                        <span className="meta">
                          <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
                        </span>
                        <h3 className="hl hl--sm">
                          <Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link>
                        </h3>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="meta">Матеріалів у цій рубриці ще немає.</p>
            )}

            {rest.length ? (
              <section className="section">
                <div className="section__head" data-r={doc.slug!}>
                  <h2 className="section__title">Усі новини рубрики</h2>
                  <a className="section__more" href={`${rubricPath(doc.slug!)}feed.xml`}>RSS рубрики</a>
                </div>
                <ul className="list">
                  {rest.map((a) => (
                    <li className="list__item" key={a.id} data-r={doc.slug!}>
                      <Cover rubricSlug={doc.slug!} media={a.cover} />
                      <div className="meta-row">
                        <span className="meta">
                          <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
                        </span>
                      </div>
                      <h3 className="hl hl--card">
                        <Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link>
                      </h3>
                      <p className="list__excerpt">{a.lead}</p>
                    </li>
                  ))}
                </ul>
                <Pagination current={1} total={totalPages} basePath={(p) => (p === 1 ? rubricPath(doc.slug!) : rubricPageNPath(doc.slug!, p))} />
              </section>
            ) : null}
          </div>
          <aside className="rail">
            <PopularList
              title="Популярне в рубриці"
              articles={popular.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]}
            />
            {evergreen.docs.length ? (
              <section className="explain">
                <div className="section__head">
                  <h2 className="section__title">Пояснюємо</h2>
                </div>
                <div className="cards cards--divided" style={{ gap: '16px' }}>
                  {evergreen.docs.map((a) => (
                    <article className="card" key={a.id}>
                      <RubricLabel slug={doc.slug!} title={doc.title} />
                      <h3 className="hl hl--sm">
                        <Link href={articlePath(doc.slug!, a.slug!)}>{a.title}</Link>
                      </h3>
                      <p>{a.lead}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}
