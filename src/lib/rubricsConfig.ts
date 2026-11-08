/**
 * Canonical rubric list (Roman's 08.11 decision — epic FACT-164, this issue's scope).
 * Single source of truth consumed by the seed script (creates/renames rows to match)
 * and by the app (hub nav order, `isKnownRubricSlug` for route/redirect disambiguation)
 * — never hardcode a rubric title/slug anywhere else.
 */
export const RUBRICS_CONFIG: Array<{ title: string; slug: string; description: string }> = [
  { title: 'Події', slug: 'podii', description: 'Головні події дня в Україні та світі.' },
  { title: 'Політика', slug: 'polityka', description: 'Державна влада, рішення, заяви політиків.' },
  { title: 'Війна і безпека', slug: 'viina', description: 'Хід війни, оборона, безпека.' },
  { title: 'Економіка', slug: 'ekonomika', description: 'Бізнес, ринки, державні фінанси.' },
  { title: 'Гроші', slug: 'groshi', description: 'Ціни, виплати, тарифи, особисті фінанси.' },
  { title: 'Світ', slug: 'svit', description: 'Міжнародні новини.' },
  { title: 'Суспільство', slug: 'suspilstvo', description: 'Соціальні теми, освіта, суспільні процеси.' },
  { title: 'Технології', slug: 'tekhnolohii', description: 'Технології, гаджети, інтернет.' },
  { title: "Здоров'я", slug: 'zdorovia', description: 'Медицина, здоров’я, охорона здоров’я.' },
  { title: 'Спорт', slug: 'sport', description: 'Спортивні новини та результати.' },
  { title: 'Культура', slug: 'kultura', description: 'Культура, мистецтво, медіа.' },
  { title: 'Регіони', slug: 'rehiony', description: 'Новини областей та міст України.' },
]

export const RUBRIC_SLUGS: readonly string[] = RUBRICS_CONFIG.map((r) => r.slug)

export function isKnownRubricSlug(slug: string): boolean {
  return RUBRIC_SLUGS.includes(slug)
}

/** Top-level path segments that are never a rubric slug — used to disambiguate routing. */
export const RESERVED_TOP_LEVEL_SEGMENTS: readonly string[] = [
  'api',
  'admin',
  'articles',
  'rubrics',
  'tag',
  'search',
  'corrections',
  'review',
  'sitemap.xml',
  'news-sitemap.xml',
  'feed.xml',
  'robots.txt',
  'favicon.ico',
  '_next',
]
