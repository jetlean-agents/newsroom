export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'
/**
 * Base URL for server-to-self requests (e.g. middleware → API route). Must never be the
 * public SITE_URL: inside the container that hairpins back out through the edge/proxy for
 * the public hostname, which can hang or fail depending on network/DNS/TLS setup there
 * (FACT-244). Defaults to the app's own loopback address + listening port.
 */
export const INTERNAL_BASE_URL = process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`
export const SITE_NAME = process.env.SITE_NAME || 'Newsroom (sandbox)'
/** Home page `<meta name="description">` / `og:description` fallback (FACT-261 / QA FACT-259). */
export const SITE_DESCRIPTION =
  process.env.SITE_DESCRIPTION ||
  'Незалежний україномовний новинний ресурс: головні події дня, політика, економіка та новини світу.'
export const NOINDEX = process.env.NOINDEX !== 'false'
export const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true'
// docs/seo/tech-spec.md §8: thin tags/subrubrics need >= 30 articles to be worth indexing.
export const TAG_NOINDEX_THRESHOLD = Number(process.env.TAG_NOINDEX_THRESHOLD || 30)

/** Master switch for the ingestion worker; off means no outbound polling at all. */
export const INGEST_ENABLED = process.env.INGEST_ENABLED === 'true'
/** `candidate` sources (FACT-167) stay out of autopoll unless explicitly opted in. */
export const INGEST_INCLUDE_CANDIDATES = process.env.INGEST_INCLUDE_CANDIDATES === 'true'
/** An event needs this many distinct sources before "independent confirmation" is set. */
export const EVENT_CONFIRMATION_MIN_SOURCES = Number(process.env.EVENT_CONFIRMATION_MIN_SOURCES || 2)
/** AI draft-assist provider; "none" means the draft stays a plain source digest. */
export const AI_PROVIDER = process.env.AI_PROVIDER || 'none'
/** Model name passed to the AI provider (provider-specific; unused by `none`/`mock`). */
export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-5-5'
/** API key for the AI provider. Only read when AI_PROVIDER is a real provider (e.g. `anthropic`) — never logged. */
export const AI_API_KEY = process.env.AI_API_KEY || ''
/** Draft n-gram/shingle overlap with its source texts above this ratio (0-1) blocks publication (originality_blocked). */
export const ORIGINALITY_MAX_OVERLAP = Number(process.env.ORIGINALITY_MAX_OVERLAP || 0.5)
/** Hard cap on how many new AI drafts draftFromEvent() creates per UTC calendar day, so the review queue can't fill with thin content faster than editors can clear it. */
export const DRAFTS_PER_DAY = Number(process.env.DRAFTS_PER_DAY || 20)

export function robotsMeta(): string {
  return NOINDEX ? 'noindex, nofollow' : 'index, follow'
}

/**
 * For thin/duplicate-signal pages (internal search, paginated archives,
 * thin tags — tech-spec.md §8): on sandbox the sitewide `NOINDEX` kill switch
 * still wins (everything stays `noindex, nofollow`); once indexable, these
 * pages are `noindex, follow` rather than fully indexed or fully blocked.
 */
export function thinPageRobotsMeta(): string {
  return NOINDEX ? 'noindex, nofollow' : 'noindex, follow'
}
