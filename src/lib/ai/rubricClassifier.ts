import { RUBRIC_SLUGS, isKnownRubricSlug } from '@/lib/rubricsConfig'

/**
 * Keyword fallback classifier, stage 2 of 3 (FACT-382, building on FACT-381
 * bug #2's "never bez-rubryky"): tried only when the draft provider's own
 * `suggestedRubricSlug` is missing/invalid AND the source-registry feed
 * mapping (`classifyRubric`'s `feedRubricSlug`, stage 1) didn't resolve one
 * either. Scores a keyword dictionary per rubric and returns the best match.
 *
 * FACT-382 PO finding: this used to default unmatched text to `suspilstvo`
 * ("Суспільство"), which is how weather and pet-video filler ended up
 * auto-published into a real rubric nobody reviewed. There is no default
 * anymore — `null` means "no keyword matched," and callers must route that
 * to human review instead of guessing a rubric.
 */
const KEYWORDS: Record<string, string[]> = {
  podii: ['пожеж', 'аварі', 'дтп', 'зникла', 'надзвичайн', 'рятувальник', 'евакуаці', 'вибух', 'вибухів'],
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
  suspilstvo: ['волонтер', 'благодійн', 'громадськ', 'соціальн', 'багатодітн', 'малозабезпечен'],
}

/**
 * Keyword-only match, no default — returns `null` rather than guessing when
 * nothing scores. Still exported for seed's one-off recategorization of
 * legacy articles (src/seed/index.ts), which has its own, narrower default.
 */
export function classifyFallbackRubric(text: string | undefined | null): string | null {
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

  return bestSlug
}

/**
 * Full fallback chain (FACT-382 AC2): source-feed rubric mapping, then the
 * keyword dictionary, then `null` — which the caller (draftFromEvent.ts)
 * must route to `/review` rather than publishing into any rubric by default.
 */
export function classifyRubric(input: { feedRubricSlug?: string | null; text?: string | null }): string | null {
  if (input.feedRubricSlug && isKnownRubricSlug(input.feedRubricSlug)) {
    return input.feedRubricSlug
  }
  return classifyFallbackRubric(input.text)
}

/** The suggested slug if it's one of RUBRICS_CONFIG's 12, otherwise null. */
export function validRubricSlugOrNull(slug: string | undefined | null): string | null {
  return slug && isKnownRubricSlug(slug) ? slug : null
}
