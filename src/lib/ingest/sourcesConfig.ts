import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'yaml'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export interface SourceConfigEntry {
  id: string
  name: string
  type: 'rss' | 'api' | 'press'
  status: 'verified' | 'candidate'
  url: string
  language: string
  topics: string[]
  rubrics?: string[]
  terms_url?: string
  reuse_terms?: string
  attribution_required?: boolean
  poll_interval: string
  robots_ok?: string
  notes?: string
}

let cached: SourceConfigEntry[] | null = null
let byId: Map<string, SourceConfigEntry> | null = null

/** Reads config/sources.yaml (the FACT-167 registry) — the single source of truth for what to poll. */
export function loadSourcesConfig(): SourceConfigEntry[] {
  if (cached) return cached
  const configPath = path.resolve(dirname, '../../../config/sources.yaml')
  const raw = readFileSync(configPath, 'utf-8')
  const doc = parse(raw) as { sources: SourceConfigEntry[] }
  cached = doc.sources
  byId = new Map(cached.map((entry) => [entry.id, entry]))
  return cached
}

/**
 * FACT-382: the registry's `rubrics` list for a source is the feed-level rubric
 * mapping the issue brief asks the fallback classifier to try first — but only
 * when it's unambiguous (exactly one rubric declared). A source that legitimately
 * covers several rubrics (most do) carries no signal about which one any given
 * item belongs to, so it's skipped here and left to the keyword dictionary.
 */
export function getSourceFeedRubricSlug(sourceKey: string | undefined | null): string | null {
  if (!sourceKey) return null
  loadSourcesConfig()
  const entry = byId?.get(sourceKey)
  if (!entry?.rubrics || entry.rubrics.length !== 1) return null
  return entry.rubrics[0]
}

/** "15m" / "30m" / "1h" / "1d" -> a cron expression pg-boss can schedule. */
export function pollIntervalToCron(pollInterval: string): string {
  const match = pollInterval.match(/^(\d+)([mhd])$/)
  if (!match) return '0 * * * *'
  const [, amountStr, unit] = match
  const amount = Number(amountStr)
  if (unit === 'm') return amount >= 60 ? `0 */${Math.round(amount / 60)} * * *` : `*/${amount} * * * *`
  if (unit === 'h') return `0 */${amount} * * *`
  return `0 0 */${amount} * *`
}
