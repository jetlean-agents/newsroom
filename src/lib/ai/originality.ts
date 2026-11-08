/**
 * Anti-copypaste check (FACT-236 scope item 3): how much of the draft is made
 * of word-sequences lifted verbatim from a source text, rather than written
 * fresh. Word-level shingles (not character n-grams) so it survives case and
 * punctuation differences but still catches a sentence copied near-verbatim.
 */

const SHINGLE_SIZE = 5

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/['"«»"'ʼ`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function shingles(tokens: string[], size: number): Set<string> {
  const out = new Set<string>()
  if (tokens.length < size) {
    if (tokens.length > 0) out.add(tokens.join(' '))
    return out
  }
  for (let i = 0; i <= tokens.length - size; i++) {
    out.add(tokens.slice(i, i + size).join(' '))
  }
  return out
}

/**
 * Fraction (0-1) of the draft's shingles that also appear in `sourceText`.
 * 0 = fully original wording, 1 = entirely copied.
 */
export function shingleOverlap(draftText: string, sourceText: string): number {
  const draftShingles = shingles(tokenize(draftText), SHINGLE_SIZE)
  if (draftShingles.size === 0) return 0
  const sourceShingles = shingles(tokenize(sourceText), SHINGLE_SIZE)
  if (sourceShingles.size === 0) return 0

  let matched = 0
  for (const shingle of draftShingles) {
    if (sourceShingles.has(shingle)) matched++
  }
  return matched / draftShingles.size
}

/**
 * Overlap against the worst (most-copied-from) single source — the signal that
 * matters for "did we just paraphrase one article" rather than the average
 * across all sources, which would dilute a one-source copy-paste.
 */
export function maxOverlap(draftText: string, sourceTexts: string[]): number {
  let max = 0
  for (const source of sourceTexts) {
    const overlap = shingleOverlap(draftText, source)
    if (overlap > max) max = overlap
  }
  return max
}
