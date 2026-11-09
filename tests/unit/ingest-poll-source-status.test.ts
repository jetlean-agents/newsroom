import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FACT-345: pollSource must write last_http_status/last_fetched/last_stored
 * and the 24h/7d item counters on the `sources` doc on every poll outcome —
 * success, not_modified, error and robots-blocked alike.
 */

const mockUpdate = vi.fn()
const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockCount = vi.fn()

vi.mock('@/lib/payload', () => ({
  getPayloadClient: () => ({
    update: mockUpdate,
    find: mockFind,
    create: mockCreate,
    count: mockCount,
  }),
}))

vi.mock('@/lib/ingest/robots', () => ({
  isAllowedByRobots: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/ingest/fetchFeed', () => ({
  fetchFeed: vi.fn(),
}))

import { pollSource } from '@/jobs/ingest/pollSource'
import { fetchFeed } from '@/lib/ingest/fetchFeed'
import { isAllowedByRobots } from '@/lib/ingest/robots'
import type { Source } from '@/payload-types'

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    source_key: 'outlet-a',
    name: 'Outlet A',
    type: 'rss',
    registry_status: 'verified',
    url: 'https://outlet-a.example/feed.xml',
    enabled: true,
    consecutive_errors: 0,
    updatedAt: '2026-11-09T00:00:00.000Z',
    createdAt: '2026-11-09T00:00:00.000Z',
    ...overrides,
  } as Source
}

beforeEach(() => {
  mockUpdate.mockReset().mockResolvedValue({})
  mockFind.mockReset().mockResolvedValue({ docs: [] })
  mockCreate.mockReset().mockResolvedValue({})
  mockCount.mockReset().mockResolvedValue({ totalDocs: 0 })
  vi.mocked(isAllowedByRobots).mockReset().mockResolvedValue(true)
  vi.mocked(fetchFeed).mockReset()
})

describe('pollSource: status + recent-count fields (FACT-345)', () => {
  it('on a successful fetch, records HTTP status, fetched/stored counts and the 24h/7d counters', async () => {
    mockCount.mockResolvedValueOnce({ totalDocs: 3 }).mockResolvedValueOnce({ totalDocs: 9 })
    vi.mocked(fetchFeed).mockResolvedValue({
      status: 'ok',
      httpStatus: 200,
      body: '<rss><channel><item><title>T</title><link>https://outlet-a.example/a</link></item></channel></rss>',
      etag: 'abc',
      lastModified: null,
    })

    const result = await pollSource(makeSource())

    expect(result.fetched).toBe(1)
    expect(result.stored).toBe(1)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.last_http_status).toBe(200)
    expect(data.last_fetched).toBe(1)
    expect(data.last_stored).toBe(1)
    expect(data.items_24h).toBe(3)
    expect(data.items_7d).toBe(9)
  })

  it('on a transport error, still writes last_http_status/last_fetched/last_stored plus the counters', async () => {
    mockCount.mockResolvedValueOnce({ totalDocs: 0 }).mockResolvedValueOnce({ totalDocs: 2 })
    vi.mocked(fetchFeed).mockResolvedValue({ status: 'error', httpStatus: 503, error: 'HTTP 503' })

    const result = await pollSource(makeSource())

    expect(result.error).toBe('HTTP 503')
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.last_http_status).toBe(503)
    expect(data.last_fetched).toBe(0)
    expect(data.last_stored).toBe(0)
    expect(data.items_24h).toBe(0)
    expect(data.items_7d).toBe(2)
  })

  it('on a network-level error with no response, writes last_http_status as null rather than throwing', async () => {
    vi.mocked(fetchFeed).mockResolvedValue({ status: 'error', error: 'timeout' })

    const result = await pollSource(makeSource())

    expect(result.error).toBe('timeout')
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.last_http_status).toBeNull()
  })

  it('on a 304 not-modified response, records the 304 status with zero fetched/stored', async () => {
    vi.mocked(fetchFeed).mockResolvedValue({ status: 'not_modified', httpStatus: 304 })

    const result = await pollSource(makeSource())

    expect(result.fetched).toBe(0)
    expect(result.stored).toBe(0)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.last_http_status).toBe(304)
    expect(data.last_fetched).toBe(0)
    expect(data.last_stored).toBe(0)
  })

  it('when robots.txt blocks the poll, writes a null status and still refreshes the 24h/7d counters', async () => {
    mockCount.mockResolvedValueOnce({ totalDocs: 5 }).mockResolvedValueOnce({ totalDocs: 11 })
    vi.mocked(isAllowedByRobots).mockResolvedValueOnce(false)

    const result = await pollSource(makeSource())

    expect(result.skipped).toBe('robots.txt disallow')
    expect(fetchFeed).not.toHaveBeenCalled()
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.last_http_status).toBeNull()
    expect(data.last_fetched).toBe(0)
    expect(data.last_stored).toBe(0)
    expect(data.items_24h).toBe(5)
    expect(data.items_7d).toBe(11)
  })
})
