export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'
export const SITE_NAME = process.env.SITE_NAME || 'Newsroom (sandbox)'
export const NOINDEX = process.env.NOINDEX !== 'false'
export const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true'
export const TAG_NOINDEX_THRESHOLD = Number(process.env.TAG_NOINDEX_THRESHOLD || 3)

/** Master switch for the ingestion worker; off means no outbound polling at all. */
export const INGEST_ENABLED = process.env.INGEST_ENABLED === 'true'
/** `candidate` sources (FACT-167) stay out of autopoll unless explicitly opted in. */
export const INGEST_INCLUDE_CANDIDATES = process.env.INGEST_INCLUDE_CANDIDATES === 'true'
/** An event needs this many distinct sources before "independent confirmation" is set. */
export const EVENT_CONFIRMATION_MIN_SOURCES = Number(process.env.EVENT_CONFIRMATION_MIN_SOURCES || 2)
/** AI draft-assist provider; "none" means the draft stays a plain source digest. */
export const AI_PROVIDER = process.env.AI_PROVIDER || 'none'

export function robotsMeta(): string {
  return NOINDEX ? 'noindex, nofollow' : 'index, follow'
}
