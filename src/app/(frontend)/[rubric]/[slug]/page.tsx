import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { SITE_NAME, NOINDEX } from '@/lib/env'
import { articlePath, tagPath, absoluteUrl } from '@/lib/urls'
import { articleJsonLd, DEFAULT_OG_IMAGE_URL } from '@/lib/jsonld'
import { formatFullDateTime, formatFeedTime, formatDateOnly, isBreakingActive } from '@/lib/time'
import { getRelatedArticles } from '@/lib/related'
import { getPopularArticles } from '@/lib/popular'
import Breadcrumbs from '@/components/Breadcrumbs'
import Cover from '@/components/Cover'
import RubricLabel from '@/components/RubricLabel'
import FeedList from '@/components/FeedList'
import PopularList from '@/components/PopularList'
import { ArticleCard } from '@/components/Cards'
import ShareBar from '@/components/ShareBar'
import { InfoIcon, NextIcon } from '@/components/icons'
import { RichText } from '@payloadcms/richtext-lexical/react'
import ScrollTracker from './ScrollTracker'
import type { Article, Tag, Rubric, Media } from '@/payload-types'

export const dynamic = 'force-dynamic'

async function getArticle(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
  })
  return result.docs[0] || null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rubric: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}
  const rubricSlug = (typeof article.rubric === 'object' ? article.rubric.slug : '') || ''
  const url = absoluteUrl(articlePath(rubricSlug, article.slug!))
  return {
    title: article.title,
    description: article.lead,
    alternates: { canonical: url },
    robots: NOINDEX ? 'noindex, nofollow' : 'index, follow',
    openGraph: {
      title: article.title,
      description: article.lead,
      url,
      siteName: SITE_NAME,
      type: 'article',
      locale: 'uk_UA',
      images: [DEFAULT_OG_IMAGE_URL],
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.lead,
      images: [DEFAULT_OG_IMAGE_URL],
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ rubric: string; slug: string }>
}) {
  const { rubric, slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  const rubricSlug = typeof article.rubric === 'object' ? article.rubric.slug : null
  const rubricTitle = typeof article.rubric === 'object' ? article.rubric.title : ''
  if (!rubricSlug) notFound()
  if (rubric !== rubricSlug) {
    redirect(articlePath(rubricSlug, slug))
  }

  const [related, next, recentFeed, popular] = await Promise.all([
    getRelatedArticles(article, 3),
    (async () => {
      const payload = await getPayloadClient()
      return payload.find({
        collection: 'articles',
        where: {
          and: [
            { status: { equals: 'published' } },
            { published_at: { less_than: article.published_at } },
          ],
        },
        sort: '-published_at',
        limit: 1,
        depth: 1,
      })
    })(),
    (async () => {
      const payload = await getPayloadClient()
      return payload.find({
        collection: 'articles',
        where: { and: [{ status: { equals: 'published' } }, { id: { not_equals: article.id } }] },
        sort: '-published_at',
        limit: 6,
        depth: 1,
      })
    })(),
    getPopularArticles(24, 5),
  ])

  const nextArticle = next.docs[0]
  const nextRubricSlug = typeof nextArticle?.rubric === 'object' ? nextArticle.rubric.slug : null
  const canonicalUrl = absoluteUrl(articlePath(rubricSlug, article.slug!))
  const jsonLd = articleJsonLd(article, canonicalUrl)
  const urgent = isBreakingActive(article.breaking, article.breaking_until)
  const authorName = typeof article.author === 'object' ? article.author?.name : null
  const cover = article.cover && typeof article.cover === 'object' ? (article.cover as Media) : null
  const updated = article.updated_at && article.updated_at !== article.published_at

  return (
    <div className="container">
      <ScrollTracker articleId={String(article.id)} nextArticleSlug={nextArticle?.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: rubricTitle, url: absoluteUrl(`/${rubricSlug}/`) },
          { name: article.title, url: canonicalUrl },
        ]}
      />

      <div className="article-layout">
        <article className="article" data-r={rubricSlug}>
          <header className="article__head">
            <div className="article__kicker">
              {urgent ? <span className="badge badge--signal">Терміново</span> : null}
              <RubricLabel slug={rubricSlug} title={rubricTitle} />
              <span className="badge badge--outline">{article.content_type === 'evergreen' ? 'Пояснення' : 'Новина'}</span>
            </div>
            <h1 className="hl hl--display">{article.title}</h1>
            <p className="lead">{article.lead}</p>
            <div className="byline">
              <span>Автор: <strong>{authorName || 'Редакція'}</strong></span>
              <span>
                Опубліковано{' '}
                <time dateTime={article.published_at ?? undefined}>{formatFullDateTime(article.published_at)}</time>
              </span>
              {updated ? (
                <span className="byline__update">
                  <b>Оновлено</b>{' '}
                  <time dateTime={article.updated_at ?? undefined}>{formatFeedTime(article.updated_at)}</time>
                  {article.update_note ? `: ${article.update_note}` : ''}
                </span>
              ) : null}
            </div>
          </header>

          <div className="stack-5" style={{ marginTop: 24 }}>
            <figure className="figure mobile-bleed">
              <Cover rubricSlug={rubricSlug} media={article.cover} priority />
              <figcaption className="credit">
                {cover
                  ? `Фото: ${cover.credit || cover.author || '—'}${cover.ai_generated ? ' · AI-ілюстрація' : ''}`
                  : `Ілюстрація рубрики «${rubricTitle}». Власна графіка редакції.`}
              </figcaption>
            </figure>

            {article.ai_assisted ? (
              <div className="disclosure">
                <InfoIcon />
                <p style={{ margin: 0 }}>
                  {article.ai_disclosure || 'Матеріал підготовлено з допомогою ШІ на основі джерел, перелічених нижче. Факти перевірила редакція.'}
                </p>
              </div>
            ) : null}

            <div className="prose">
              <RichText data={article.body} />
            </div>

            {article.sources?.length ? (
              <section className="sources" aria-labelledby="src-h">
                <h2 id="src-h">Джерела</h2>
                <p>Матеріал написано на основі цих публікацій. Тексти джерел не копіюються.</p>
                <ol>
                  {article.sources.map((s: NonNullable<Article['sources']>[number], i: number) => (
                    <li key={i}>
                      <div>
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a>
                        <span className="meta">
                          {s.publisher ? `${s.publisher}, ` : ''}
                          {s.accessed_at ? `переглянуто ${formatDateOnly(s.accessed_at)}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="sources__foot">Помітили неточність? <Link href="/corrections">Напишіть редакції</Link>.</p>
              </section>
            ) : null}

            {article.corrections?.length ? (
              <section className="corrections">
                <h2>Виправлення</h2>
                <ul>
                  {article.corrections.map((c: NonNullable<Article['corrections']>[number], i: number) => (
                    <li key={i}>
                      <p className="meta" style={{ marginBottom: 4 }}>
                        <time dateTime={c.date ?? undefined}>{formatDateOnly(c.date)}</time>
                      </p>
                      <p>{c.note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {article.tags?.length ? (
              <div className="stack-4">
                <h2 className="section__title" style={{ fontSize: 16 }}>Теги</h2>
                <ul className="chips">
                  {(article.tags as Tag[]).filter((t) => typeof t === 'object').map((t) => (
                    <li key={t.id}>
                      <Link className="chip" href={tagPath(t.slug!)}>{t.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ShareBar />
          </div>

          {related.length ? (
            <section className="section" aria-labelledby="rel-h">
              <div className="section__head">
                <h2 className="section__title" id="rel-h">Читайте також</h2>
              </div>
              <div className="cards cards--3 cards--divided">
                {related.map((a) => (
                  <ArticleCard key={a.id} article={a as Article & { rubric: Rubric }} />
                ))}
              </div>
            </section>
          ) : null}

          {nextArticle && nextRubricSlug ? (
            <section className="section" aria-label="Наступна стаття">
              <Link className="next" href={articlePath(nextRubricSlug, nextArticle.slug!)} data-r={nextRubricSlug} id="next-article-link">
                <div className="stack-4">
                  <span className="next__label">Наступна стаття <NextIcon /></span>
                  <RubricLabel slug={nextRubricSlug} title={typeof nextArticle.rubric === 'object' ? nextArticle.rubric.title : ''} href={false} />
                  <h2 className="hl">{nextArticle.title}</h2>
                </div>
                <Cover rubricSlug={nextRubricSlug} media={nextArticle.cover} />
              </Link>
            </section>
          ) : null}
        </article>

        <aside className="rail"><div className="rail rail--sticky">
          <section>
            <div className="section__head">
              <h2 className="section__title">Останні новини</h2>
            </div>
            <FeedList articles={recentFeed.docs.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]} />
          </section>
          <PopularList articles={popular.filter((a) => typeof a.rubric === 'object') as (Article & { rubric: Rubric })[]} />
        </div></aside>
      </div>
    </div>
  )
}
