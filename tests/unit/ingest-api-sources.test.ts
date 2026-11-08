import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { mapProzorroTenderToItem, fetchProzorroItems, type ProzorroTenderDetail } from '@/lib/ingest/apiSources/prozorro'
import { mapNbuRatesToItem, fetchNbuItems, type NbuRate } from '@/lib/ingest/apiSources/nbu'
import { mapCkanPackageToItem, fetchCkanItems, type CkanPackage } from '@/lib/ingest/apiSources/ckan'
import { getApiAdapter } from '@/lib/ingest/apiSources'

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf-8')) as T
}

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as Response
}

describe('getApiAdapter registry', () => {
  it('resolves the three FACT-195 adapters by source_key and nothing else', () => {
    expect(getApiAdapter('prozorro_tenders_api')).toBeTypeOf('function')
    expect(getApiAdapter('nbu_exchange_api')).toBeTypeOf('function')
    expect(getApiAdapter('data_gov_ua_ckan')).toBeTypeOf('function')
    expect(getApiAdapter('eurostat_api')).toBeUndefined()
  })
})

describe('Prozorro: mapProzorroTenderToItem (fixture)', () => {
  it('builds a title/url/summary from a real tender-detail shape', () => {
    const { data: tender } = fixture<{ data: ProzorroTenderDetail }>('prozorro-tender.json')
    const item = mapProzorroTenderToItem(tender)
    expect(item.title).toBe(tender.title)
    expect(item.url).toBe('https://prozorro.gov.ua/tender/UA-2026-11-08-000600-a')
    expect(item.summary).toContain('КП "Міськсвітло"')
    expect(item.summary).toContain('UAH')
    expect(item.publishedAt).toBe(tender.dateModified)
  })

  it('falls back to a tenderID-based title when the tender has none', () => {
    const item = mapProzorroTenderToItem({ tenderID: 'UA-X', dateModified: '2026-01-01T00:00:00Z' })
    expect(item.title).toBe('Тендер UA-X')
    expect(item.summary).toBeNull()
  })
})

describe('Prozorro: fetchProzorroItems (mocked HTTP, real response shapes)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('paginates the list then fetches one detail per tender, rate-limited', async () => {
    const tenderFixture = fixture<{ data: ProzorroTenderDetail }>('prozorro-tender.json')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'abc123', dateModified: tenderFixture.data.dateModified }] }))
      .mockResolvedValueOnce(jsonResponse(tenderFixture))
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchProzorroItems()
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.status).toBe('ok')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].url).toBe('https://prozorro.gov.ua/tender/UA-2026-11-08-000600-a')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/tenders?descending=1&limit=')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/tenders/abc123')
  })

  it('surfaces an error without throwing when the list endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }))
    const promise = fetchProzorroItems()
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.status).toBe('error')
    expect(result.items).toEqual([])
  })
})

describe('NBU: mapNbuRatesToItem (fixture)', () => {
  it('builds one dated headline item from the day\'s full rate list', () => {
    const rates = fixture<NbuRate[]>('nbu-exchange.json')
    const item = mapNbuRatesToItem(rates)!
    expect(item.title).toContain('09.11.2026')
    expect(item.title).toContain('USD — 42.1234 ₴')
    expect(item.title).toContain('EUR — 45.6789 ₴')
    expect(item.summary).toContain('GBP (Фунт стерлінгів): 53.1')
    expect(item.publishedAt).toBe(new Date('2026-11-09T00:00:00Z').toISOString())
  })

  it('returns null for an empty rate list instead of a bogus item', () => {
    expect(mapNbuRatesToItem([])).toBeNull()
  })
})

describe('NBU: fetchNbuItems (mocked HTTP)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('wraps the mapped item in an ok result', async () => {
    const rates = fixture<NbuRate[]>('nbu-exchange.json')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rates)))
    const result = await fetchNbuItems()
    expect(result.status).toBe('ok')
    expect(result.items).toHaveLength(1)
  })
})

describe('CKAN: mapCkanPackageToItem (fixture)', () => {
  it('maps a dataset to a dated item pointing at its data.gov.ua page', () => {
    const { result } = fixture<{ result: { results: CkanPackage[] } }>('ckan-package-search.json')
    const item = mapCkanPackageToItem(result.results[0])
    expect(item.url).toBe('https://data.gov.ua/dataset/00a6c5c6-ff57-406c-a6e5-795acbaca5c3')
    expect(item.title).toContain('зареєстровані транспортні засоби')
    expect(item.publishedAt).toBe('2026-10-20T08:54:00.273838')
  })
})

describe('CKAN: fetchCkanItems (mocked HTTP, real search-response shape)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps only the MVS-published dataset out of the search results', async () => {
    const searchResponse = fixture('ckan-package-search.json')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(searchResponse)))
    const result = await fetchCkanItems()
    expect(result.status).toBe('ok')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].url).toContain('00a6c5c6-ff57-406c-a6e5-795acbaca5c3')
  })
})
