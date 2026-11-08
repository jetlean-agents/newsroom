import { describe, it, expect } from 'vitest'
import { shingleOverlap, maxOverlap } from '@/lib/ai/originality'

describe('anti-copypaste overlap (FACT-236)', () => {
  const source = 'Кабінет міністрів ухвалив рішення про підвищення мінімальної заробітної плати з наступного місяця.'

  it('is 0 for completely original wording', () => {
    expect(shingleOverlap('Зовсім інший текст без жодного спільного слова взагалі тут.', source)).toBe(0)
  })

  it('is 1 when the draft is copied verbatim from the source', () => {
    expect(shingleOverlap(source, source)).toBe(1)
  })

  it('is high (but not necessarily 1) for a draft that mostly repeats the source verbatim', () => {
    const draft = `${source} Деталі уточнюються.`
    expect(shingleOverlap(draft, source)).toBeGreaterThan(0.5)
  })

  it('is low for a paraphrase that keeps the facts but rewrites the wording', () => {
    const draft = 'Уряд підвищить мінімальну зарплату з наступного місяця — таке рішення ухвалив Кабмін.'
    expect(shingleOverlap(draft, source)).toBeLessThan(0.3)
  })

  it('maxOverlap picks the worst (most-copied-from) source, not the average', () => {
    const original = 'Повністю власний виклад події без копіювання жодного джерела тут.'
    const otherSource = 'Якась інша новина про зовсім інше.'
    expect(maxOverlap(source, [otherSource, source])).toBe(1)
    expect(maxOverlap(original, [otherSource, source])).toBe(0)
  })
})
