const USER_AGENT = 'NewsroomSandboxBot/1.0 (+https://bigear.uk; sandbox, human-reviewed, no auto-publish)'

export interface HttpJsonResult<T> {
  status: 'ok' | 'error'
  data?: T
  error?: string
  /** HTTP status of the response that produced this result; absent on a network-level failure (no response). */
  httpStatus?: number
}

/** GET+parse JSON with the same retry/backoff shape as `fetchFeed` (3 attempts, no retry on non-429 4xx). */
export async function fetchJson<T>(url: string): Promise<HttpJsonResult<T>> {
  let lastError = ''
  let lastStatus: number | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      lastStatus = res.status
      if (!res.ok) {
        lastError = `HTTP ${res.status}`
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break
      } else {
        return { status: 'ok', httpStatus: res.status, data: (await res.json()) as T }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    await sleep(2 ** attempt * 1000)
  }
  return { status: 'error', httpStatus: lastStatus, error: lastError || 'unknown fetch error' }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
