export interface FetchFeedResult {
  status: 'ok' | 'not_modified' | 'error'
  body?: string
  etag?: string | null
  lastModified?: string | null
  error?: string
  /** HTTP status of the response that produced this result; absent on a network-level failure (no response). */
  httpStatus?: number
}

const USER_AGENT = 'NewsroomSandboxBot/1.0 (+https://bigear.uk; sandbox, human-reviewed, no auto-publish)'

/** GET with ETag/If-Modified-Since + exponential backoff retry (3 attempts). */
export async function fetchFeed(
  url: string,
  opts: { etag?: string | null; lastModified?: string | null },
): Promise<FetchFeedResult> {
  const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }
  if (opts.etag) headers['if-none-match'] = opts.etag
  if (opts.lastModified) headers['if-modified-since'] = opts.lastModified

  let lastError = ''
  let lastStatus: number | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
      lastStatus = res.status
      if (res.status === 304) {
        return { status: 'not_modified', httpStatus: res.status, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') }
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break // not retryable
      } else {
        const body = await res.text()
        return { status: 'ok', httpStatus: res.status, body, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    await sleep(2 ** attempt * 1000)
  }
  return { status: 'error', httpStatus: lastStatus, error: lastError || 'unknown fetch error' }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
