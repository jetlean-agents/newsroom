import { describe, it, expect } from 'vitest'
import { isBreakingActive } from '@/lib/time'

describe('isBreakingActive (FACT-340 "Терміново")', () => {
  it('is false when breaking is not set', () => {
    expect(isBreakingActive(false, '2026-11-09T18:00:00Z', new Date('2026-11-09T17:00:00Z'))).toBe(false)
  })

  it('is false when breaking is true but breaking_until is missing', () => {
    expect(isBreakingActive(true, null, new Date('2026-11-09T17:00:00Z'))).toBe(false)
  })

  it('is true while now is before breaking_until', () => {
    expect(isBreakingActive(true, '2026-11-09T18:00:00Z', new Date('2026-11-09T17:59:00Z'))).toBe(true)
  })

  it('expires once now reaches breaking_until', () => {
    expect(isBreakingActive(true, '2026-11-09T18:00:00Z', new Date('2026-11-09T18:00:01Z'))).toBe(false)
  })
})
