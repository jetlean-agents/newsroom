import { fetchJson } from './httpJson'
import type { ApiFetchResult, ApiItem } from './types'

const PACKAGE_SEARCH_URL = 'https://data.gov.ua/api/3/action/package_search'

/**
 * Registry notes (FACT-167/FACT-195): the MVS vehicle-registrations dataset
 * has no stable id confirmed in config/sources.yaml — `package_show` by the
 * id guessed during registry verification returned 404. Searching by query
 * every poll (rather than hardcoding an id) survives the dataset being
 * renamed/recreated on data.gov.ua, which CKAN portals do periodically.
 */
const CKAN_QUERIES: Array<{ q: string; orgIncludes?: string; rows: number }> = [
  { q: 'зареєстровані транспортні засоби', orgIncludes: 'МВС', rows: 20 },
]

export interface CkanPackage {
  id: string
  name: string
  title: string
  notes?: string | null
  metadata_modified: string
  organization?: { title?: string } | null
}

interface CkanSearchResponse {
  success: boolean
  result: { count: number; results: CkanPackage[] }
}

/** Pure mapper (fixture-tested): one CKAN dataset -> one SourceItem-shaped row. */
export function mapCkanPackageToItem(pkg: CkanPackage): ApiItem {
  return {
    title: pkg.title,
    url: `https://data.gov.ua/dataset/${pkg.name}`,
    publishedAt: pkg.metadata_modified ?? null,
    summary: pkg.notes ? pkg.notes.slice(0, 500) : null,
  }
}

function searchUrl(q: string, rows: number): string {
  return `${PACKAGE_SEARCH_URL}?q=${encodeURIComponent(q)}&rows=${rows}`
}

/**
 * CKAN (data.gov.ua) `package_search`: no auth, CC BY reuse. We search by
 * keyword instead of a fixed dataset id (see note above) and keep only
 * results from the matching publisher to avoid pulling in unrelated
 * municipal datasets that happen to share the same keywords. Deliberately
 * left on CKAN's default relevance sort (`score desc`) rather than
 * `metadata_modified desc` — the latter buries the one MVS dataset we want
 * under unrelated municipal datasets that happen to get re-saved more often.
 */
export async function fetchCkanItems(): Promise<ApiFetchResult> {
  const items: ApiItem[] = []

  for (const query of CKAN_QUERIES) {
    const res = await fetchJson<CkanSearchResponse>(searchUrl(query.q, query.rows))
    if (res.status === 'error') return { status: 'error', items: [], error: res.error }

    const results = res.data?.result?.results ?? []
    const matches = query.orgIncludes ? results.filter((pkg) => pkg.organization?.title?.includes(query.orgIncludes!)) : results
    items.push(...matches.map(mapCkanPackageToItem))
  }

  return { status: 'ok', items }
}
