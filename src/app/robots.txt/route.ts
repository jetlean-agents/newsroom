import { NOINDEX, SITE_URL } from '@/lib/env'

export async function GET() {
  const body = NOINDEX
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`

  return new Response(body, {
    headers: {
      'content-type': 'text/plain',
      ...(NOINDEX ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  })
}
