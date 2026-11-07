import { getPayloadClient } from '@/lib/payload'
import { SITE_URL, NOINDEX } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayloadClient()
  const [articles, rubrics] = await Promise.all([
    payload.find({ collection: 'articles', where: { status: { equals: 'published' } }, limit: 1000 }),
    payload.find({ collection: 'rubrics', limit: 100 }),
  ])

  const urls = [
    `<url><loc>${SITE_URL}/</loc></url>`,
    ...rubrics.docs.map((r: any) => `<url><loc>${SITE_URL}/rubrics/${r.slug}</loc></url>`),
    ...articles.docs.map(
      (a: any) => `<url><loc>${SITE_URL}/articles/${a.slug}</loc><lastmod>${a.updated_at || a.published_at}</lastmod></url>`,
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
