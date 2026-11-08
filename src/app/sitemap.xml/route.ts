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

  // Only canonical, indexable (page 1) rubric hubs + articles — never tags
  // (thin until TAG_NOINDEX_THRESHOLD) or pagination page 2+ (tech-spec.md §5).
  const urls = [
    `<url><loc>${SITE_URL}/</loc></url>`,
    ...rubrics.docs.map((r) => `<url><loc>${absoluteUrl(rubricPath(r.slug!))}</loc></url>`),
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
