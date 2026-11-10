import { describe, it, expect } from 'vitest'
import { classifyFallbackRubric, classifyRubric, validRubricSlugOrNull } from '@/lib/ai/rubricClassifier'

describe('classifyFallbackRubric (keyword dictionary only)', () => {
  it('maps a currency/price fixture to groshi', () => {
    expect(classifyFallbackRubric('Курс валют на 9 листопада: скільки коштуватимуть долар, євро')).toBe('groshi')
  })

  it('maps a municipal procurement fixture to rehiony', () => {
    expect(classifyFallbackRubric('У Львові закупили нову техніку для ремонту електромереж за 27 млн грн')).toBe('rehiony')
  })

  it('maps a holiday-greeting fixture to kultura', () => {
    expect(classifyFallbackRubric('Привітання з Днем працівників освіти: щирі слова для вчителів')).toBe('kultura')
  })

  it('maps a volunteering fixture to suspilstvo via its own keywords, not as a default', () => {
    expect(classifyFallbackRubric('Волонтери зібрали благодійну допомогу для громади міста')).toBe('suspilstvo')
  })

  // FACT-382 PO finding: this used to default to suspilstvo; it must now
  // return null — no keyword dictionary entry should ever match weather or
  // pet-video filler, so callers can route it to /review instead.
  it('returns null (never suspilstvo) for lifestyle text with no keyword match — weather, pets', () => {
    expect(classifyFallbackRubric('Прогноз на вихідні: похолодання до -9 градусів вночі')).toBeNull()
    expect(classifyFallbackRubric('Рудий кіт став зіркою мережі після відео з вухами')).toBeNull()
    expect(classifyFallbackRubric('')).toBeNull()
  })
})

describe('classifyRubric (FACT-382 AC2 fallback chain: feed mapping -> keyword dictionary -> null/review)', () => {
  it('uses the feed-source rubric mapping when it is a known slug, ignoring the text entirely', () => {
    expect(classifyRubric({ feedRubricSlug: 'zdorovia', text: 'Прогноз на вихідні: похолодання' })).toBe('zdorovia')
  })

  it('ignores an unknown/invalid feed rubric mapping and falls through to the keyword dictionary', () => {
    expect(classifyRubric({ feedRubricSlug: 'not-a-real-rubric', text: 'Курс валют подорожчав' })).toBe('groshi')
  })

  it('falls through to the keyword dictionary when there is no feed mapping', () => {
    expect(classifyRubric({ feedRubricSlug: null, text: 'Матч чемпіонату завершився перемогою збірної' })).toBe('sport')
  })

  it('weather with no feed mapping and no keyword match goes to /review (null), never suspilstvo', () => {
    expect(classifyRubric({ feedRubricSlug: null, text: 'Прогноз на вихідні: похолодання до -9 градусів вночі' })).toBeNull()
  })

  it('a pet/human-interest fixture with no feed mapping and no keyword match also goes to /review (null)', () => {
    expect(classifyRubric({ feedRubricSlug: undefined, text: 'Рудий кіт став зіркою мережі після відео з вухами' })).toBeNull()
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
