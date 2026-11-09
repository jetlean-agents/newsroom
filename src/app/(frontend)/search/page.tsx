import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { thinPageRobotsMeta } from '@/lib/env'
import { articlePath, rubricPath } from '@/lib/urls'
import { formatFeedTime } from '@/lib/time'
import { RUBRICS_CONFIG } from '@/lib/rubricsConfig'
import Cover from '@/components/Cover'
import RubricLabel from '@/components/RubricLabel'
import Highlight from '@/components/Highlight'
import Pagination from '@/components/Pagination'
import type { Pool } from 'pg'

interface SearchRow {
  id: number
  title: string
  slug: string
  lead: string
  published_at: string | null
  rubric_slug: string
  rubric_title: string
}

const PERIODS = [
  { key: 'day', label: 'За добу', hours: 24 },
  { key: 'week', label: 'За тиждень', hours: 24 * 7 },
  { key: 'month', label: 'За місяць', hours: 24 * 30 },
  { key: 'all', label: 'Увесь час', hours: null },
] as const

const PAGE_SIZE = 20

// tech-spec.md §8: internal search is never indexed, even once the site is otherwise indexable.
export const metadata: Metadata = { robots: thinPageRobotsMeta() }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubric?: string; period?: string; page?: string }>
}) {
  const { q, rubric, period, page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const activePeriod = PERIODS.find((p) => p.key === period) ?? PERIODS[1]
  const payload = await getPayloadClient()

  let results: SearchRow[] = []
  let total = 0
  if (q && q.trim()) {
    const pool = (payload.db as unknown as { pool: Pool }).pool
    const conditions = [`articles.status = 'published'`, `articles.search_vector @@ plainto_tsquery('simple', unaccent($1))`]
    const values: (string | number)[] = [q]
    if (rubric) {
      values.push(rubric)
      conditions.push(`rubrics.slug = $${values.length}`)
    }
    if (activePeriod.hours) {
      values.push(new Date(Date.now() - activePeriod.hours * 60 * 60 * 1000).toISOString())
      conditions.push(`articles.published_at >= $${values.length}`)
    }
    const where = conditions.join(' and ')

    const countResult = await pool.query<{ n: string }>(
      `select count(*)::text as n from articles join rubrics on rubrics.id = articles.rubric_id where ${where}`,
      values,
    )
    total = Number(countResult.rows[0]?.n ?? 0)

    const offset = (pageNum - 1) * PAGE_SIZE
    values.push(PAGE_SIZE, offset)
    const { rows } = await pool.query<SearchRow>(
      `select articles.id, articles.title, articles.slug, articles.lead, articles.published_at,
              rubrics.slug as rubric_slug, rubrics.title as rubric_title
       from articles
       join rubrics on rubrics.id = articles.rubric_id
       where ${where}
       order by articles.published_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    )
    results = rows
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { q, rubric, period: activePeriod.key, ...overrides }
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v)
    return `/search?${params.toString()}`
  }

  return (
    <div className="container">
      <section className="search-hero">
        <h1 className="phead__title" style={{ fontSize: 'var(--fs-36)' }}>Пошук</h1>
        <form role="search" method="get" action="/search">
          <div className="field">
            <label className="sr-only" htmlFor="q">Пошуковий запит</label>
            <input className="input" id="q" name="q" type="search" defaultValue={q} placeholder="Пошук новин..." />
            <input type="hidden" name="period" value={activePeriod.key} />
            <button className="btn" type="submit">Знайти</button>
          </div>
          <div className="filters">
            <select className="select" name="rubric" defaultValue={rubric ?? ''} aria-label="Фільтр за рубрикою">
              <option value="">Усі рубрики</option>
              {RUBRICS_CONFIG.map((r) => (
                <option key={r.slug} value={r.slug}>{r.title}</option>
              ))}
            </select>
            <ul className="chips" aria-label="Період">
              {PERIODS.map((p) => (
                <li key={p.key}>
                  <Link className="chip" href={qs({ period: p.key })} aria-pressed={activePeriod.key === p.key}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </form>
        {q ? (
          <p className="results-count">
            {total > 0 ? `Знайдено ${total} матеріал${total === 1 ? '' : 'ів'} за запитом «${q}»` : `За запитом «${q}» нічого не знайдено`}
          </p>
        ) : null}
      </section>

      <div className="listing-layout">
        <div className="listing">
          <ul className="list">
            {results.map((a) => (
              <li className="list__item" key={a.id} data-r={a.rubric_slug}>
                <Cover rubricSlug={a.rubric_slug} />
                <div className="meta-row">
                  <RubricLabel slug={a.rubric_slug} title={a.rubric_title} />
                  <span className="meta">
                    <time dateTime={a.published_at ?? undefined}>{formatFeedTime(a.published_at)}</time>
                  </span>
                </div>
                <h3 className="hl hl--card">
                  <Link href={articlePath(a.rubric_slug, a.slug)}>
                    <Highlight text={a.title} query={q ?? ''} />
                  </Link>
                </h3>
                <p className="list__excerpt">
                  <Highlight text={a.lead} query={q ?? ''} />
                </p>
              </li>
            ))}
          </ul>
          {q && results.length === 0 ? (
            <div className="empty">
              <h3>За запитом «{q}» нічого не знайдено</h3>
              <p>Перевірте написання або спробуйте коротший запит. Можна також обрати рубрику.</p>
              <Link className="btn btn--secondary" href="/search">Скинути фільтри</Link>
            </div>
          ) : null}
          <Pagination current={pageNum} total={totalPages} basePath={(p) => qs({ page: String(p) })} />
        </div>
        <aside className="rail">
          <section>
            <div className="section__head">
              <h2 className="section__title">Рубрики</h2>
            </div>
            <ul className="chips">
              {RUBRICS_CONFIG.slice(0, 8).map((r) => (
                <li key={r.slug}>
                  <Link className="chip" href={rubricPath(r.slug)}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
