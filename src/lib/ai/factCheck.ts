/**
 * Fact-check assist (FACT-236 scope item 4): flag numbers, dates and capitalized
 * names in the draft that don't appear in any source text, so the reviewing
 * editor gets a "перевірити" pointer instead of having to re-read every source
 * for every figure. This is a heuristic aid, not a guarantee — it never blocks
 * publication by itself (unlike the originality check).
 */

export type FactFlag = {
  value: string
  kind: 'number' | 'date' | 'name'
}

const NUMBER_RE = /\b\d[\d\s.,]*\d\b|\b\d\b/g
const DATE_RE = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g
// A run of 2+ capitalized Cyrillic/Latin words — a crude proper-name detector.
// No \b here: JS word-boundary is ASCII-only ([A-Za-z0-9_]) and silently fails
// to bound a Cyrillic word at all.
const NAME_RE = /[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ'’-]+(?:\s+[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ'’-]+)+/g

function collectMatches(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re)).map((m) => m[0].trim())
}

function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Returns every number/date/name found in `draftText` that isn't substring-present
 * in any of `sourceTexts` — candidates the author invented or mis-transcribed.
 */
export function factCheckFlags(draftText: string, sourceTexts: string[]): FactFlag[] {
  const haystack = sourceTexts.map(normalizeForCompare)
  const isSupported = (value: string) => {
    const needle = normalizeForCompare(value)
    return haystack.some((source) => source.includes(needle))
  }

  const flags: FactFlag[] = []
  const seen = new Set<string>()

  const push = (values: string[], kind: FactFlag['kind']) => {
    for (const value of values) {
      const key = `${kind}:${normalizeForCompare(value)}`
      if (seen.has(key)) continue
      if (isSupported(value)) continue
      seen.add(key)
      flags.push({ value, kind })
    }
  }

  push(collectMatches(draftText, DATE_RE), 'date')
  push(collectMatches(draftText, NUMBER_RE), 'number')
  push(collectMatches(draftText, NAME_RE), 'name')

  return flags
}
