import { getPayloadClient } from '@/lib/payload'
import { SITE_URL, NOINDEX } from '@/lib/env'
import { articlePath, rubricPath, absoluteUrl } from '@/lib/urls'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayloadClient()
  const [articles, rubrics] = await Promise.all([
    payload.find({ collection: 'articles', where: { status: { equals: 'published' } }, limit: 1000, depth: 1 }),
    payload.find({ collection: 'rubrics', limit: 100 }),
  ])

  // FACT-382 AC1: a rubric with zero published articles (e.g. "bez-rubryky" —
  // the FACT-382 /review holding pen, or any other rubric that just hasn't
  // been drafted into yet) has nothing to show at its hub URL and must not be
  // listed — the hub page itself answers `noindex` for the same reason (see
  // [rubric]/page.tsx generateMetadata).
  //
  // FACT-382 PO review (PR #31): counted per rubric via `payload.count`
  // (only 12 rubrics) rather than derived from the `articles` list above,
  // which is capped at 1000 — a rubric whose only published articles are
  // older than the newest 1000 across the whole site would otherwise drop
  // out of the sitemap even though it isn't actually empty.
  const rubricCounts = await Promise.all(
    rubrics.docs.map((r) =>
      payload.count({ collection: 'articles', where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: r.id } }] } }),
    ),
  )
  const nonEmptyRubrics = rubrics.docs.filter((_, i) => rubricCounts[i].totalDocs > 0)

  // Only canonical, indexable (page 1) rubric hubs + articles — never tags
  // (thin until TAG_NOINDEX_THRESHOLD) or pagination page 2+ (tech-spec.md §5).
  const urls = [
    `<url><loc>${SITE_URL}/</loc></url>`,
    ...nonEmptyRubrics.map((r) => `<url><loc>${absoluteUrl(rubricPath(r.slug!))}</loc></url>`),
    ...articles.docs
      .filter((a) => typeof a.rubric === 'object')
      .map(
        (a) =>
          `<url><loc>${absoluteUrl(articlePath((a.rubric as { slug: string }).slug, a.slug!))}</loc><lastmod>${a.updated_at || a.published_at}</lastmod></url>`,
      ),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml',
      ...(NOINDEX ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  })
}
