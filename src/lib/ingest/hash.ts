import { createHash } from 'crypto'

const STOPWORDS = new Set([
  'і', 'й', 'у', 'в', 'на', 'до', 'за', 'з', 'із', 'та', 'або', 'що', 'як', 'це',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or',
])

/** Lowercases, transliteration-agnostic punctuation strip, drops stopwords/short tokens. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/['"«»"'ʼ`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok))
    .sort()
    .join(' ')
}

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex')
}

/** Stable identity hash: exact-duplicate items (same source+canonical URL) collapse to one row. */
export function itemHash(sourceId: string, canonicalUrl: string): string {
  return sha1(`${sourceId}::${canonicalUrl}`)
}

/** Hash used for exact title-duplicate clustering across different sources/URLs. */
export function titleHash(title: string): string {
  return sha1(normalizeTitle(title))
}

const SIMHASH_BITS = 64

/** A token that is nothing but digits ("27", "2026") — see `simhash` below. */
function isBareNumber(token: string): boolean {
  return /^\d+$/.test(token)
}

/**
 * 64-bit simhash over normalized word tokens (unigrams, not shingles): since
 * normalizeTitle already drops stopwords and sorts the remaining words,
 * hashing per-word rather than per-adjacent-pair keeps the result robust to a
 * single word being added/removed/reordered by a paraphrasing outlet.
 *
 * Bare-numeric tokens ("27", "2026") are excluded from the hash entirely
 * (FACT-381 bug #4): a sum or date is one of a small universe of short
 * strings, so two otherwise-unrelated headlines that merely cite the same
 * amount ("27 млн грн" lost-forest sale vs. unrelated grid-equipment
 * purchase) were landing within NEAR_DUPLICATE_THRESHOLD and getting
 * clustered into the same event purely on that coincidence. A title that is
 * genuinely the same story keeps clustering correctly on its remaining,
 * actually-distinctive words (names, places, nouns).
 */
export function simhash(text: string): bigint {
  const tokens = normalizeTitle(text).split(' ').filter(Boolean).filter((tok) => !isBareNumber(tok))

  const weights = new Array<number>(SIMHASH_BITS).fill(0)
  for (const token of tokens) {
    const digest = createHash('md5').update(token).digest()
    for (let bit = 0; bit < SIMHASH_BITS; bit++) {
      const byte = digest[Math.floor(bit / 8)]
      const bitSet = (byte >> bit % 8) & 1
      weights[bit] += bitSet ? 1 : -1
    }
  }

  let result = 0n
  for (let bit = 0; bit < SIMHASH_BITS; bit++) {
    if (weights[bit] > 0) result |= 1n << BigInt(bit)
  }
  return result
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

/** Two titles are "near-duplicate" below this Hamming distance (out of 64 bits). */
export const NEAR_DUPLICATE_THRESHOLD = 16
