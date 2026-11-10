import { describe, expect, it } from 'vitest'
import { extractError } from '@/jobs/ingest/ingestStatus'

/**
 * FACT-362 AC1: a failed `ingest-draft-from-event` run must show its error
 * (message + first stack lines) over `GET /api/ingest/status` without
 * container logs — `output` was `null` for every failed run before this.
 */
describe('extractError (FACT-362 AC1)', () => {
  it('prefers draftFromEvent()\'s own fatalError when present', () => {
    const output = {
      drafted: 2,
      fatalError: { message: 'connection terminated unexpectedly', stack: 'Error: connection terminated\n    at a\n    at b' },
    }
    const result = extractError(output, 'completed')
    expect(result?.message).toBe('connection terminated unexpectedly')
    expect(result?.stack).toContain('at a')
  })

  it('falls back to pg-boss\'s own serialized error for a failed run with no funnel output', () => {
    const output = { message: 'duplicate key value violates unique constraint', stack: 'Error: duplicate key\n    at x' }
    const result = extractError(output, 'failed')
    expect(result?.message).toBe('duplicate key value violates unique constraint')
    expect(result?.stack).toContain('at x')
  })

  it('returns null for a clean completed run', () => {
    const output = { drafted: 3, autoPublished: 1, fatalError: null }
    expect(extractError(output, 'completed')).toBeNull()
  })

  it('returns null when a run is marked failed but output has no message (e.g. empty output)', () => {
    expect(extractError({}, 'failed')).toBeNull()
  })

  it('truncates a long message and keeps only the first 5 stack lines', () => {
    const longMessage = 'x'.repeat(1000)
    const longStack = Array.from({ length: 20 }, (_, i) => `    at frame${i}`).join('\n')
    const result = extractError({ fatalError: { message: longMessage, stack: longStack } }, 'completed')
    expect(result?.message.length).toBeLessThanOrEqual(500)
    expect(result?.stack?.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('redacts secret-shaped substrings (API keys, bearer tokens) from message and stack', () => {
    const output = {
      fatalError: {
        message: 'anthropic request failed: sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
        stack: 'Error: unauthorized\n    Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789',
      },
    }
    const result = extractError(output, 'completed')
    expect(result?.message).not.toContain('sk-ant-')
    expect(result?.message).toContain('[redacted]')
    expect(result?.stack).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789')
  })
})
