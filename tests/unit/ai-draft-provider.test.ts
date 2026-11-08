import { describe, it, expect } from 'vitest'
import { NoneDraftProvider, MockDraftProvider, AnthropicDraftProvider, type DraftInput } from '@/lib/ai/draftProvider'

const input: DraftInput = {
  eventTitle: 'Уряд ухвалив рішення',
  facts: [
    { title: 'Уряд ухвалив рішення', summary: 'Деталі рішення.', url: 'https://a.example/1', publisher: 'Outlet A' },
    { title: 'Кабмін підтвердив рішення', summary: 'Підтвердження.', url: 'https://b.example/1', publisher: 'Outlet B' },
  ],
}

describe('NoneDraftProvider (AI_PROVIDER=none, the sandbox default)', () => {
  it('never produces AI-written prose — aiGenerated is false', async () => {
    const draft = await new NoneDraftProvider().generateDraft(input)
    expect(draft.aiGenerated).toBe(false)
  })

  it('cites every fact in the digest', async () => {
    const draft = await new NoneDraftProvider().generateDraft(input)
    expect(draft.paragraphs.join('\n')).toContain('Outlet A')
    expect(draft.paragraphs.join('\n')).toContain('Outlet B')
  })
})

describe('MockDraftProvider (AI_PROVIDER=mock, for tests and e2e)', () => {
  it('marks its output as AI-generated', async () => {
    const draft = await new MockDraftProvider().generateDraft(input)
    expect(draft.aiGenerated).toBe(true)
  })

  it('produces 3-6 paragraphs attributed to the sources, nothing invented', async () => {
    const draft = await new MockDraftProvider().generateDraft(input)
    expect(draft.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(draft.paragraphs.length).toBeLessThanOrEqual(6)
    for (const p of draft.paragraphs) {
      expect(p.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic for the same input (no randomness)', async () => {
    const provider = new MockDraftProvider()
    const a = await provider.generateDraft(input)
    const b = await provider.generateDraft(input)
    expect(a).toEqual(b)
  })
})

describe('AnthropicDraftProvider (AI_PROVIDER=anthropic — never called without AI_API_KEY)', () => {
  it('throws a clear error instead of calling out when AI_API_KEY is unset', async () => {
    await expect(new AnthropicDraftProvider().generateDraft(input)).rejects.toThrow(/AI_API_KEY/)
  })
})
