import { describe, expect, it } from 'vitest'
import { Articles } from '@/collections/Articles'

function fieldNames(fields: any[]): string[] {
  return fields.map((f) => f.name).filter(Boolean)
}

describe('Articles collection schema', () => {
  const names = fieldNames(Articles.fields as any[])

  it('includes every field required by the content model', () => {
    const required = [
      'title', 'slug', 'lead', 'body', 'rubric', 'tags', 'sources',
      'event_date', 'published_at', 'updated_at', 'status', 'author',
      'editor', 'ai_assisted', 'ai_disclosure', 'corrections',
    ]
    for (const name of required) {
      expect(names).toContain(name)
    }
  })

  it('restricts status to the four defined publication states', () => {
    const statusField = (Articles.fields as any[]).find((f) => f.name === 'status')
    const values = statusField.options.map((o: any) => o.value)
    expect(values).toEqual(['draft', 'in_review', 'published', 'unpublished'])
  })

  it('keeps slug read-only in the admin UI so it cannot be hand-edited after creation', () => {
    const slugField = (Articles.fields as any[]).find((f) => f.name === 'slug')
    expect(slugField.admin.readOnly).toBe(true)
  })
})
