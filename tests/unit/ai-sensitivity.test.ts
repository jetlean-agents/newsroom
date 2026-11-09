import { describe, expect, it } from 'vitest'
import { classifySensitivity } from '@/lib/ai/sensitivity'

describe('classifySensitivity (FACT-337 scope item 4)', () => {
  it('flags war/safety topics', () => {
    const result = classifySensitivity('Вранці стався ракетний обстріл у прикордонному районі.')
    expect(result.sensitive).toBe(true)
    expect(result.categories).toContain('war_safety')
  })

  it('flags politics', () => {
    const result = classifySensitivity('Президент підписав указ після засідання уряду.')
    expect(result.sensitive).toBe(true)
    expect(result.categories).toContain('politics')
  })

  it('flags medicine', () => {
    const result = classifySensitivity('Лікарі повідомили про спалах вірусу в лікарні міста.')
    expect(result.sensitive).toBe(true)
    expect(result.categories).toContain('medicine')
  })

  it('flags accusations against people', () => {
    const result = classifySensitivity('Слідство висунуло звинувачення у корупції колишньому чиновнику.')
    expect(result.sensitive).toBe(true)
    expect(result.categories).toContain('accusations')
  })

  it('flags deaths/disasters', () => {
    const result = classifySensitivity('Внаслідок пожежі загинули двоє людей, ще кілька постраждали.')
    expect(result.sensitive).toBe(true)
    expect(result.categories).toContain('deaths_disasters')
  })

  it('does not flag a neutral economic/culture text', () => {
    const result = classifySensitivity('Нова виставка художника відкрилася у міському музеї цього тижня.')
    expect(result.sensitive).toBe(false)
    expect(result.categories).toEqual([])
  })

  it('collects multiple matching categories for one text', () => {
    const result = classifySensitivity('Міністр оборони заявив про обстріл, у якому загинули цивільні.')
    expect(result.categories).toContain('politics')
    expect(result.categories).toContain('war_safety')
    expect(result.categories).toContain('deaths_disasters')
  })

  it('is case-insensitive', () => {
    const result = classifySensitivity('ПРЕЗИДЕНТ зустрівся з парламентом.')
    expect(result.sensitive).toBe(true)
  })
})
