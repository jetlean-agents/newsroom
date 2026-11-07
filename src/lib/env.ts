export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'
export const SITE_NAME = process.env.SITE_NAME || 'Newsroom (sandbox)'
export const NOINDEX = process.env.NOINDEX !== 'false'
export const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true'
export const TAG_NOINDEX_THRESHOLD = Number(process.env.TAG_NOINDEX_THRESHOLD || 3)

export function robotsMeta(): string {
  return NOINDEX ? 'noindex, nofollow' : 'index, follow'
}
