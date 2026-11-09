import { describe, expect, it, vi } from 'vitest'
import { handlePollSourceJob } from '@/jobs/ingest/pollSource'

// `pollSource` (unlike `handlePollSourceJob`) calls `getPayloadClient()` itself rather than
// taking payload as a param — stub it so the "unknown source type" branch below (which never
// touches payload) doesn't try to open a real DB connection.
vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn().mockResolvedValue({}) }))

/**
 * Regression test for FACT-357: pg-boss 9.0.3's `boss.work(name, opts, handler)`
 * hands the handler one job object (not an array — batched arrays only became
 * the default in pg-boss 10, or when `batchSize` is set, neither true here).
 * `handlePollSourceJob` takes that single-job shape directly; if it instead
 * tried `for (const job of jobs)` on it, this would throw "is not iterable".
 */
describe('handlePollSourceJob (FACT-357)', () => {
  const job = { data: { sourceId: 42 } }

  it('accepts a single pg-boss job object, not an array, and runs pollSource', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 42, source_key: 'test-source', type: 'unknown-type' }),
      update,
    }

    const result = await handlePollSourceJob(job, payload as any)

    expect(payload.findByID).toHaveBeenCalledWith({ collection: 'sources', id: 42 })
    expect(result).toEqual({ sourceKey: 'test-source', skipped: 'unknown source type "unknown-type"', fetched: 0, stored: 0 })
  })

  it('records last_error/consecutive_errors on a handler crash and still rethrows', async () => {
    const findByID = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ id: 42, consecutive_errors: 1 })
    const update = vi.fn().mockResolvedValue(undefined)
    const payload = { findByID, update }

    await expect(handlePollSourceJob(job, payload as any)).rejects.toThrow('boom')

    expect(update).toHaveBeenCalledWith({
      collection: 'sources',
      id: 42,
      data: expect.objectContaining({
        last_error: expect.stringContaining('handler crashed: boom'),
        consecutive_errors: 2,
      }),
    })
  })

  it('auto-disables the source once handler crashes hit the consecutive-error ceiling', async () => {
    const findByID = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ id: 42, consecutive_errors: 4 })
    const update = vi.fn().mockResolvedValue(undefined)
    const payload = { findByID, update }

    await expect(handlePollSourceJob(job, payload as any)).rejects.toThrow('boom')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consecutive_errors: 5, enabled: false }) }),
    )
  })
})
