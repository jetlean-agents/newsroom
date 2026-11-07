const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'yclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'from',
])

/**
 * Normalizes a URL so the same article reached via different tracking params,
 * casing, or a trailing slash still dedupes to one canonical string.
 */
export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.protocol = 'https:'

  const params = Array.from(url.searchParams.entries()).filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
  url.search = ''
  for (const [key, value] of params.sort(([a], [b]) => a.localeCompare(b))) {
    url.searchParams.append(key, value)
  }

  let pathname = url.pathname.replace(/\/+$/, '')
  if (pathname === '') pathname = '/'
  url.pathname = pathname

  return url.toString()
}
