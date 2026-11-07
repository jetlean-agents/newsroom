import { XMLParser } from 'fast-xml-parser'

export interface RawFeedItem {
  title: string
  url: string
  publishedAt: string | null
  summary: string | null
}

type Node = Record<string, unknown>

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

function textOf(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'object' && '#text' in (node as Node)) {
    return String((node as Node)['#text'])
  }
  return String(node)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

/** Some feeds double-encode entities (e.g. `&amp;#039;` -> `&#039;` after XML parsing); decode what's left. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => NAMED_ENTITIES[name])
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function field(node: Node, key: string): unknown {
  return node[key]
}

/** Parses RSS 2.0 (`<rss><channel><item>`) or Atom (`<feed><entry>`) into a normalized shape. */
export function parseFeed(xml: string): RawFeedItem[] {
  const doc = parser.parse(xml) as Node

  const rss = field(doc, 'rss') as Node | undefined
  const channel = rss ? (field(rss, 'channel') as Node | undefined) : undefined
  const rssItems = asArray(channel ? (field(channel, 'item') as Node | Node[] | undefined) : undefined)

  if (rssItems.length) {
    return rssItems
      .map((item): RawFeedItem | null => {
        const link = textOf(field(item, 'link')).trim()
        const title = stripHtml(textOf(field(item, 'title'))).trim()
        if (!link || !title) return null
        const description = field(item, 'description')
        return {
          title,
          url: link,
          publishedAt: parseDate(textOf(field(item, 'pubDate') || field(item, 'dc:date'))),
          summary: description ? stripHtml(textOf(description)) : null,
        }
      })
      .filter((item): item is RawFeedItem => item !== null)
  }

  const feed = field(doc, 'feed') as Node | undefined
  const atomEntries = asArray(feed ? (field(feed, 'entry') as Node | Node[] | undefined) : undefined)

  return atomEntries
    .map((entry): RawFeedItem | null => {
      const links = asArray(field(entry, 'link') as Node | Node[] | undefined)
      const href =
        links.find((l) => field(l, '@_rel') === 'alternate')?.['@_href'] ??
        links[0]?.['@_href'] ??
        textOf(field(entry, 'link'))
      const title = stripHtml(textOf(field(entry, 'title'))).trim()
      if (!href || !title) return null
      const summary = field(entry, 'summary')
      return {
        title,
        url: String(href).trim(),
        publishedAt: parseDate(textOf(field(entry, 'published') || field(entry, 'updated'))),
        summary: summary ? stripHtml(textOf(summary)) : null,
      }
    })
    .filter((item): item is RawFeedItem => item !== null)
}

function parseDate(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
