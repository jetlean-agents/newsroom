import { fetchProzorroItems } from './prozorro'
import { fetchNbuItems } from './nbu'
import { fetchCkanItems } from './ckan'
import type { ApiFetchResult } from './types'

export type { ApiFetchResult, ApiItem } from './types'

/**
 * `type: api` entries in config/sources.yaml that have a source-specific
 * parser implemented. Keyed by `source_key` (the registry's `id`). A
 * `type: api` source not listed here (e.g. `eurostat_api`) still gets
 * registered and polled-for-dispatch like any other source, but
 * `pollSource()` reports it `skipped` until an adapter lands.
 */
const API_ADAPTERS: Record<string, () => Promise<ApiFetchResult>> = {
  prozorro_tenders_api: fetchProzorroItems,
  nbu_exchange_api: fetchNbuItems,
  data_gov_ua_ckan: fetchCkanItems,
}

export function getApiAdapter(sourceKey: string): (() => Promise<ApiFetchResult>) | undefined {
  return API_ADAPTERS[sourceKey]
}
