import { describe, expect, it } from 'vitest'
import { isTagNoindex } from '@/lib/seo'

describe('isTagNoindex', () => {
  it('marks a tag noindex when it has fewer articles than the threshold', () => {
    expect(isTagNoindex(0, 3)).toBe(true)
    expect(isTagNoindex(2, 3)).toBe(true)
  })

  it('marks a tag indexable once it reaches the threshold', () => {
    expect(isTagNoindex(3, 3)).toBe(false)
    expect(isTagNoindex(10, 3)).toBe(false)
  })
})
