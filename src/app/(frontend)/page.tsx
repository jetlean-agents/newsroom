import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, NOINDEX } from '@/lib/env'
import { articlePath, rubricPath } from '@/lib/urls'
import { organizationJsonLd } from '@/lib/jsonld'
import { RUBRIC_SLUGS } from '@/lib/rubricsConfig'
import { getPopularArticles } from '@/lib/popular'
import Cover from '@/components/Cover'
import RubricLabel from '@/components/RubricLabel'
import FeedList from '@/components/FeedList'
import { ArticleCard, RubricBlockCard } from '@/components/Cards'
import PopularList from '@/components/PopularList'
import { formatFeedTime } from '@/lib/time'
import type { Rubric, Article } from '@/payload-types'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    description: SITE_DESCRIPTION,
    alternates: { canonical: SITE_URL },
    robots: NOINDEX ? 'noindex, nofollow' : 'index, follow',
    openGraph: {
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      type: 'website',
      locale: 'uk_UA',
      siteName: SITE_NAME,
    },
  }
}

export default async function HomePage() {
  const payload = await getPayloadClient()

  const [featured, feed, popular, evergreen, rubrics] = await Promise.all([
    // "Головне" (README): самий свіжий featured — топ, наступні 4 — «Головне».
    // Якщо featured менше 5, добираємо свіжими news.
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { featured: { equals: true } }] },
      sort: '-published_at',
      limit: 5,
      depth: 1,
    }),
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-published_at',
      limit: 20,
      depth: 1,
    }),
    getPopularArticles(24, 5),
    payload.find({
      collection: 'articles',
      where: { and: [{ status: { equals: 'published' } }, { content_type: { equals: 'evergreen' } }] },
      sort: '-published_at',
      limit: 3,
      depth: 1,
    }),
    payload.find({ collection: 'rubrics', where: { slug: { in: RUBRIC_SLUGS as string[] } }, limit: 50 }),
  ])

  const orderedRubrics = [...rubrics.docs].sort(
    (a: Rubric, b: Rubric) => RUBRIC_SLUGS.indexOf(a.slug!) - RUBRIC_SLUGS.indexOf(b.slug!),
  )

  let mainBlock = featured.docs
  if (mainBlock.length < 5) {
    const fill = await payload.find({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'published' } },
          { content_type: { equals: 'news' } },
          { id: { not_in: mainBlock.map((a) => a.id) } },
        ],
      },
      sort: '-published_at',
      limit: 5 - mainBlock.length,
      depth: 1,
    })
    mainBlock = [...mainBlock, ...fill.docs]
  }

  const top = mainBlock[0]
  const mainCards = mainBlock.slice(1, 5)

  const rubricBlocks = await Promise.all(
    orderedRubrics.map(async (r) => {
      const res = await payload.find({
        collection: 'articles',
        where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: r.id } }] },
        sort: '-published_at',
        limit: 3,
        depth: 1,
      })
      return { rubric: r, articles: res.docs }
    }),
  )

  const topRubricSlug = typeof top?.rubric === 'object' ? top.rubric.slug! : null

  return (
    <div className="container page-pad">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <h1 className="sr-only">Новини України — головні новини дня</h1>

      <div className="home-top">
        {top && topRubricSlug ? (
          <article className="top" data-r={topRubricSlug}>
            <Link className="mobile-bleed" href={articlePath(topRubricSlug, top.slug!)} tabIndex={-1} aria-hidden="true">
              <Cover rubricSlug={topRubricSlug} media={top.cover} priority />
            </Link>
            <div className="top__body">
              <div className="meta-row">
                <RubricLabel slug={topRubricSlug} title={(top.rubric as Rubric).title} />
                <span className="meta">
                  <time dateTime={top.published_at ?? undefined}>{formatFeedTime(top.published_at)}</time>
                </span>
              </div>
              <h2 className="hl hl--display">
                <Link href={articlePath(topRubricSlug, top.slug!)}>{top.title}</Link>
              </h2>
              <p className="lead">{top.lead}</p>
            </div>
          </article>
        ) : null}

        <section className="latest" aria-labelledby="latest-h">
          <div className="section__head">
            <h2 className="section__title" id="latest-h">Останні новини</h2>
          </div>
          <FeedList articles={feed.docs.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]} />
        </section>
      </div>

      {mainCards.length ? (
        <section className="section" aria-labelledby="main-h">
          <div className="section__head">
            <h2 className="section__title" id="main-h">Головне</h2>
          </div>
          <div className="cards cards--4 cards--divided">
            {mainCards.map((a, i) => (
              <ArticleCard key={a.id} article={a as Article & { rubric: Rubric }} main={i === 0} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="home-mid">
        <div className="rblocks">
          {rubricBlocks
            .filter((b) => b.articles.length)
            .map(({ rubric, articles }) => (
              <section key={rubric.id} className="section rblock">
                <div className="section__head" data-r={rubric.slug!}>
                  <h2 className="section__title">
                    <Link href={rubricPath(rubric.slug!)}>{rubric.title}</Link>
                  </h2>
                  <Link className="section__more" href={rubricPath(rubric.slug!)}>Усі новини рубрики</Link>
                </div>
                <RubricBlockCard article={articles[0] as Article & { rubric: Rubric }} />
                {articles.length > 1 ? (
                  <ul className="rblock__list">
                    {articles.slice(1).map((a) => (
                      <li key={a.id}>
                        <span className="meta">
                          <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
                        </span>
                        <Link href={articlePath(rubric.slug!, a.slug!)} className="hl hl--sm">{a.title}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
        </div>
        <aside className="rail section">
          <PopularList articles={popular.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]} />
          {evergreen.docs.length ? (
            <section className="explain">
              <div className="section__head">
                <h2 className="section__title">Пояснюємо</h2>
              </div>
              <div className="cards cards--divided" style={{ gap: '16px' }}>
                {evergreen.docs.map((a) => {
                  const rubricSlug = typeof a.rubric === 'object' ? (a.rubric as Rubric).slug! : null
                  return (
                    <article className="card" key={a.id}>
                      {rubricSlug ? <RubricLabel slug={rubricSlug} title={(a.rubric as Rubric).title} /> : null}
                      <h3 className="hl hl--sm">
                        <Link href={articlePath(rubricSlug!, a.slug!)}>{a.title}</Link>
                      </h3>
                      <p>{a.lead}</p>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
