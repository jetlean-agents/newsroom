const UK_TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
}

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  const translit = lower
    .split('')
    .map((ch) => UK_TRANSLIT[ch] ?? ch)
    .join('')
  return translit
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

/** Slug is generated once from the title and never regenerated on later edits. */
export function stableSlug(title: string, existingSlug?: string | null): string {
  if (existingSlug && existingSlug.trim().length > 0) return existingSlug
  return slugify(title)
}
