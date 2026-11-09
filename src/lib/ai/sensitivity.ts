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

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKC')
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
    if (keywords.some((kw) => haystack.includes(kw))) categories.push(category)
  }
  return { sensitive: categories.length > 0, categories }
}
