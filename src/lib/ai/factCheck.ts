/**
 * Fact-check assist (FACT-236 scope item 4): flag numbers, dates and capitalized
 * names in the draft that don't appear in any source text, so the reviewing
 * editor gets a "перевірити" pointer instead of having to re-read every source
 * for every figure. This is a heuristic aid, not a guarantee — it never blocks
 * publication by itself (unlike the originality check).
 *
 * FACT-379: normalizes three classes of *formatting-only* differences that
 * FACT-341's sandbox measurement showed were the bulk of false positives on
 * non-sensitive material (27 of 53 `/review` items `fact_flags`-blocked) —
 * number separators/magnitude words, digit vs. written-out Ukrainian dates,
 * and Ukrainian case endings on names/toponyms. None of this weakens the
 * actual-fabrication check: a number, date or name genuinely absent from
 * every source still flags, because every normalization below only widens
 * *what counts as the same value*, never skips the comparison itself (PO
 * review tightened two over-wide first drafts of this rule — see
 * `extractUrlNumberTokens` and `stemsMatch` below).
 */

export type FactFlag = {
  value: string
  kind: 'number' | 'date' | 'name'
}

const NUMBER_RE = /\b\d[\d\s.,]*\d\b|\b\d\b/g
// 2-or-3-group digit date: "09.11" (no year, as in the issue brief's own
// "9 листопада" ↔ "09.11" example) or "09.11.2026". Day/month order assumed
// DD.MM(.YYYY) — the only convention this codebase/locale uses.
const DATE_DIGIT_RE = /\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g
// A run of 2+ capitalized Cyrillic/Latin words — a crude proper-name detector.
// No \b here: JS word-boundary is ASCII-only ([A-Za-z0-9_]) and silently fails
// to bound a Cyrillic word at all.
const NAME_RE = /[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ'’-]+(?:\s+[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ'’-]+)+/g

const UA_LOWER = "а-яіїєґ'’"

/** Ukrainian genitive month names, as used in "9 листопада" / "9 листопада 2026". */
const UA_MONTHS: Record<string, number> = {
  січня: 1,
  лютого: 2,
  березня: 3,
  квітня: 4,
  травня: 5,
  червня: 6,
  липня: 7,
  серпня: 8,
  вересня: 9,
  жовтня: 10,
  листопада: 11,
  грудня: 12,
}
// No trailing \b: JS \w is ASCII-only, so a boundary right after a Cyrillic
// month name never actually fires (same pitfall NAME_RE's own comment flags)
// — harmless to drop here since every month name is matched as an exact
// literal out of a fixed alternation, never an open-ended character class.
const WRITTEN_DATE_RE = new RegExp(
  `\\b(\\d{1,2})\\s+(${Object.keys(UA_MONTHS).join('|')})(?:\\s+(\\d{4})(?:\\s*р(?:оку)?\\.?)?)?`,
  'gi',
)

/**
 * "1,5 тисячі" / "500 мільйонів" / "500 млн" — a number followed by a
 * magnitude word, resolved to its actual value so it can be compared against
 * the same figure spelled out in full elsewhere ("1500" / "500000000").
 * Matched against the text immediately *after* a NUMBER_RE match, so each
 * entry is anchored with `^`.
 */
const MAGNITUDE_WORDS: { re: RegExp; factor: number }[] = [
  { re: new RegExp(`^тис\\.?[${UA_LOWER}]*`, 'i'), factor: 1_000 },
  { re: new RegExp(`^тисяч[${UA_LOWER}]*`, 'i'), factor: 1_000 },
  { re: new RegExp(`^млн\\.?[${UA_LOWER}]*`, 'i'), factor: 1_000_000 },
  { re: new RegExp(`^мільйон[${UA_LOWER}]*`, 'i'), factor: 1_000_000 },
  { re: new RegExp(`^млрд\\.?[${UA_LOWER}]*`, 'i'), factor: 1_000_000_000 },
  { re: new RegExp(`^мільярд[${UA_LOWER}]*`, 'i'), factor: 1_000_000_000 },
]

/** Ukrainian noun-case endings, longest first so e.g. "ями" strips before "и".
 * "ь" covers soft-stem feminine nouns' nominative ("область") against their
 * genitive/locative ("області", which strips to the same stem via "і"). */
const NAME_SUFFIXES = ['ами', 'ями', 'ові', 'еві', 'єві', 'ою', 'ею', 'ів', 'їв', 'им', 'ім', 'их', 'ій', 'ом', 'ем', 'а', 'я', 'у', 'ю', 'о', 'е', 'і', 'и', 'ь'].sort(
  (a, b) => b.length - a.length,
)
const MIN_STEM_LENGTH = 3

function collectMatches(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re)).map((m) => m[0].trim())
}

function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Collapses thousands-separator whitespace out of a number — "500 000" and
 * "500000" are the same figure, just formatted differently (FACT-362: a
 * Prozorro-style procurement draft restating a source's sum with the
 * idiomatic Ukrainian space separator was flagging every single sum as
 * "invented", even though none of them actually changed). Only applied to
 * `kind: 'number'` comparisons — dates/names keep exact whitespace matching.
 */
function stripNumberSeparators(value: string): string {
  return value.replace(/\s+/g, '')
}

/**
 * Parses a matched number into a plain float: strips thousands-separator
 * whitespace, then treats a comma as the decimal point (this locale never
 * uses comma as a thousands separator — only the idiomatic space does, same
 * as `stripNumberSeparators`). Returns `null` for anything that isn't a
 * single clean numeral once separators are removed (e.g. "3.14.15").
 */
function parseNumericValue(value: string): number | null {
  const cleaned = stripNumberSeparators(value).replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * The set of numeric values a single number *token* resolves to: its own
 * value, plus — when immediately followed by a magnitude word ("тисячі",
 * "млн", ...) — that value multiplied out, so "1,5 тисячі" also carries 1500
 * and can be matched against a source that spells the figure out in full.
 */
function numericEquivalents(value: string, tailAfterMatch: string): number[] {
  const base = parseNumericValue(value)
  if (base == null) return []
  const equivalents = [base]
  const tail = tailAfterMatch.trimStart()
  const magnitude = MAGNITUDE_WORDS.find(({ re }) => re.test(tail))
  if (magnitude) equivalents.push(base * magnitude.factor)
  return equivalents
}

/** Every numeric equivalent (see above) found anywhere in `text`. */
function collectNumericEquivalents(text: string): Set<number> {
  const values = new Set<number>()
  for (const m of text.matchAll(NUMBER_RE)) {
    const tail = text.slice((m.index ?? 0) + m[0].length)
    for (const v of numericEquivalents(m[0], tail)) values.add(v)
  }
  return values
}

/** "MM-DD" — deliberately year-less: both of the issue brief's own forms
 * ("9 листопада" / "09.11") omit the year, and a human writer routinely
 * drops it when it's the current year, so requiring an exact year match
 * would reintroduce the same false-positive class this normalization fixes.
 * A genuinely wrong day or month still produces a different key and is
 * still flagged.
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function canonicalDigitDateKey(value: string): string | null {
  const parts = value.split(/[./]/)
  if (parts.length < 2) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  if (!day || !month || day > 31 || month > 12) return null
  return `${pad2(month)}-${pad2(day)}`
}

function canonicalWrittenDateKey(day: string, monthName: string): string | null {
  const month = UA_MONTHS[monthName.toLowerCase()]
  if (!month) return null
  return `${pad2(month)}-${pad2(Number(day))}`
}

/** Every canonical "MM-DD" date key found anywhere in `text`, digit or written form. */
function collectDateKeys(text: string): Set<string> {
  const keys = new Set<string>()
  for (const m of text.matchAll(DATE_DIGIT_RE)) {
    const key = canonicalDigitDateKey(m[0])
    if (key) keys.add(key)
  }
  for (const m of text.matchAll(WRITTEN_DATE_RE)) {
    const key = canonicalWrittenDateKey(m[1], m[2])
    if (key) keys.add(key)
  }
  return keys
}

function canonicalDateKeyForMatch(value: string): string | null {
  const written = WRITTEN_DATE_RE.exec(value)
  WRITTEN_DATE_RE.lastIndex = 0
  if (written) return canonicalWrittenDateKey(written[1], written[2])
  return canonicalDigitDateKey(value)
}

/**
 * Strips one trailing Ukrainian case ending, if the remaining stem is still
 * long enough to be meaningful (FACT-379: "Запорізькій області" in a draft
 * must still match a source's "Запорізька область" nominative form). This is
 * deliberately crude — a real lemmatizer needs a dictionary this project has
 * no budget for — so matching below (`stemsMatch`) requires the two
 * resulting stems to be exactly equal, never just a shared prefix: a prefix
 * check let "Іван" match "Іванна" and "Коваль" match "Ковальчук" (PO review,
 * FACT-379) — different people, not case variants of the same name.
 */
function stemWord(word: string): string {
  const lower = word.toLowerCase()
  for (const suffix of NAME_SUFFIXES) {
    if (lower.length - suffix.length >= MIN_STEM_LENGTH && lower.endsWith(suffix)) {
      return lower.slice(0, -suffix.length)
    }
  }
  return lower
}

function tokenizeWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
}

function stemsMatch(a: string, b: string): boolean {
  return a === b
}

/**
 * Whether `phrase` (a flagged name/toponym candidate) appears, as a
 * contiguous run of case-normalized word stems, in any of `haystackTokens`
 * (one tokenized source text per entry).
 */
function phraseSupportedByStem(phrase: string, haystackTokens: string[][]): boolean {
  const needleStems = tokenizeWords(phrase).map(stemWord)
  if (!needleStems.length) return false
  return haystackTokens.some((tokens) => {
    const stems = tokens.map(stemWord)
    for (let i = 0; i + needleStems.length <= stems.length; i++) {
      let matched = true
      for (let j = 0; j < needleStems.length; j++) {
        if (!stemsMatch(stems[i + j], needleStems[j])) {
          matched = false
          break
        }
      }
      if (matched) return true
    }
    return false
  })
}

/**
 * Whole-token numbers found in a source's URL ("056" in ".../056.ua/news/...",
 * "2026" in ".../2026/11/09/..."), for supporting a number that only ever
 * appeared in a URL's domain/date segment, never its title or summary. Not a
 * substring check: `haystackDigitsOnly`'s plain `.includes()` would let any
 * number that happens to be a substring of a long numeric path segment (an
 * article id like "3912458") falsely "support" an unrelated short number
 * ("245", "39", ...) baked into that id — a real false-negative PO review
 * caught (FACT-379). `\d+` on the raw URL already yields whole runs of
 * digits with no separators to strip, so this is exact-value comparison.
 */
function extractUrlNumberTokens(urls: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const url of urls) {
    for (const m of url.matchAll(/\d+/g)) tokens.add(m[0])
  }
  return tokens
}

/**
 * Returns every number/date/name found in `draftText` that isn't substring-present
 * (after normalization) in any of `sourceTexts` — candidates the author invented or
 * mis-transcribed. `sourceUrls` (FACT-379) is compared separately and only by whole
 * numeric token (see `extractUrlNumberTokens`) — never folded into `sourceTexts`,
 * which would let a long URL path id substring-"support" an unrelated short number.
 */
export function factCheckFlags(draftText: string, sourceTexts: string[], sourceUrls: string[] = []): FactFlag[] {
  const haystack = sourceTexts.map(normalizeForCompare)
  const haystackDigitsOnly = haystack.map(stripNumberSeparators)
  const haystackNumericEquivalents = new Set<number>()
  for (const source of sourceTexts) {
    for (const v of collectNumericEquivalents(source)) haystackNumericEquivalents.add(v)
  }
  const urlNumberTokens = extractUrlNumberTokens(sourceUrls)
  const haystackDateKeys = new Set<string>()
  for (const source of sourceTexts) {
    for (const k of collectDateKeys(source)) haystackDateKeys.add(k)
  }
  const haystackTokens = sourceTexts.map(tokenizeWords)

  const isSupported = (value: string, kind: FactFlag['kind']) => {
    const needle = normalizeForCompare(value)
    if (haystack.some((source) => source.includes(needle))) return true

    if (kind === 'number') {
      const strippedNeedle = stripNumberSeparators(needle)
      if (haystackDigitsOnly.some((source) => source.includes(strippedNeedle))) return true
      if (urlNumberTokens.has(strippedNeedle)) return true
      const tail = draftText.slice(draftText.indexOf(value) + value.length)
      return numericEquivalents(value, tail).some((v) => haystackNumericEquivalents.has(v))
    }

    if (kind === 'date') {
      const key = canonicalDateKeyForMatch(value)
      return key != null && haystackDateKeys.has(key)
    }

    return phraseSupportedByStem(value, haystackTokens)
  }

  const flags: FactFlag[] = []
  const seen = new Set<string>()

  const push = (values: string[], kind: FactFlag['kind']) => {
    for (const value of values) {
      const key = `${kind}:${normalizeForCompare(value)}`
      if (seen.has(key)) continue
      if (isSupported(value, kind)) continue
      seen.add(key)
      flags.push({ value, kind })
    }
  }

  // A digit date ("09.11") is itself a run of digits, so NUMBER_RE also
  // matches it — excluded here so the same span isn't flagged twice, once as
  // a 'date' (compared against haystackDateKeys) and once as a stray
  // 'number' (compared against raw digits, which a written-form source date
  // like "9 листопада" would never contain).
  const dateDigitMatches = collectMatches(draftText, DATE_DIGIT_RE)
  push(dateDigitMatches, 'date')
  push(collectMatches(draftText, WRITTEN_DATE_RE), 'date')
  const dateDigitValues = new Set(dateDigitMatches)
  push(collectMatches(draftText, NUMBER_RE).filter((v) => !dateDigitValues.has(v)), 'number')
  push(collectMatches(draftText, NAME_RE), 'name')

  return flags
}
