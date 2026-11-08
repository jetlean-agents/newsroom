import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { NOINDEX } from '@/lib/env'
import { articlePath, tagPath, absoluteUrl } from '@/lib/urls'
import Breadcrumbs from '@/components/Breadcrumbs'

export const dynamic = 'force-dynamic'

async function getTag(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'tags', where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0] || null
}

/** tech-spec.md §8: tags below TAG_NOINDEX_THRESHOLD articles are noindex,follow. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return {}
  const url = absoluteUrl(tagPath(tag.slug!))
  return {
    title: `Тег: ${tag.title}`,
    alternates: { canonical: url },
    robots: NOINDEX ? 'noindex, nofollow' : tag.noindex ? 'noindex, follow' : 'index, follow',
  }
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) notFound()

  const payload = await getPayloadClient()
  const articles = await payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { tags: { in: [tag.id] } }] },
    sort: '-published_at',
    limit: 30,
    depth: 1,
  })

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: 'Головна', url: absoluteUrl('/') },
          { name: `Тег: ${tag.title}`, url: absoluteUrl(tagPath(tag.slug!)) },
        ]}
      />
      <h1>Тег: {tag.title}</h1>
      {tag.noindex ? (
        <p className="meta">Матеріалів поки замало для окремого індексування цього тегу ({tag.articleCount ?? 0}).</p>
      ) : null}

      {articles.docs.map((a) => {
        const rubricSlug = typeof a.rubric === 'object' ? a.rubric.slug : null
        return (
          <article key={a.id} className="feed-item">
            <h2>{rubricSlug ? <Link href={articlePath(rubricSlug, a.slug!)}>{a.title}</Link> : a.title}</h2>
            <p className="meta">{a.published_at ? new Date(a.published_at).toLocaleString('uk-UA') : ''}</p>
          </article>
        )
      })}
    </div>
  )
}
