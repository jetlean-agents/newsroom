'use client'

import { useEffect, useState } from 'react'
import FeedList, { type FeedArticle } from './FeedList'

/** Client-side fetch for `not-found.tsx` — see `src/app/api/recent-feed/route.ts` for why
 * this can't be a plain server-side Payload call here. */
export default function RecentFeedClient() {
  const [articles, setArticles] = useState<FeedArticle[]>([])

  useEffect(() => {
    fetch('/api/recent-feed')
      .then((r) => r.json())
      .then((data) => setArticles(data.articles ?? []))
      .catch(() => {})
  }, [])

  if (!articles.length) return null

  return (
    <aside className="rail section">
      <section>
        <div className="section__head">
          <h2 className="section__title">Останні новини</h2>
        </div>
        <FeedList articles={articles} />
      </section>
    </aside>
  )
}
