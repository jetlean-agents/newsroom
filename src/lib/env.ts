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
/** Model name passed to the AI provider. Default is Haiku 5.5 — the cheapest current Claude model (Roman's 09.11 budget decision) — unused by `none`/`mock`. */
export const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-5-5'
/** API key for the AI provider. Only read as a fallback when Autoreg (AUTOREG_*) has no key for this site — never logged. */
export const AI_API_KEY = process.env.AI_API_KEY || ''
/** Draft n-gram/shingle overlap with its source texts above this ratio (0-1) blocks publication (originality_blocked). */
export const ORIGINALITY_MAX_OVERLAP = Number(process.env.ORIGINALITY_MAX_OVERLAP || 0.5)
/** Hard cap on how many new AI drafts draftFromEvent() creates per UTC calendar day, so the review queue can't fill with thin content faster than editors can clear it. */
export const DRAFTS_PER_DAY = Number(process.env.DRAFTS_PER_DAY || 20)
/**
 * How many times `ingest-draft-from-event` runs per UTC day — `worker.ts`
 * schedules it `*\/10 * * * *`. Used only to compute `DRAFTS_PER_TICK`'s
 * default below; the cron expression itself is the actual source of truth.
 */
const DRAFT_FROM_EVENT_TICKS_PER_DAY = 144
/**
 * Cap on how many new AI drafts a *single* `draftFromEvent()` tick creates
 * (FACT-379): without this, a tick that finds a backlog of confirmed events
 * burns through the whole `DRAFTS_PER_DAY` budget in its first run or two
 * and leaves the rest of the day idle (sandbox measurement, FACT-341 10.11
 * 01:22 UTC: `drafted 39` in one tick, then `skippedBudget 89` for the rest
 * of the day) — spreading drafts across the day instead gives editors (and,
 * with AUTO_PUBLISH on, readers) a steadier stream. Defaults to
 * `ceil(DRAFTS_PER_DAY / ticks_per_day)` so a lone default install still
 * paces itself without needing this set explicitly.
 */
export const DRAFTS_PER_TICK = Number(
  process.env.DRAFTS_PER_TICK || Math.max(1, Math.ceil(DRAFTS_PER_DAY / DRAFT_FROM_EVENT_TICKS_PER_DAY)),
)

// --- Autoreg (FACT-337): the anthropic provider's key/spend source of truth ---
/** Autoreg base URL, e.g. https://autoreg.bigear.uk — unset means Autoreg is not wired up; the anthropic provider falls back to AI_API_KEY. */
export const AUTOREG_API_URL = process.env.AUTOREG_API_URL || ''
/** Service token scoped `secrets:read usage:write`, granted access to AUTOREG_SITE_SLUG. Never logged. */
export const AUTOREG_SERVICE_TOKEN = process.env.AUTOREG_SERVICE_TOKEN || ''
/** This site's slug in Autoreg (registry.Site.slug), e.g. "news". */
export const AUTOREG_SITE_SLUG = process.env.AUTOREG_SITE_SLUG || ''
/** Specific secret id to fetch (e.g. 3, "Новини — Claude (sandbox)"); unset = fetch the first active `anthropic` key bound to the site. */
export const AUTOREG_SECRET_ID = process.env.AUTOREG_SECRET_ID ? Number(process.env.AUTOREG_SECRET_ID) : null
/** How long the fetched key is cached in memory before Autoreg is polled again (a vault lookup, not a hot path). */
export const AUTOREG_KEY_TTL_SECONDS = Number(process.env.AUTOREG_KEY_TTL_SECONDS || 3600)

/** Local same-process spend guard, independent of whatever Autoreg itself enforces on the key. Clamped to <= 10 per Roman's 09.11 budget decision — never trust a misconfigured higher value. */
export const AI_SPEND_LIMIT_USD = Math.min(Number(process.env.AI_SPEND_LIMIT_USD || 10), 10)
/** Rolling window `AI_SPEND_LIMIT_USD` applies over. */
export const AI_SPEND_PERIOD: 'day' | 'week' | 'month' = (
  ['day', 'week', 'month'] as const
).includes(process.env.AI_SPEND_PERIOD as 'day' | 'week' | 'month')
  ? (process.env.AI_SPEND_PERIOD as 'day' | 'week' | 'month')
  : 'week'

/**
 * Sandbox-only auto-publish gate (FACT-337 scope item 4): when true, an
 * `anthropic`-pipeline draft with no originality_blocked, no fact_flags and
 * no sensitive-topic match publishes itself; everything else (including
 * every draft whenever this is false) still needs a human in /review.
 * Prod default is false — Roman's 09.11 decision: sandbox autopublish is
 * allowed, prod autopublish needs a separate sign-off.
 */
export const AUTO_PUBLISH = process.env.AUTO_PUBLISH === 'true'

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
