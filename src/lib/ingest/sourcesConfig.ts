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
  terms_url?: string
  reuse_terms?: string
  attribution_required?: boolean
  poll_interval: string
  robots_ok?: string
  notes?: string
}

let cached: SourceConfigEntry[] | null = null

/** Reads config/sources.yaml (the FACT-167 registry) — the single source of truth for what to poll. */
export function loadSourcesConfig(): SourceConfigEntry[] {
  if (cached) return cached
  const configPath = path.resolve(dirname, '../../../config/sources.yaml')
  const raw = readFileSync(configPath, 'utf-8')
  const doc = parse(raw) as { sources: SourceConfigEntry[] }
  cached = doc.sources
  return cached
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
