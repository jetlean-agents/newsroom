import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { parseFeed } from '@/lib/ingest/feedParser'

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf-8')
}

describe('parseFeed', () => {
  it('parses RSS 2.0 items', () => {
    const items = parseFeed(fixture('sample-rss.xml'))
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Уряд ухвалив новий бюджет на наступний рік')
    expect(items[0].url).toBe('https://outlet-a.example.com/news/budget-2027?utm_source=rss')
    expect(items[0].publishedAt).toBe(new Date('Fri, 06 Nov 2026 10:00:00 GMT').toISOString())
    expect(items[0].summary).toBe('Коротко про рішення уряду щодо бюджету.')
  })

  it('parses Atom entries, preferring the alternate link', () => {
    const items = parseFeed(fixture('sample-atom.xml'))
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe('https://outlet-c.example.com/entry/budget-approved')
    expect(items[0].title).toBe("Government approves next year's budget")
  })

  it('returns an empty list for a channel with no items', () => {
    const items = parseFeed('<rss version="2.0"><channel><title/></channel></rss>')
    expect(items).toEqual([])
  })

  it('decodes double-encoded entities some feeds leave in titles', () => {
    const xml = `<rss version="2.0"><channel><item>
      <title>World&amp;#039;s healthcare crisis</title>
      <link>https://example.com/a</link>
    </item></channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].title).toBe("World's healthcare crisis")
  })
})
