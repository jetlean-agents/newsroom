import { describe, it, expect } from 'vitest'
import { factCheckFlags } from '@/lib/ai/factCheck'

describe('fact-check assist (FACT-236)', () => {
  const sources = ['Пожежа сталася в Києві 5 листопада, постраждало 3 людини, повідомляє ДСНС.']

  it('does not flag a number that appears in the sources', () => {
    const draft = 'Унаслідок пожежі постраждало 3 людини.'
    expect(factCheckFlags(draft, sources)).toEqual([])
  })

  it('flags a number that does not appear in any source', () => {
    const draft = 'Унаслідок пожежі постраждало 12 людей.'
    const flags = factCheckFlags(draft, sources)
    expect(flags).toContainEqual({ value: '12', kind: 'number' })
  })

  it('flags an invented name not present in any source', () => {
    const draft = 'Про це повідомив Петро Коваленко, речник ДСНС.'
    const flags = factCheckFlags(draft, sources)
    expect(flags.some((f) => f.kind === 'name' && f.value === 'Петро Коваленко')).toBe(true)
  })

  it('does not flag a name that is present in a source', () => {
    const draft = 'На місці подій працювала ДСНС Києва.'
    const flags = factCheckFlags(draft, ['Пожежа сталася в Києві, працювала ДСНС Києва.'])
    expect(flags.some((f) => f.value === 'ДСНС Києва')).toBe(false)
  })

  it('flags a date not present in any source', () => {
    const draft = 'Подія сталася 01.01.2026.'
    const flags = factCheckFlags(draft, sources)
    expect(flags.some((f) => f.kind === 'date')).toBe(true)
  })
})
