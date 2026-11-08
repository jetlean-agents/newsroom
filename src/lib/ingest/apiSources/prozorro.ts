import { fetchJson, sleep } from './httpJson'
import type { ApiFetchResult, ApiItem } from './types'

const TENDERS_LIST_URL = 'https://public.api.openprocurement.org/api/2.5/tenders?descending=1&limit='
const TENDER_DETAIL_URL = 'https://public.api.openprocurement.org/api/2.5/tenders/'

/** Registry rate_limit note: "офиц. рекомендация: не чаще 1 запрос/сек". */
const RATE_LIMIT_DELAY_MS = 1000
/**
 * The list endpoint only returns `{id, dateModified}` (no title) — getting a
 * publishable headline needs one detail GET per tender. Capped low per poll
 * so a 5-minute cadence never queues more 1-req/sec detail calls than it has
 * time for.
 */
const MAX_TENDERS_PER_POLL = 10

export interface ProzorroTenderListEntry {
  id: string
  dateModified: string
}

export interface ProzorroTenderDetail {
  tenderID: string
  title?: string
  title_en?: string
  dateModified: string
  procuringEntity?: { name?: string }
  value?: { amount?: number; currency?: string }
}

/** Pure mapper (fixture-tested): one tender detail -> one SourceItem-shaped row. */
export function mapProzorroTenderToItem(tender: ProzorroTenderDetail): ApiItem {
  const amount = tender.value?.amount
  const currency = tender.value?.currency
  const entity = tender.procuringEntity?.name
  const parts = [entity, amount != null && currency ? `${amount.toLocaleString('uk-UA')} ${currency}` : null].filter(Boolean)

  return {
    title: tender.title || tender.title_en || `Тендер ${tender.tenderID}`,
    url: `https://prozorro.gov.ua/tender/${tender.tenderID}`,
    publishedAt: tender.dateModified ?? null,
    summary: parts.length ? parts.join(' — ') : null,
  }
}

async function fetchTenderDetail(id: string): Promise<ProzorroTenderDetail | null> {
  const res = await fetchJson<{ data: ProzorroTenderDetail }>(`${TENDER_DETAIL_URL}${id}`)
  return res.status === 'ok' ? (res.data?.data ?? null) : null
}

/**
 * Prozorro (openprocurement) tenders feed: paginates the most recently
 * modified tenders (`descending=1`), then fetches a bounded number of
 * details one at a time with a 1s delay between requests per the registry's
 * rate-limit note.
 */
export async function fetchProzorroItems(): Promise<ApiFetchResult> {
  const list = await fetchJson<{ data: ProzorroTenderListEntry[] }>(`${TENDERS_LIST_URL}${MAX_TENDERS_PER_POLL}`)
  if (list.status === 'error') return { status: 'error', items: [], error: list.error }

  const entries = list.data?.data ?? []
  const items: ApiItem[] = []

  for (const entry of entries) {
    const detail = await fetchTenderDetail(entry.id)
    if (detail) items.push(mapProzorroTenderToItem(detail))
    await sleep(RATE_LIMIT_DELAY_MS)
  }

  return { status: 'ok', items }
}
