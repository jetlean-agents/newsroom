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
 * PO review 09.11 (FACT-362): a missed sensitive topic is worse than one
 * extra article sitting in `/review`, so matching stays substring-first —
 * every keyword is a stem meant to fire on any prefix/suffix inflection
 * (война/воєнн catches військовий, воєнна, ...; Ukrainian prefixes like
 * "де-"/"демо-"/"анти-"/"контр-"/"проти-" are exactly why: "деокупація",
 * "демобілізація", "антитерористична", "контратака", "протиракетна" must
 * still match). A leading word-boundary check (tried first, reverted) broke
 * every one of those.
 *
 * The real false positives found (FACT-362) are a short, *specific* list of
 * unrelated words that happen to fully contain a keyword as a substring —
 * "кібербезпека" (cyber-security, not без+пек), "адронний" (hadron, not
 * дрон), "безаварійний" (accident-free, the opposite of an "аварі") — plus
 * one same-word-different-sense case, "операції" meaning a bank transaction
 * rather than a medical procedure. Both are handled as narrow, explicit
 * exceptions below, never as a general pattern that could also swallow a
 * real prefixed match.
 */
const FALSE_POSITIVE_COMPOUNDS = ['кібербезпек', 'адрон', 'безаварі']

/**
 * Keywords that are themselves real stems but whose match is a *different*,
 * non-sensitive sense of the word when a specific other word sits just
 * before it in the same sentence — e.g. "банківські операції" (banking
 * transactions) vs. a medical "операція". These are two separate words, so
 * FALSE_POSITIVE_COMPOUNDS' contained-substring check doesn't apply; this is
 * a narrow, explicit exception list rather than a general heuristic.
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

/**
 * Blanks out each known false-positive compound word (same length, so
 * downstream match indices used for EXCLUDE_PRECEDING context windows stay
 * correct) before any keyword is matched against the text.
 */
function maskFalsePositiveCompounds(haystack: string): string {
  let masked = haystack
  for (const word of FALSE_POSITIVE_COMPOUNDS) {
    if (masked.includes(word)) masked = masked.split(word).join(' '.repeat(word.length))
  }
  return masked
}

export type SensitivityResult = {
  sensitive: boolean
  categories: SensitivityCategory[]
}

/** Pure, deterministic, no network — safe to call on every Article save. */
export function classifySensitivity(text: string): SensitivityResult {
  const haystack = maskFalsePositiveCompounds(normalize(text))
  const categories: SensitivityCategory[] = []
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [SensitivityCategory, string[]][]) {
    const excludeMap = EXCLUDE_PRECEDING[category]
    const matched = keywords.some((kw) => {
      const excludeWords = excludeMap?.[kw]
      if (!excludeWords?.length) return haystack.includes(kw)
      // Check every occurrence, not just the first: one mention inside an
      // excluded phrase shouldn't hide a later, unrelated real match.
      let searchFrom = 0
      while (true) {
        const idx = haystack.indexOf(kw, searchFrom)
        if (idx === -1) return false
        const context = haystack.slice(Math.max(0, idx - CONTEXT_WINDOW), idx)
        if (!excludeWords.some((ex) => context.includes(ex))) return true
        searchFrom = idx + 1
      }
    })
    if (matched) categories.push(category)
  }
  return { sensitive: categories.length > 0, categories }
}
