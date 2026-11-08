import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { SITE_NAME, NOINDEX } from '@/lib/env'
import { articlePath, absoluteUrl } from '@/lib/urls'
import { articleJsonLd, DEFAULT_OG_IMAGE_URL } from '@/lib/jsonld'
import Breadcrumbs from '@/components/Breadcrumbs'
import { RichText } from '@payloadcms/richtext-lexical/react'
import ScrollTracker from './ScrollTracker'
import type { Article, Tag } from '@/payload-types'

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
  // Canonical rubric for this article differs from the URL segment it was requested
  // under — redirect to the canonical `/{rubric}/{slug}/` rather than serving duplicate
  // content under two URLs (tech-spec.md §1: self-canonical, one URL per article).
  if (rubric !== rubricSlug) {
    redirect(articlePath(rubricSlug, slug))
  }

  const payload = await getPayloadClient()
  const rubricId = typeof article.rubric === 'object' ? article.rubric.id : article.rubric
  const tagIds = (article.tags || []).map((t: number | Tag) => (typeof t === 'object' ? t.id : t))

  const [related, next] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'published' } },
          { id: { not_equals: article.id } },
          {
            or: [
              { rubric: { equals: rubricId } },
              ...(tagIds.length ? [{ tags: { in: tagIds } }] : []),
            ],
          },
        ],
      },
      sort: '-published_at',
      limit: 4,
      depth: 1,
    }),
    payload.find({
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
    }),
  ])

  const nextArticle = next.docs[0]
  const nextRubricSlug = typeof nextArticle?.rubric === 'object' ? nextArticle.rubric.slug : null
  const canonicalUrl = absoluteUrl(articlePath(rubricSlug, article.slug!))
  const jsonLd = articleJsonLd(article, canonicalUrl)

  return (
    <article>
      <ScrollTracker articleId={String(article.id)} nextArticleSlug={nextArticle?.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: rubricTitle, url: absoluteUrl(`/${rubricSlug}/`) },
          { name: article.title, url: canonicalUrl },
        ]}
      />

      <header className="article-header">
        <h1>{article.title}</h1>
        {article.ai_assisted ? <span className="demo-badge">AI-допомога: {article.ai_disclosure}</span> : null}
        <p className="meta">
          Подія: {article.event_date ? new Date(article.event_date).toLocaleDateString('uk-UA') : '—'} ·
          {' '}Опубліковано: {article.published_at ? new Date(article.published_at).toLocaleString('uk-UA') : '—'}
          {article.updated_at && article.updated_at !== article.published_at ? (
            <> · Оновлено: {new Date(article.updated_at).toLocaleString('uk-UA')}{article.update_note ? ` (${article.update_note})` : ''}</>
          ) : null}
        </p>
      </header>

      <p className="lead"><strong>{article.lead}</strong></p>

      <RichText data={article.body} />

      {article.cover && typeof article.cover === 'object' ? (
        <figure>
          <img src={article.cover.url ?? ''} alt={article.cover.alt ?? ''} />
          <figcaption className="meta">
            Фото: {article.cover.credit || article.cover.author || '—'}
            {article.cover.ai_generated ? ' · AI-ілюстрація' : ''}
          </figcaption>
        </figure>
      ) : null}

      {article.sources?.length ? (
        <section className="sources">
          <h2>Джерела</h2>
          <ul>
            {article.sources.map((s: NonNullable<Article['sources']>[number], i: number) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a>
                {s.publisher ? ` — ${s.publisher}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {article.corrections?.length ? (
        <section className="corrections">
          <h2>Виправлення</h2>
          <ul>
            {article.corrections.map((c: NonNullable<Article['corrections']>[number], i: number) => (
              <li key={i}>{c.date ? new Date(c.date).toLocaleDateString('uk-UA') : ''}: {c.note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.docs.length ? (
        <section>
          <h2>Ще в рубриці</h2>
          <ul>
            {related.docs.map((a) => {
              const aRubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : rubricSlug
              return (
                <li key={a.id}><Link href={articlePath(aRubricSlug!, a.slug!)}>{a.title}</Link></li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {nextArticle && nextRubricSlug ? (
        <p>
          <Link href={articlePath(nextRubricSlug, nextArticle.slug!)} id="next-article-link">
            Наступна стаття: {nextArticle.title} →
          </Link>
        </p>
      ) : null}
    </article>
  )
}
