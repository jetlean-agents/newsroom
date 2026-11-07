import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * `robotsMeta`/`thinPageRobotsMeta` read `NOINDEX` once at module load, so
 * each case resets the module cache after flipping `process.env.NOINDEX` —
 * proving the tech-spec.md §8 switch actually flips both directions, not
 * just that the sandbox default looks right.
 */
describe('NOINDEX env switch (tech-spec.md §8)', () => {
  const originalNoindex = process.env.NOINDEX

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NOINDEX = originalNoindex
  })

  it('indexable=false (sandbox default): everything is noindex,nofollow, including thin pages', async () => {
    process.env.NOINDEX = 'true'
    const { robotsMeta, thinPageRobotsMeta } = await import('@/lib/env')
    expect(robotsMeta()).toBe('noindex, nofollow')
    expect(thinPageRobotsMeta()).toBe('noindex, nofollow')
  })

  it('indexable=true: normal pages index,follow; thin/search pages stay noindex,follow', async () => {
    process.env.NOINDEX = 'false'
    const { robotsMeta, thinPageRobotsMeta } = await import('@/lib/env')
    expect(robotsMeta()).toBe('index, follow')
    expect(thinPageRobotsMeta()).toBe('noindex, follow')
  })
})
