import { RUBRIC_SLUGS, isKnownRubricSlug } from '@/lib/rubricsConfig'

/**
 * Keyword fallback classifier (FACT-381 bug #2): used only when the draft
 * provider's own `suggestedRubricSlug` is missing or not one of
 * RUBRICS_CONFIG's 12 slugs. Scores a small keyword dictionary per rubric
 * and returns the best match — never `bez-rubryky`, which the issue brief
 * explicitly bans the autopipeline from using. `suspilstvo` ("Суспільство")
 * is the last-resort default for the lifestyle/human-interest material
 * (weather, holiday greetings, pets) that has no dedicated rubric and no
 * matched keyword either — still a real, navigable rubric, unlike the dead
 * end "Без рубрики" was.
 */
const KEYWORDS: Record<string, string[]> = {
  viina: ['війна', 'фронт', 'обстріл', 'зсу', 'окупант', 'ракетн', 'дрон', 'мобілізаці', 'армія', 'оборон'],
  polityka: ['парламент', 'верховна рада', 'президент', 'уряд', 'депутат', 'міністр', 'указ', 'законопроєкт'],
  groshi: ['курс валют', 'гривн', 'долар', 'євро', 'тариф', 'ціна', 'ціни', 'зарплат', 'пенсі', 'виплат', 'пальне', 'бензин', 'дизель', 'автогаз'],
  ekonomika: ['бізнес', 'інвестиц', 'ринок', 'ввп', 'державний бюджет', 'підприємств', 'експорт', 'імпорт'],
  zdorovia: ['лікар', 'хвороб', 'вакцин', 'клініка', 'медичн', 'пацієнт', 'епідемі'],
  sport: ['матч', 'турнір', 'чемпіонат', 'збірна', 'футбол', 'олімпі', 'тренер'],
  kultura: ['фестиваль', 'концерт', 'фільм', 'виставка', 'привітання', 'свято', 'культур', 'музей', 'театр'],
  rehiony: ['закуп', 'тендер', 'комунальн', 'обладнання', 'міськрада', 'обласна рада', 'електромереж'],
  tekhnolohii: ['технологі', 'гаджет', 'смартфон', 'штучний інтелект', 'застосунок', 'стартап'],
  svit: ['сша', 'європейськ', 'оон', 'нато', 'зарубіж', 'міжнародн'],
}

const DEFAULT_SLUG = 'suspilstvo'

export function classifyFallbackRubric(text: string | undefined | null): string {
  const normalized = (text ?? '').toLowerCase()
  let bestSlug: string | null = null
  let bestScore = 0

  for (const slug of RUBRIC_SLUGS) {
    const keywords = KEYWORDS[slug]
    if (!keywords) continue
    const score = keywords.reduce((count, kw) => (normalized.includes(kw) ? count + 1 : count), 0)
    if (score > bestScore) {
      bestScore = score
      bestSlug = slug
    }
  }

  return bestSlug ?? DEFAULT_SLUG
}

/** The suggested slug if it's one of RUBRICS_CONFIG's 12, otherwise null. */
export function validRubricSlugOrNull(slug: string | undefined | null): string | null {
  return slug && isKnownRubricSlug(slug) ? slug : null
}
