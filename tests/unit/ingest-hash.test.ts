import { describe, it, expect } from 'vitest'
import { normalizeTitle, titleHash, itemHash, simhash, hammingDistance, NEAR_DUPLICATE_THRESHOLD } from '@/lib/ingest/hash'

describe('normalizeTitle / titleHash', () => {
  it('ignores case, punctuation and word order for exact-duplicate detection', () => {
    const a = 'Зеленський зустрівся з лідерами G7'
    const b = 'зеленський зустрівся з лідерами g7!'
    expect(titleHash(a)).toBe(titleHash(b))
  })

  it('different facts produce different hashes', () => {
    expect(titleHash('Уряд ухвалив новий бюджет')).not.toBe(titleHash('Суд заборонив партію'))
  })
})

describe('itemHash', () => {
  it('is stable for the same source+url and differs across sources', () => {
    const url = 'https://example.com/a'
    expect(itemHash('source-a', url)).toBe(itemHash('source-a', url))
    expect(itemHash('source-a', url)).not.toBe(itemHash('source-b', url))
  })
})

describe('simhash / hammingDistance', () => {
  it('near-identical headlines (one word changed) stay within the near-duplicate threshold', () => {
    const a = simhash('Зеленський зустрівся з лідерами країн G7 у Брюсселі')
    const b = simhash('Зеленський провів зустріч з лідерами країн G7 у Брюсселі')
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(NEAR_DUPLICATE_THRESHOLD)
  })

  it('unrelated headlines exceed the near-duplicate threshold', () => {
    const a = simhash('Зеленський зустрівся з лідерами країн G7 у Брюсселі')
    const b = simhash('НБУ підвищив облікову ставку до 15 відсотків')
    expect(hammingDistance(a, b)).toBeGreaterThan(NEAR_DUPLICATE_THRESHOLD)
  })

  it('identical text has zero distance', () => {
    const text = 'Курс гривні залишився стабільним'
    expect(hammingDistance(simhash(text), simhash(text))).toBe(0)
  })

  it('unrelated headlines that only share a sum/number stay above the threshold (FACT-381 bug #4)', () => {
    const a = simhash('У Львові закупили нову техніку для ремонту електромереж за 27 млн грн')
    const b = simhash('Ліс, який намагалися повернути державі, продають у Брюховичах за 27 млн грн')
    expect(hammingDistance(a, b)).toBeGreaterThan(NEAR_DUPLICATE_THRESHOLD)
  })
})

describe('normalizeTitle', () => {
  it('drops short tokens and stopwords', () => {
    expect(normalizeTitle('це і у в на')).toBe('')
  })
})
