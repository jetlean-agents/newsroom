import { SITE_URL, SITE_NAME, NOINDEX } from './env'
import { articlePath, absoluteUrl } from './urls'
import type { Article, Rubric } from '@/payload-types'

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildRssFeed(
  articles: (Article & { rubric: Rubric | number })[],
  opts: { title: string; link: string; description: string },
): string {
  const items = articles
    .filter((a) => typeof a.rubric === 'object')
    .map((a) => {
      const url = absoluteUrl(articlePath((a.rubric as Rubric).slug!, a.slug!))
      return `<item>
  <title>${escapeXml(a.title)}</title>
  <link>${url}</link>
  <guid>${url}</guid>
  <pubDate>${new Date(a.published_at ?? Date.now()).toUTCString()}</pubDate>
  <description>${escapeXml(a.lead)}</description>
</item>`
    })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(opts.title)}</title>
<link>${opts.link}</link>
<description>${escapeXml(opts.description)}</description>
${items.join('\n')}
</channel></rss>`
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml',
      ...(NOINDEX ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  })
}

export const DEFAULT_FEED_TITLE = SITE_NAME
export const DEFAULT_FEED_LINK = SITE_URL
