import { getPayloadClient } from '@/lib/payload'
import { SITE_URL, SITE_NAME, NOINDEX } from '@/lib/env'

/** Google News sitemap: only articles published in the last 48h. */
export async function GET() {
  const payload = await getPayloadClient()
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const articles = await payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { published_at: { greater_than: since } }] },
    limit: 1000,
  })

  const urls = articles.docs.map(
    (a: any) => `<url>
  <loc>${SITE_URL}/articles/${a.slug}</loc>
  <news:news>
    <news:publication>
      <news:name>${SITE_NAME}</news:name>
      <news:language>uk</news:language>
    </news:publication>
    <news:publication_date>${a.published_at}</news:publication_date>
    <news:title>${escapeXml(a.title)}</news:title>
  </news:news>
</url>`,
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join('\n')}\n</urlset>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml',
      ...(NOINDEX ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  })
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
