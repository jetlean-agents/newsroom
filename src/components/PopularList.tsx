import Link from 'next/link'
import RubricLabel from './RubricLabel'
import { articlePath } from '@/lib/urls'
import type { Article, Rubric } from '@/payload-types'

type PopularArticle = Article & { rubric: Rubric }

/** "Популярне" — ranked list (number = rank, so counter-based numbering is semantically OK here). */
export default function PopularList({
  title = 'Популярне',
  period = 'за добу',
  articles,
}: {
  title?: string
  period?: string
  articles: PopularArticle[]
}) {
  if (!articles.length) return null
  return (
    <section>
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        <span className="meta">{period}</span>
      </div>
      <ol className="rank">
        {articles.map((a) => {
          const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug! : null
          return (
            <li key={a.id}>
              <div className="stack-4" style={{ '--sp-4': '6px' } as React.CSSProperties}>
                {rubricSlug ? <RubricLabel slug={rubricSlug} title={a.rubric.title} /> : null}
                <h3 className="hl hl--sm">
                  <Link href={articlePath(rubricSlug!, a.slug!)}>{a.title}</Link>
                </h3>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
