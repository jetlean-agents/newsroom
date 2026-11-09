import { fetchJson } from './httpJson'
import type { ApiFetchResult, ApiItem } from './types'

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'

/** Currencies worth a headline; the full list (~50 codes) goes into the summary instead. */
const HEADLINE_CURRENCIES = ['USD', 'EUR', 'PLN']

export interface NbuRate {
  r030: number
  txt: string
  rate: number
  cc: string
  exchangedate: string // "DD.MM.YYYY"
}

function ddmmyyyyToIso(date: string): string | null {
  const match = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).toISOString()
}

/**
 * Pure mapper (fixture-tested): the day's full rate list -> a single
 * SourceItem-shaped row. One item per calendar date — `url` is date-keyed so
 * re-polling the same day dedupes via the generic `source_key::canonical_url`
 * identity hash instead of creating a new row per poll.
 */
export function mapNbuRatesToItem(rates: NbuRate[]): ApiItem | null {
  if (rates.length === 0) return null

  const date = rates[0].exchangedate
  const isoDate = ddmmyyyyToIso(date)
  const headline = HEADLINE_CURRENCIES.map((cc) => rates.find((r) => r.cc === cc)).filter((r): r is NbuRate => !!r)

  return {
    title: `Офіційний курс НБУ на ${date}: ${headline.map((r) => `${r.cc} — ${r.rate.toFixed(4)} ₴`).join(', ')}`,
    url: `${NBU_URL}&date=${date.replace(/\./g, '')}`,
    publishedAt: isoDate,
    summary: rates.map((r) => `${r.cc} (${r.txt}): ${r.rate}`).join('; '),
  }
}

/** НБУ official exchange rates (NBUStatService): one JSON array, no pagination, polled at most hourly per the registry. */
export async function fetchNbuItems(): Promise<ApiFetchResult> {
  const res = await fetchJson<NbuRate[]>(NBU_URL)
  if (res.status === 'error') return { status: 'error', items: [], error: res.error, httpStatus: res.httpStatus }

  const item = mapNbuRatesToItem(res.data ?? [])
  return { status: 'ok', items: item ? [item] : [], httpStatus: res.httpStatus }
}
