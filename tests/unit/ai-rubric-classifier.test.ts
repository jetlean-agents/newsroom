import { describe, it, expect } from 'vitest'
import { classifyFallbackRubric, validRubricSlugOrNull } from '@/lib/ai/rubricClassifier'

describe('classifyFallbackRubric (FACT-381 bug #2)', () => {
  it('maps a currency/price fixture to groshi, not bez-rubryky', () => {
    expect(classifyFallbackRubric('Курс валют на 9 листопада: скільки коштуватимуть долар, євро')).toBe('groshi')
  })

  it('maps a municipal procurement fixture to rehiony', () => {
    expect(classifyFallbackRubric('У Львові закупили нову техніку для ремонту електромереж за 27 млн грн')).toBe('rehiony')
  })

  it('maps a holiday-greeting fixture to kultura', () => {
    expect(classifyFallbackRubric('Привітання з Днем працівників освіти: щирі слова для вчителів')).toBe('kultura')
  })

  it('falls back to suspilstvo (never bez-rubryky) for lifestyle text with no keyword match (weather, pets)', () => {
    expect(classifyFallbackRubric('Прогноз на вихідні: похолодання до -9 градусів вночі')).toBe('suspilstvo')
    expect(classifyFallbackRubric('Рудий кіт став зіркою мережі після відео з вухами')).toBe('suspilstvo')
    expect(classifyFallbackRubric('')).toBe('suspilstvo')
  })
})

describe('validRubricSlugOrNull', () => {
  it('passes through a known slug and rejects an unknown or missing one', () => {
    expect(validRubricSlugOrNull('groshi')).toBe('groshi')
    expect(validRubricSlugOrNull('not-a-real-rubric')).toBeNull()
    expect(validRubricSlugOrNull(undefined)).toBeNull()
    expect(validRubricSlugOrNull(null)).toBeNull()
  })
})
