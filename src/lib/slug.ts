const UK_TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  // Non-Ukrainian Cyrillic letters that still turn up in source titles
  // (Russian-language wire copy, proper names, etc.) — without these, a
  // title that's otherwise all-Cyrillic strips down to nothing (see the
  // empty-slug fallback below).
  ё: 'io', э: 'e', ы: 'y', ъ: '',
}

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  const translit = lower
    .split('')
    .map((ch) => UK_TRANSLIT[ch] ?? ch)
    .join('')
  const slug = translit
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  // A title that's entirely untransliterable (e.g. a script outside
  // UK_TRANSLIT, only punctuation/emoji, or empty) would otherwise produce
  // an empty string, which trips the `unique` constraint the moment a
  // second one is generated (FACT-378 AC2). Fall back to a short hash of
  // the original title so every article still gets a stable, non-empty,
  // collision-resistant slug.
  return slug || `article-${hashSuffix(input)}`
}

function hashSuffix(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

/** Slug is generated once from the title and never regenerated on later edits. */
export function stableSlug(title: string, existingSlug?: string | null): string {
  if (existingSlug && existingSlug.trim().length > 0) return existingSlug
  return slugify(title)
}

/**
 * Resolves a `unique` collision by appending `-2`, `-3`, ... until `taken`
 * (a DB existence check scoped to the saving document, i.e. excluding its
 * own current row on update) reports a free slug. Kept separate from
 * `slugify`/`stableSlug` because only a collection hook has the DB access to
 * check; those two stay pure and synchronous for easy unit testing.
 */
export async function uniqueSlug(base: string, taken: (candidate: string) => Promise<boolean>): Promise<string> {
  if (!(await taken(base))) return base
  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!(await taken(candidate))) return candidate
  }
  throw new Error(`uniqueSlug: could not find a free slug for base "${base}" after 999 attempts`)
}
