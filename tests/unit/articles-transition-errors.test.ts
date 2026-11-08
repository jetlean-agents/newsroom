import { describe, expect, it } from 'vitest'
import { APIError } from 'payload'
import { Articles } from '@/collections/Articles'

// `beforeChange[0]` is the hook that runs the publish-transition guard
// (src/collections/Articles.ts assertValidTransition) before any other side effect.
const runTransitionHook = (Articles.hooks as any).beforeChange[0]

function attemptStatusChange(role: string, nextStatus: string, prevStatus?: string) {
  return runTransitionHook({
    req: { user: { role } },
    data: { title: 'Test article', status: nextStatus },
    originalDoc: prevStatus ? { status: prevStatus } : undefined,
  })
}

describe('Articles publish-transition guard (FACT-238)', () => {
  it('rejects an author publishing with a 403 APIError, not a bare 500-causing Error', () => {
    let caught: any
    try {
      attemptStatusChange('author', 'published', 'in_review')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(403)
  })

  it('rejects an editor publishing from the wrong prior status with a 400 APIError', () => {
    let caught: any
    try {
      attemptStatusChange('editor', 'published', 'draft')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })

  it('rejects an author unpublishing with a 403 APIError', () => {
    let caught: any
    try {
      attemptStatusChange('author', 'unpublished', 'published')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(403)
  })

  it('still allows an editor to publish from in_review (editor flow not broken)', () => {
    expect(() => attemptStatusChange('editor', 'published', 'in_review')).not.toThrow()
  })

  it('still allows an author to move a draft to in_review', () => {
    expect(() => attemptStatusChange('author', 'in_review', 'draft')).not.toThrow()
  })
})
