const cache = new Map<string, string[]>()

async function getDisallowedPaths(origin: string): Promise<string[]> {
  if (cache.has(origin)) return cache.get(origin)!
  let disallowed: string[] = []
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const body = await res.text()
      let applies = false
      for (const line of body.split('\n')) {
        const trimmed = line.trim()
        if (/^user-agent:\s*\*/i.test(trimmed)) applies = true
        else if (/^user-agent:/i.test(trimmed)) applies = false
        else if (applies && /^disallow:/i.test(trimmed)) {
          const value = trimmed.split(':').slice(1).join(':').trim()
          if (value) disallowed.push(value)
        }
      }
    }
  } catch {
    // Unreachable robots.txt doesn't block a feed fetch — treat as "no rule found".
    disallowed = []
  }
  cache.set(origin, disallowed)
  return disallowed
}

/** Best-effort robots.txt check: skip polling a feed path explicitly disallowed for "*". */
export async function isAllowedByRobots(feedUrl: string): Promise<boolean> {
  const url = new URL(feedUrl)
  const disallowed = await getDisallowedPaths(url.origin)
  return !disallowed.some((rule) => url.pathname.startsWith(rule))
}
