import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { SITE_NAME, SITE_URL, NOINDEX } from '@/lib/env'
import { articlePath, rubricPath } from '@/lib/urls'
import { organizationJsonLd } from '@/lib/jsonld'
import { RUBRIC_SLUGS } from '@/lib/rubricsConfig'
import type { Rubric } from '@/payload-types'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: SITE_URL },
    robots: NOINDEX ? 'noindex, nofollow' : 'index, follow',
    openGraph: { title: SITE_NAME, url: SITE_URL, type: 'website', locale: 'uk_UA', siteName: SITE_NAME },
  }
}

export default async function HomePage() {
  const payload = await getPayloadClient()

  const [featured, feed, popular, rubrics] = await Promise.all([
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
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-page_views',
      limit: 5,
      depth: 1,
    }),
    // Only the 12 canonical rubrics (Roman's 08.11 decision) in nav/home blocks — never
    // the ingestion pipeline's `bez-rubryky` fallback bucket (src/jobs/ingest/draftFromEvent.ts).
    payload.find({ collection: 'rubrics', where: { slug: { in: RUBRIC_SLUGS as string[] } }, limit: 50 }),
  ])

  // Keep the config's editorial order, not whatever order the DB happens to return.
  const orderedRubrics = [...rubrics.docs].sort(
    (a: Rubric, b: Rubric) => RUBRIC_SLUGS.indexOf(a.slug!) - RUBRIC_SLUGS.indexOf(b.slug!),
  )

  // Rubric blocks: a few latest articles per rubric, below the main feed.
  const rubricBlocks = await Promise.all(
    orderedRubrics.map(async (r) => {
      const res = await payload.find({
        collection: 'articles',
        where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: r.id } }] },
        sort: '-published_at',
        limit: 4,
        depth: 0,
      })
      return { rubric: r, articles: res.docs }
    }),
  )

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />

      <nav className="rubric-nav">
        {orderedRubrics.map((r) => (
          <Link key={r.id} href={rubricPath(r.slug!)}>{r.title}</Link>
        ))}
      </nav>

      {featured.docs.length ? (
        <section className="featured-block">
          <h1>Головне</h1>
          {featured.docs.map((a) => {
            const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
            return (
              <article key={a.id} className="feed-item">
                <h2>{rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}</h2>
                <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
              </article>
            )
          })}
        </section>
      ) : null}

      <section>
        <h2>Останні новини</h2>
        {feed.docs.map((a) => {
          const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
          const rubricTitle = typeof a.rubric === 'object' ? a.rubric.title : ''
          return (
            <article key={a.id} className="feed-item">
              <h3>
                {rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}
                {a.ai_assisted ? <span className="demo-badge">AI-допомога</span> : null}
              </h3>
              <p>{a.lead}</p>
              <p className="meta">
                {rubricTitle} · {a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}
              </p>
            </article>
          )
        })}
      </section>

      {rubricBlocks.filter((b) => b.articles.length).map(({ rubric, articles }) => (
        <section key={rubric.id} className="rubric-block">
          <h2><Link href={rubricPath(rubric.slug!)}>{rubric.title}</Link></h2>
          <ul>
            {articles.map((a) => (
              <li key={a.id}><Link href={articlePath(rubric.slug!, a.slug!)}>{a.title}</Link></li>
            ))}
          </ul>
        </section>
      ))}

      <aside>
        <h2>Популярне</h2>
        <ul>
          {popular.docs.map((a) => {
            const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
            return (
              <li key={a.id}>{rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}</li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
