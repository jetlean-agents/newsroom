/**
 * Sensitivity classifier (FACT-337 scope item 4): decides whether an AI
 * draft's topic is one Roman's 08.11 rules route to human review no matter
 * what — війна/безпека, політика, медицина, обвинення людей, смерті/
 * катастрофи — rather than letting AUTO_PUBLISH publish it straight away.
 *
 * Dictionary half of "классификатор (тот же вызов Claude плюс словарь)":
 * a plain keyword match, deliberately conservative (false positives just
 * mean one more article in /review, false negatives mean an auto-published
 * sensitive topic). The other half — the same Anthropic call that writes the
 * draft also returning its own `sensitive`/`sensitiveCategories` judgment —
 * lives in `draftProvider.ts`; `draftFromEvent.ts` ORs both signals together
 * before deciding whether to auto-publish. This module alone is also what
 * `Articles.ts` recomputes on every save (server-owned, like
 * originality/fact_flags) since it needs no network call.
 */

export type SensitivityCategory = 'war_safety' | 'politics' | 'medicine' | 'accusations' | 'deaths_disasters'

const CATEGORY_KEYWORDS: Record<SensitivityCategory, string[]> = {
  war_safety: [
    'війна', 'війни', 'війну', 'воєнн', 'обстріл', 'ракетн', 'дрон', 'атака', 'армія', 'збройн',
    'окупац', 'фронт', 'мобілізац', 'тцк', 'безпек', 'терор', 'диверс', 'вибух',
  ],
  politics: [
    'президент', 'уряд', 'кабмін', 'парламент', 'верховна рада', 'депутат', 'міністр', 'вибори',
    'партія', 'політик', 'санкці', 'імпічмент', 'коаліці',
  ],
  medicine: [
    'лікар', 'хворо', 'епідемі', 'пандемі', 'вірус', 'вакцин', 'лікарн', 'операці', 'діагноз',
    'медичн', 'covid', 'спалах',
  ],
  accusations: [
    'звинувачен', 'підозрюєт', 'підозру', 'заарешт', 'корупці', 'хабар', 'обвинувач', 'слідств',
    'кримінальн', 'засуджен',
  ],
  deaths_disasters: [
    'загинул', 'загибл', 'помер', 'смерт', 'жертв', 'постраждал', 'катастроф', 'аварі', 'пожеж',
    'повен', 'землетрус', 'трагед',
  ],
}

/**
 * Keywords that are themselves real stems but whose match is a *different*,
 * non-sensitive sense of the word when a specific other word sits just
 * before it in the same sentence — e.g. "банківські операції" (banking
 * transactions) vs. a medical "операція". Word-boundary matching alone
 * can't tell these apart (both are the same whole word), so this is a
 * narrow, explicit exception list rather than a general heuristic.
 */
const EXCLUDE_PRECEDING: Partial<Record<SensitivityCategory, Record<string, string[]>>> = {
  medicine: {
    'операці': ['банківськ', 'фінансов', 'валютн', 'торговельн', 'бухгалтерськ', 'біржов'],
  },
}

const CONTEXT_WINDOW = 40

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKC')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Indices where `keyword` occurs as a word-start in `haystack` — i.e. not
 * immediately preceded by another letter/digit. Keywords here are stems
 * (e.g. "безпек" is meant to match "безпека", "безпечний", ...), so only the
 * *leading* edge is constrained: that's enough to stop "безпек" from firing
 * inside "кібербезпека" or "дрон" inside "адронний" (hadron), while still
 * matching every real inflection of the stem.
 */
function keywordStartIndices(haystack: string, keyword: string): number[] {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}`, 'gu')
  return [...haystack.matchAll(re)].map((m) => m.index as number)
}

export type SensitivityResult = {
  sensitive: boolean
  categories: SensitivityCategory[]
}

/** Pure, deterministic, no network — safe to call on every Article save. */
export function classifySensitivity(text: string): SensitivityResult {
  const haystack = normalize(text)
  const categories: SensitivityCategory[] = []
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [SensitivityCategory, string[]][]) {
    const excludeMap = EXCLUDE_PRECEDING[category]
    const matched = keywords.some((kw) => {
      const indices = keywordStartIndices(haystack, kw)
      if (!indices.length) return false
      const excludeWords = excludeMap?.[kw]
      if (!excludeWords?.length) return true
      return indices.some((idx) => {
        const context = haystack.slice(Math.max(0, idx - CONTEXT_WINDOW), idx)
        return !excludeWords.some((ex) => context.includes(ex))
      })
    })
    if (matched) categories.push(category)
  }
  return { sensitive: categories.length > 0, categories }
}
