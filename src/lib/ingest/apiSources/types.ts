import type { RawFeedItem } from '@/lib/ingest/feedParser'

/** API adapters normalize to the same shape the generic RSS/Atom parser produces. */
export type ApiItem = RawFeedItem

export interface ApiFetchResult {
  status: 'ok' | 'error'
  items: ApiItem[]
  error?: string
}
