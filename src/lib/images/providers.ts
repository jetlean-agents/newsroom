export interface ImageCandidate {
  url: string
  credit: string
  author?: string
  license: string
  license_url?: string
  source_url: string
}

export interface ImageProvider {
  name: string
  enabled: boolean
  search(query: string): Promise<ImageCandidate[]>
}

/**
 * Unsplash/Pexels require an API key (FACT-169 scope item 5: "без платного
 * ключа; если ключ нужен — заглушка + ENV имя"); without one, the provider is
 * just disabled rather than failing, so Media creation always falls back to
 * manual upload.
 */
function unsplashProvider(): ImageProvider {
  const key = process.env.UNSPLASH_ACCESS_KEY
  return {
    name: 'unsplash',
    enabled: !!key,
    async search(query) {
      if (!key) return []
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`, {
        headers: { Authorization: `Client-ID ${key}` },
      })
      if (!res.ok) return []
      const data = (await res.json()) as { results: Array<Record<string, unknown>> }
      return data.results.map((r) => ({
        url: String((r.urls as Record<string, string>).regular),
        credit: String((r.user as Record<string, string>).name),
        license: 'Unsplash License',
        license_url: 'https://unsplash.com/license',
        source_url: String((r.links as Record<string, string>).html),
      }))
    },
  }
}

function pexelsProvider(): ImageProvider {
  const key = process.env.PEXELS_API_KEY
  return {
    name: 'pexels',
    enabled: !!key,
    async search(query) {
      if (!key) return []
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`, {
        headers: { Authorization: key },
      })
      if (!res.ok) return []
      const data = (await res.json()) as { photos: Array<Record<string, unknown>> }
      return data.photos.map((p) => ({
        url: String((p.src as Record<string, string>).large),
        credit: String(p.photographer),
        license: 'Pexels License',
        license_url: 'https://www.pexels.com/license/',
        source_url: String(p.url),
      }))
    },
  }
}

/** Wikimedia Commons needs no API key — only the registry's CC attribution rules apply. */
function wikimediaProvider(): ImageProvider {
  return {
    name: 'wikimedia',
    enabled: true,
    async search(query) {
      const res = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&format=json`,
        { headers: { 'user-agent': 'NewsroomSandboxBot/1.0 (+https://bigear.uk)' } },
      )
      if (!res.ok) return []
      const data = (await res.json()) as { query?: { pages?: Record<string, Record<string, unknown>> } }
      const pages = Object.values(data.query?.pages ?? {})
      return pages
        .map((page) => {
          const info = (page.imageinfo as Array<Record<string, unknown>> | undefined)?.[0]
          if (!info) return null
          const meta = info.extmetadata as Record<string, { value: string }> | undefined
          return {
            url: String(info.url),
            credit: meta?.Artist?.value ?? 'Wikimedia Commons',
            license: meta?.LicenseShortName?.value ?? 'see source',
            source_url: String(info.descriptionurl ?? info.url),
          }
        })
        .filter((c): c is ImageCandidate => c !== null)
    },
  }
}

export function getImageProviders(): ImageProvider[] {
  return [unsplashProvider(), pexelsProvider(), wikimediaProvider()]
}
