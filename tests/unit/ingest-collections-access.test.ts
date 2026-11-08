import { describe, expect, it } from 'vitest'
import { Events } from '@/collections/Events'
import { SourceItems } from '@/collections/SourceItems'
import { AnalyticsEvents } from '@/collections/AnalyticsEvents'

function reqAs(user: { role: string } | null): any {
  return { req: { user } }
}

const ANON = reqAs(null)
const AUTHOR = reqAs({ role: 'author' })
const EDITOR = reqAs({ role: 'editor' })
const ADMIN = reqAs({ role: 'admin' })

describe('Events access control (FACT-204)', () => {
  it('blocks anonymous and author create — only admin/editor may create over REST', () => {
    expect((Events.access!.create as any)(ANON)).toBe(false)
    expect((Events.access!.create as any)(AUTHOR)).toBe(false)
    expect((Events.access!.create as any)(EDITOR)).toBe(true)
    expect((Events.access!.create as any)(ADMIN)).toBe(true)
  })

  it('blocks anonymous and author update — only admin/editor may update over REST', () => {
    expect((Events.access!.update as any)(ANON)).toBe(false)
    expect((Events.access!.update as any)(AUTHOR)).toBe(false)
    expect((Events.access!.update as any)(EDITOR)).toBe(true)
    expect((Events.access!.update as any)(ADMIN)).toBe(true)
  })

  it('blocks anonymous read', () => {
    expect((Events.access!.read as any)(ANON)).toBe(false)
    expect((Events.access!.read as any)(AUTHOR)).toBe(true)
  })
})

describe('SourceItems access control (FACT-204)', () => {
  it('blocks anonymous and author create — only admin/editor may create over REST', () => {
    expect((SourceItems.access!.create as any)(ANON)).toBe(false)
    expect((SourceItems.access!.create as any)(AUTHOR)).toBe(false)
    expect((SourceItems.access!.create as any)(EDITOR)).toBe(true)
    expect((SourceItems.access!.create as any)(ADMIN)).toBe(true)
  })

  it('blocks anonymous and author update — only admin/editor may update over REST', () => {
    expect((SourceItems.access!.update as any)(ANON)).toBe(false)
    expect((SourceItems.access!.update as any)(AUTHOR)).toBe(false)
    expect((SourceItems.access!.update as any)(EDITOR)).toBe(true)
    expect((SourceItems.access!.update as any)(ADMIN)).toBe(true)
  })

  it('blocks anonymous read', () => {
    expect((SourceItems.access!.read as any)(ANON)).toBe(false)
    expect((SourceItems.access!.read as any)(AUTHOR)).toBe(true)
  })
})

describe('AnalyticsEvents access control (FACT-204)', () => {
  it('allows anonymous create (reader beacons) — the field schema (closed kind enum + validated relationship) is what keeps this safe, not role checks', () => {
    expect((AnalyticsEvents.access!.create as any)(ANON)).toBe(true)
  })

  it('restricts read to admin only, even for other logged-in roles', () => {
    expect((AnalyticsEvents.access!.read as any)(ANON)).toBe(false)
    expect((AnalyticsEvents.access!.read as any)(AUTHOR)).toBe(false)
    expect((AnalyticsEvents.access!.read as any)(EDITOR)).toBe(false)
    expect((AnalyticsEvents.access!.read as any)(ADMIN)).toBe(true)
  })

  it('never allows update (beacons are write-once)', () => {
    expect((AnalyticsEvents.access!.update as any)(ADMIN)).toBe(false)
  })

  it('only exposes a closed-enum kind and a validated article relationship — no free-text payload field', () => {
    const names = (AnalyticsEvents.fields as any[]).map((f) => f.name)
    expect(names.sort()).toEqual(['article', 'kind'])
    const kindField = (AnalyticsEvents.fields as any[]).find((f) => f.name === 'kind')
    expect(kindField.type).toBe('select')
    expect(kindField.options.map((o: any) => o.value)).toEqual([
      'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100', 'next_article_click',
    ])
  })
})
