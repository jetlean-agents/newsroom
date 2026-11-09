import Link from 'next/link'
import Cover from './Cover'
import RubricLabel from './RubricLabel'
import { articlePath } from '@/lib/urls'
import { formatFeedTime } from '@/lib/time'
import type { Article, Rubric } from '@/payload-types'

type CardArticle = Article & { rubric: Rubric }

/** Головне / Читайте також grid card — `.card-main` on the first child enables
 * the mobile "big first card, rest as rows" layout rule (prototype.css). */
export function ArticleCard({ article, main = false }: { article: CardArticle; main?: boolean }) {
  const rubricSlug = article.rubric.slug!
  const href = articlePath(rubricSlug, article.slug!)
  return (
    <article className={`card${main ? ' card-main' : ''}`} data-r={rubricSlug}>
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <Cover rubricSlug={rubricSlug} media={article.cover} />
      </Link>
      <RubricLabel slug={rubricSlug} title={article.rubric.title} />
      <h3 className="hl hl--card">
        <Link href={href}>{article.title}</Link>
      </h3>
      <span className="meta">
        <time dateTime={article.published_at ?? undefined}>{formatFeedTime(article.published_at)}</time>
      </span>
    </article>
  )
}

/** Rubric block on the home page: top card--row + a short list below it. */
export function RubricBlockCard({ article }: { article: CardArticle }) {
  const rubricSlug = article.rubric.slug!
  const href = articlePath(rubricSlug, article.slug!)
  return (
    <article className="card card--row" data-r={rubricSlug}>
      <Cover rubricSlug={rubricSlug} media={article.cover} />
      <h3 className="hl hl--card">
        <Link href={href}>{article.title}</Link>
      </h3>
      <span className="meta">
        <time dateTime={article.published_at ?? undefined}>{formatFeedTime(article.published_at)}</time>
      </span>
    </article>
  )
}
