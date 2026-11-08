import { describe, expect, it } from 'vitest'
import { APIError } from 'payload'
import { Articles } from '@/collections/Articles'
import { SYSTEM_AUTHOR_EMAIL } from '@/lib/ingest/systemAuthor'

// `beforeChange[0]` is the hook that runs the publish-transition guard
// (src/collections/Articles.ts assertValidTransition) before any other side effect.
const runTransitionHook = (Articles.hooks as any).beforeChange[0]

/** `sourceItems` stands in for the event's SourceItems — only consulted when `extra.ai_assisted` is set. */
function attemptStatusChange(
  role: string,
  nextStatus: string,
  prevStatus?: string,
  extra?: Record<string, unknown>,
  sourceItems: Array<{ title: string; summary?: string }> = [],
) {
  return runTransitionHook({
    req: {
      user: { id: 999, role },
      payload: {
        find: async () => ({ docs: sourceItems }),
        findByID: async () => ({ email: 'someone@newsroom.test' }),
      },
    },
    data: { title: 'Test article', lead: 'Test lead', status: nextStatus, ...extra },
    originalDoc: prevStatus ? { status: prevStatus } : undefined,
  })
}

describe('Articles publish-transition guard (FACT-238)', () => {
  it('rejects an author publishing with a 403 APIError, not a bare 500-causing Error', async () => {
    let caught: any
    try {
      await attemptStatusChange('author', 'published', 'in_review')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(403)
  })

  it('rejects an editor publishing from the wrong prior status with a 400 APIError', async () => {
    let caught: any
    try {
      await attemptStatusChange('editor', 'published', 'draft')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })

  it('rejects an author unpublishing with a 403 APIError', async () => {
    let caught: any
    try {
      await attemptStatusChange('author', 'unpublished', 'published')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(403)
  })

  it('still allows an editor to publish from in_review (editor flow not broken)', async () => {
    await expect(attemptStatusChange('editor', 'published', 'in_review')).resolves.not.toThrow()
  })

  it('still allows an author to move a draft to in_review', async () => {
    await expect(attemptStatusChange('author', 'in_review', 'draft')).resolves.not.toThrow()
  })
})

describe('Articles originality guard — server-recomputed, not client-trusted (FACT-236 PO review)', () => {
  const copiedSource = [
    { title: 'Уряд ухвалив рішення про тарифи', summary: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.' },
  ]
  const copyingDraft = {
    ai_assisted: true,
    event: 1,
    title: 'Уряд ухвалив рішення про тарифи',
    lead: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.',
  }
  const originalDraft = {
    ai_assisted: true,
    event: 1,
    title: 'Цілком інший власний виклад події без копіювання джерела взагалі',
    lead: 'Повністю переписаний текст своїми словами, що не повторює джерело.',
  }

  it('rejects publishing when the recomputed overlap is actually too high', async () => {
    let caught: any
    try {
      await attemptStatusChange('editor', 'published', 'in_review', copyingDraft, copiedSource)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })

  it('cannot be bypassed by sending originality_blocked: false — server recompute wins', async () => {
    let caught: any
    try {
      await attemptStatusChange(
        'editor',
        'published',
        'in_review',
        { ...copyingDraft, originality_blocked: false },
        copiedSource,
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })

  it('allows publishing once the overlap genuinely drops (rewrite lifts the block — was a bug: block was permanent)', async () => {
    await expect(
      attemptStatusChange('editor', 'published', 'in_review', originalDraft, copiedSource),
    ).resolves.not.toThrow()
  })

  it('non-ai_assisted articles never run the overlap check regardless of client input', async () => {
    await expect(
      attemptStatusChange('editor', 'published', 'in_review', { originality_blocked: true }),
    ).resolves.not.toThrow()
  })
})

describe('ai_assisted is server-owned once an event is stored (FACT-287)', () => {
  const copiedSource = [
    { title: 'Уряд ухвалив рішення про тарифи', summary: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.' },
  ]
  const pipelineOriginalDoc = { status: 'in_review', event: 1, ai_assisted: true }

  it('rejects the recomputeOriginality bypass: editor PATCHing ai_assisted:false on a pipeline draft', async () => {
    let caught: any
    try {
      await runTransitionHook({
        req: {
          user: { id: 999, role: 'editor' },
          payload: {
            find: async () => ({ docs: copiedSource }),
            findByID: async () => ({ email: 'someone@newsroom.test' }),
          },
        },
        data: {
          title: 'Уряд ухвалив рішення про тарифи',
          lead: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.',
          status: 'published',
          ai_assisted: false,
        },
        originalDoc: pipelineOriginalDoc,
      })
    } catch (err) {
      caught = err
    }
    // Server ignores the client's ai_assisted:false, re-runs the overlap check, and still blocks.
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })

  it('keeps ai_assisted true in the saved data despite the client sending false', async () => {
    const result = await runTransitionHook({
      req: {
        user: { id: 999, role: 'editor' },
        payload: {
          find: async () => ({ docs: [] }),
          findByID: async () => ({ email: 'someone@newsroom.test' }),
        },
      },
      data: {
        title: 'Будь-яка новина',
        lead: 'Будь-який лід',
        status: 'in_review',
        ai_assisted: false,
      },
      originalDoc: { status: 'draft', event: 1, ai_assisted: true },
    })
    expect(result.ai_assisted).toBe(true)
  })

  it('lets an admin actually change ai_assisted on a pipeline-created article', async () => {
    const result = await runTransitionHook({
      req: {
        user: { id: 1, role: 'admin' },
        payload: {
          find: async () => ({ docs: [] }),
          findByID: async () => ({ email: 'someone@newsroom.test' }),
        },
      },
      data: {
        title: 'Будь-яка новина',
        lead: 'Будь-який лід',
        status: 'in_review',
        ai_assisted: false,
      },
      originalDoc: { status: 'draft', event: 1, ai_assisted: true },
    })
    expect(result.ai_assisted).toBe(false)
  })

  it('still allows setting ai_assisted freely on an article with no event', async () => {
    const result = await runTransitionHook({
      req: {
        user: { id: 999, role: 'editor' },
        payload: {
          find: async () => ({ docs: [] }),
          findByID: async () => ({ email: 'someone@newsroom.test' }),
        },
      },
      data: {
        title: 'Будь-яка новина',
        lead: 'Будь-який лід',
        status: 'in_review',
        ai_assisted: false,
      },
      originalDoc: { status: 'draft', ai_assisted: true },
    })
    expect(result.ai_assisted).toBe(false)
  })

  it('rejects the two-step bypass: clearing event first, then dropping ai_assisted on the next PATCH', async () => {
    // Step 1: editor tries to detach the event (ai_assisted untouched in this PATCH).
    const afterStep1 = await runTransitionHook({
      req: {
        user: { id: 999, role: 'editor' },
        payload: {
          find: async () => ({ docs: copiedSource }),
          findByID: async () => ({ email: 'someone@newsroom.test' }),
        },
      },
      data: {
        title: 'Уряд ухвалив рішення про тарифи',
        lead: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.',
        status: 'in_review',
        event: null,
      },
      originalDoc: pipelineOriginalDoc,
    })
    // `event` must stay server-owned — the client's null is discarded.
    expect(afterStep1.event).toBe(1)
    expect(afterStep1.ai_assisted).toBe(true)

    // Step 2: next PATCH's `originalDoc` reflects the (unchanged) saved state —
    // still has `event: 1` — so the guard still applies, and the editor's
    // attempt to drop ai_assisted while publishing is both discarded and
    // still blocked by the overlap check.
    let caught: any
    try {
      await runTransitionHook({
        req: {
          user: { id: 999, role: 'editor' },
          payload: {
            find: async () => ({ docs: copiedSource }),
            findByID: async () => ({ email: 'someone@newsroom.test' }),
          },
        },
        data: {
          title: 'Уряд ухвалив рішення про тарифи',
          lead: 'Кабмін підвищив тарифи з наступного місяця для всіх споживачів газу.',
          status: 'published',
          event: null,
          ai_assisted: false,
        },
        originalDoc: afterStep1,
      })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(APIError)
    expect(caught.status).toBe(400)
  })
})

describe('author/editor hand-off on publish (FACT-236 AC item 7)', () => {
  const editorUser = { id: 42, role: 'editor' }

  function publish(data: Record<string, unknown>, originalDoc: Record<string, unknown> = { status: 'in_review' }) {
    return runTransitionHook({
      req: {
        user: editorUser,
        payload: {
          find: async () => ({ docs: [] }),
          findByID: async () => ({ email: SYSTEM_AUTHOR_EMAIL }),
        },
      },
      data,
      originalDoc,
    })
  }

  it('records the publishing editor', async () => {
    const result = await publish({ title: 'T', lead: 'L', status: 'published', author: 7 })
    expect(result.editor).toBe(42)
  })

  it('replaces a system-placeholder author (referenced by id) with the publishing editor', async () => {
    const result = await publish({ title: 'T', lead: 'L', status: 'published', author: 1 })
    expect(result.author).toBe(42)
  })

  it('replaces a system-placeholder author (already-populated relationship object) with the publishing editor', async () => {
    const result = await publish({
      title: 'T',
      lead: 'L',
      status: 'published',
      author: { id: 1, email: SYSTEM_AUTHOR_EMAIL },
    })
    expect(result.author).toBe(42)
  })

  it('leaves a real author untouched', async () => {
    const result = await publish({
      title: 'T',
      lead: 'L',
      status: 'published',
      author: { id: 5, email: 'author@newsroom.test' },
    })
    expect(result.author).toEqual({ id: 5, email: 'author@newsroom.test' })
  })

  it('does not touch author/editor on a non-publish transition', async () => {
    const result = await publish({ title: 'T', lead: 'L', status: 'in_review', author: 1 }, { status: 'draft' })
    expect(result.editor).toBeUndefined()
    expect(result.author).toBe(1)
  })
})
