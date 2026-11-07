import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { SITE_URL, SITE_NAME, NOINDEX } from '@/lib/env'
import { RichText } from '@payloadcms/richtext-lexical/react'
import ScrollTracker from './ScrollTracker'

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}
  const url = `${SITE_URL}/articles/${article.slug}`
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
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  const payload = await getPayloadClient()
  const rubricId = typeof article.rubric === 'object' ? article.rubric.id : article.rubric
  const tagIds = (article.tags || []).map((t: any) => (typeof t === 'object' ? t.id : t))

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
    }),
  ])

  const nextArticle = next.docs[0]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.lead,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: typeof article.author === 'object' ? { '@type': 'Person', name: article.author.name } : undefined,
    url: `${SITE_URL}/articles/${article.slug}`,
  }

  return (
    <article>
      <ScrollTracker articleId={String(article.id)} nextArticleSlug={nextArticle?.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="meta">
        <Link href="/">Головна</Link> /{' '}
        {typeof article.rubric === 'object' ? (
          <Link href={`/rubrics/${article.rubric.slug}`}>{article.rubric.title}</Link>
        ) : null}{' '}/ {article.title}
      </nav>

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
            {article.sources.map((s: any, i: number) => (
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
            {article.corrections.map((c: any, i: number) => (
              <li key={i}>{c.date ? new Date(c.date).toLocaleDateString('uk-UA') : ''}: {c.note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.docs.length ? (
        <section>
          <h2>Пов'язані матеріали</h2>
          <ul>
            {related.docs.map((a: any) => (
              <li key={a.id}><Link href={`/articles/${a.slug}`}>{a.title}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      {nextArticle ? (
        <p>
          <Link href={`/articles/${nextArticle.slug}`} id="next-article-link">Наступна стаття: {nextArticle.title} →</Link>
        </p>
      ) : null}
    </article>
  )
}
