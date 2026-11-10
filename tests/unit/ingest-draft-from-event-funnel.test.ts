import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FACT-362: events -> draft funnel counters. draftFromEvent() already
 * returns drafted/autoPublished/skippedBudget/skippedError/skippedSpendLimit/
 * skippedRubricCap every run (worker.ts now returns it so pg-boss persists it
 * as the job `output` — see ingestStatus.ts); these tests pin down the
 * counting logic itself, independent of any real database.
 */

const mockFind = vi.fn()
const mockCount = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/payload', () => ({
  getPayloadClient: () => ({
    find: mockFind,
    count: mockCount,
    create: mockCreate,
    update: mockUpdate,
  }),
}))

const mockGenerateDraft = vi.fn()
const mockGetDraftProvider = vi.fn()

vi.mock('@/lib/ai/draftProvider', () => ({
  getDraftProvider: () => mockGetDraftProvider(),
}))

const mockSpendLimitReached = vi.fn()
vi.mock('@/lib/ai/spendGuard', () => ({
  spendLimitReached: () => mockSpendLimitReached(),
}))

vi.mock('@/lib/ai/originality', () => ({ maxOverlap: vi.fn().mockReturnValue(0) }))
vi.mock('@/lib/ai/factCheck', () => ({ factCheckFlags: vi.fn().mockReturnValue([]) }))

vi.mock('@/lib/env', () => ({
  ORIGINALITY_MAX_OVERLAP: 0.5,
  DRAFTS_PER_DAY: 20,
  DRAFTS_PER_TICK: 20,
  AUTO_PUBLISH: false,
}))

import { draftFromEvent } from '@/jobs/ingest/draftFromEvent'

function makeEvent(id: number) {
  return { id, source_count: 1, first_seen_at: '2026-11-09T18:00:00.000Z', title: `Event ${id}` }
}

beforeEach(() => {
  mockFind.mockReset()
  mockCount.mockReset().mockResolvedValue({ totalDocs: 0 })
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockGetDraftProvider.mockReset().mockReturnValue({ name: 'anthropic', generateDraft: mockGenerateDraft })
  mockSpendLimitReached.mockReset().mockResolvedValue(false)
  mockGenerateDraft.mockReset()

  // draftsPerRubricToday() always queries 'articles' for the rubric breakdown;
  // every test here leaves it empty (no rubric cap exercised).
  mockFind.mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'articles') return Promise.resolve({ docs: [] })
    if (collection === 'events') return Promise.resolve({ docs: [] })
    return Promise.resolve({ docs: [] })
  })
})

describe('draftFromEvent funnel counters (FACT-362)', () => {
  it('counts skippedBudget and skips every event once the daily cap is already spent', async () => {
    mockCount.mockResolvedValue({ totalDocs: 20 }) // draftsCreatedToday() === DRAFTS_PER_DAY
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1), makeEvent(2)] })
      return Promise.resolve({ docs: [] })
    })

    const result = await draftFromEvent()

    expect(result.skippedBudget).toBe(2)
    expect(result.drafted).toBe(0)
    expect(mockGenerateDraft).not.toHaveBeenCalled()
  })

  it('counts skippedSpendLimit for the anthropic provider when the spend guard is tripped', async () => {
    mockSpendLimitReached.mockResolvedValue(true)
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1)] })
      return Promise.resolve({ docs: [] })
    })

    const result = await draftFromEvent()

    expect(result.skippedSpendLimit).toBe(1)
    expect(mockGenerateDraft).not.toHaveBeenCalled()
  })

  it('counts skippedError and groups failures by error message', async () => {
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1), makeEvent(2), makeEvent(3)] })
      if (collection === 'source-items') {
        return Promise.resolve({
          docs: [{ title: 'T', summary: 'S', url: 'https://x.test/a', source: { name: 'Outlet' }, published_at: '2026-11-09T18:00:00.000Z' }],
        })
      }
      return Promise.resolve({ docs: [] })
    })
    mockGenerateDraft
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockRejectedValueOnce(new Error('malformed response'))

    const result = await draftFromEvent()

    expect(result.skippedError).toBe(3)
    expect(result.skippedErrorReasons).toEqual({ 'rate limited': 2, 'malformed response': 1 })
    expect(result.drafted).toBe(0)
  })

  it('isolates a crash in one event (article create throws) from the rest of the run (FACT-362 AC2)', async () => {
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1), makeEvent(2), makeEvent(3)] })
      if (collection === 'source-items') {
        return Promise.resolve({
          docs: [{ title: 'T', summary: 'S', url: 'https://x.test/a', source: { name: 'Outlet' }, published_at: '2026-11-09T18:00:00.000Z' }],
        })
      }
      if (collection === 'rubrics') return Promise.resolve({ docs: [{ id: 1, slug: 'bez-rubryky' }] })
      if (collection === 'users') return Promise.resolve({ docs: [{ id: 1 }] })
      return Promise.resolve({ docs: [] })
    })
    mockGenerateDraft.mockImplementation((input: { eventTitle: string }) => Promise.resolve({
      title: input.eventTitle,
      lead: 'lead',
      paragraphs: ['p1'],
      whatIsKnown: '',
      whatIsUnknown: '',
      aiGenerated: false,
    }))
    // Event 2's write poisons that one event only — a bad DB write, a hook
    // rejection, anything at `payload.create` — the kind of failure that used
    // to escape the loop entirely and fail the whole run with zero drafts.
    mockCreate.mockImplementation(({ data }: { data: { event: number } }) => {
      if (data.event === 2) throw new Error('duplicate key value violates unique constraint')
      return Promise.resolve({ id: data.event })
    })
    mockUpdate.mockResolvedValue({})

    const result = await draftFromEvent()

    expect(result.drafted).toBe(2) // events 1 and 3
    expect(result.skippedError).toBe(1)
    expect(result.skippedErrorReasons).toEqual({ 'duplicate key value violates unique constraint': 1 })
    expect(result.fatalError).toBeNull()
  })

  it('reports a fatalError instead of throwing when setup before the loop fails (FACT-362 AC1)', async () => {
    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') throw new Error('connection terminated unexpectedly')
      return Promise.resolve({ docs: [] })
    })

    const result = await draftFromEvent()

    expect(result.fatalError).toEqual({ message: 'connection terminated unexpectedly', stack: expect.any(String) })
    expect(result.drafted).toBe(0)
  })

  // FACT-379: DRAFTS_PER_TICK caps a single tick well below the remaining
  // DRAFTS_PER_DAY budget, so a backlog of confirmed events doesn't all draft
  // in the same tick (sandbox measurement, FACT-341: one tick drafted 39,
  // then the rest of the day sat at skippedBudget with nothing left).
  it('counts skippedTickCap once DRAFTS_PER_TICK is reached, leaving the daily budget untouched', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({
      ORIGINALITY_MAX_OVERLAP: 0.5,
      DRAFTS_PER_DAY: 20,
      DRAFTS_PER_TICK: 1,
      AUTO_PUBLISH: false,
    }))
    const { draftFromEvent: draftFromEventWithTickCap } = await import('@/jobs/ingest/draftFromEvent')

    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1), makeEvent(2), makeEvent(3)] })
      if (collection === 'source-items') {
        return Promise.resolve({
          docs: [{ title: 'T', summary: 'S', url: 'https://x.test/a', source: { name: 'Outlet' }, published_at: '2026-11-09T18:00:00.000Z' }],
        })
      }
      if (collection === 'rubrics') return Promise.resolve({ docs: [{ id: 1, slug: 'bez-rubryky' }] })
      if (collection === 'users') return Promise.resolve({ docs: [{ id: 1 }] })
      return Promise.resolve({ docs: [] })
    })
    mockGenerateDraft.mockImplementation((input: { eventTitle: string }) => Promise.resolve({
      title: input.eventTitle,
      lead: 'lead',
      paragraphs: ['p1'],
      whatIsKnown: '',
      whatIsUnknown: '',
      aiGenerated: false,
    }))
    mockCreate.mockImplementation(({ data }: { data: { event: number } }) => Promise.resolve({ id: data.event }))
    mockUpdate.mockResolvedValue({})

    const result = await draftFromEventWithTickCap()

    expect(result.drafted).toBe(1)
    expect(result.skippedTickCap).toBe(2)
    expect(result.skippedBudget).toBe(0)

    vi.doUnmock('@/lib/env')
  })

  // FACT-381 bug #3: a "groshi" (Гроші) draft whose own whatIsUnknown admits
  // the key figures weren't extracted, and whose known text carries no
  // digits at all, must never auto-publish — even with AUTO_PUBLISH on and
  // every other gate (originality/factFlags/sensitivity) green.
  it('never auto-publishes a number-sensitive (groshi) draft whose known text has no digits', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({
      ORIGINALITY_MAX_OVERLAP: 0.5,
      DRAFTS_PER_DAY: 20,
      DRAFTS_PER_TICK: 20,
      AUTO_PUBLISH: true,
    }))
    const { draftFromEvent: draftFromEventAutoPublish } = await import('@/jobs/ingest/draftFromEvent')

    mockFind.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'events') return Promise.resolve({ docs: [makeEvent(1)] })
      if (collection === 'source-items') {
        return Promise.resolve({
          docs: [{ title: 'Курс валют на 9 листопада', summary: 'Гривня посилиться.', url: 'https://x.test/a', source: { name: 'Outlet' }, published_at: '2026-11-09T18:00:00.000Z' }],
        })
      }
      if (collection === 'rubrics') return Promise.resolve({ docs: [{ id: 5, slug: 'groshi' }] })
      if (collection === 'users') return Promise.resolve({ docs: [{ id: 1 }] })
      return Promise.resolve({ docs: [] })
    })
    mockGenerateDraft.mockResolvedValue({
      title: 'Курс валют на 9 листопада',
      lead: 'Гривня посилиться цими вихідними.',
      paragraphs: ['Конкретні значення курсів у наданих фактах не зазначені.'],
      whatIsKnown: '',
      whatIsUnknown: 'Конкретні значення курсів у наданих фактах не зазначені, тому в цьому тексті їх навести неможливо.',
      suggestedRubricSlug: 'groshi',
      aiGenerated: true,
    })
    mockCreate.mockImplementation(({ data }: { data: { event: number } }) => Promise.resolve({ id: data.event }))
    mockUpdate.mockResolvedValue({})

    const result = await draftFromEventAutoPublish()

    expect(result.drafted).toBe(1)
    expect(result.autoPublished).toBe(0)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'in_review' }) }))

    vi.doUnmock('@/lib/env')
  })
})
