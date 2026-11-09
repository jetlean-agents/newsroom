import { Fragment } from 'react'
import Link from 'next/link'
import RubricLabel from './RubricLabel'
import { articlePath } from '@/lib/urls'
import { formatFeedTime, formatDayLabel, isBreakingActive } from '@/lib/time'

/** Minimal shape FeedList actually renders — lets both a full `Article & {rubric: Rubric}`
 * (server-fetched pages) and a trimmed client-fetched JSON payload (`/api/recent-feed`,
 * used by `not-found.tsx`) satisfy this without casting. */
export interface FeedArticle {
  id: string | number
  title: string
  slug?: string | null
  published_at?: string | null
  updated_at?: string | null
  breaking?: boolean | null
  breaking_until?: string | null
  rubric: { slug?: string | null; title: string }
}

function FeedRow({ article }: { article: FeedArticle }) {
  const urgent = isBreakingActive(article.breaking, article.breaking_until)
  const updated = article.updated_at && article.updated_at !== article.published_at
  return (
    <li className={`feed__item${urgent ? ' feed__item--urgent' : ''}`} data-r={article.rubric.slug!}>
      <time className="feed__time" dateTime={article.published_at ?? undefined}>
        {formatFeedTime(article.published_at)}
      </time>
      <div className="feed__body">
        <div className="feed__top">
          {urgent ? <span className="badge badge--signal">Терміново</span> : null}
          <RubricLabel slug={article.rubric.slug!} title={article.rubric.title} href={false} />
          {updated ? <span className="meta">оновлено {formatFeedTime(article.updated_at)}</span> : null}
        </div>
        <Link className="feed__link" href={articlePath(article.rubric.slug!, article.slug!)}>
          <h3 className="hl hl--feed">{article.title}</h3>
        </Link>
      </div>
    </li>
  )
}

/** "Останні новини" — time-spine feed with a day separator when the calendar day changes. */
export default function FeedList({ articles }: { articles: FeedArticle[] }) {
  let lastDay: string | null = null
  return (
    <ol className="feed">
      {articles.map((a, i) => {
        const day = formatDayLabel(a.published_at)
        const showDay = i > 0 && day !== lastDay
        lastDay = day
        return (
          <Fragment key={a.id}>
            {showDay ? <li className="feed__day">{day}</li> : null}
            <FeedRow article={a} />
          </Fragment>
        )
      })}
    </ol>
  )
}
