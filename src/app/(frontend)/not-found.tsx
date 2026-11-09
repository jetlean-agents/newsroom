import Link from 'next/link'
import { RUBRICS_CONFIG } from '@/lib/rubricsConfig'
import { rubricPath } from '@/lib/urls'
import RecentFeedClient from '@/components/RecentFeedClient'

// Deliberately no Payload/DB access anywhere in this file, even behind a try/catch: Next
// always prerenders a static `not-found` shell at build time (for the edge/middleware
// fallback case) regardless of a `dynamic` export, and a failed Postgres connection during
// that prerender crashes the whole `next build` (the pg Pool's own unhandled 'error' event,
// not a promise rejection this file's code could catch) — breaks the placeholder
// CI/Docker-build DATABASE_URL (Dockerfile, .github/workflows/ci.yml). The "Останні новини"
// rail is fetched client-side instead (`RecentFeedClient` → `/api/recent-feed`).
export default function NotFound() {
  return (
    <div className="container">
      <div className="listing-layout">
        <div className="listing">
          <section className="notfound">
            <span className="notfound__code" aria-hidden="true">404</span>
            <h1 className="hl hl--display">Сторінку не знайдено</h1>
            <p className="lead">Можливо, матеріал перенесли або в адресі є помилка. Знайдіть його через пошук або перегляньте рубрики.</p>
            <form className="field" role="search" method="get" action="/search">
              <label className="sr-only" htmlFor="q">Пошуковий запит</label>
              <input className="input" id="q" name="q" type="search" placeholder="Що ви шукали?" />
              <button className="btn" type="submit">Знайти</button>
            </form>
            <ul className="chips">
              {RUBRICS_CONFIG.slice(0, 8).map((r) => (
                <li key={r.slug}>
                  <Link className="chip" href={rubricPath(r.slug)}>{r.title}</Link>
                </li>
              ))}
            </ul>
            <p><Link className="btn btn--secondary" href="/">На головну</Link></p>
          </section>
        </div>
        <RecentFeedClient />
      </div>
    </div>
  )
}
