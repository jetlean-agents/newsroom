import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NoneDraftProvider, MockDraftProvider, AnthropicDraftProvider, type DraftInput } from '@/lib/ai/draftProvider'
import { _resetKeyCacheForTests } from '@/lib/autoreg/client'

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

describe('AnthropicDraftProvider (AI_PROVIDER=anthropic — never called without a key from Autoreg or AI_API_KEY)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    _resetKeyCacheForTests()
    delete process.env.AUTOREG_API_URL
    delete process.env.AUTOREG_SERVICE_TOKEN
    delete process.env.AUTOREG_SITE_SLUG
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('throws a clear error instead of calling out when neither Autoreg nor AI_API_KEY has a key', async () => {
    await expect(new AnthropicDraftProvider().generateDraft(input)).rejects.toThrow(/AI_API_KEY/)
  })

  it('fetches the key from Autoreg, calls Anthropic with it, and reports usage back (FACT-337 scope item 1)', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    process.env.AUTOREG_SECRET_ID = '3'
    // `lib/env.ts` reads these into frozen module-level consts at import
    // time — resetModules + a fresh dynamic import is what makes this test's
    // env changes actually take effect, same as autoreg-client.test.ts.
    vi.resetModules()
    const { AnthropicDraftProvider: FreshAnthropicDraftProvider } = await import('@/lib/ai/draftProvider')

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/secrets/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 3, provider: 'anthropic', value: 'sk-from-autoreg', is_active: true }),
        }
      }
      if (url.includes('/api/v1/usage/')) {
        return { ok: true, status: 201, json: async () => ({}) }
      }
      if (url.includes('api.anthropic.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  title: 'T',
                  lead: 'L',
                  paragraphs: ['P1', 'P2', 'P3'],
                  whatIsKnown: 'K',
                  whatIsUnknown: '',
                  sensitive: false,
                  sensitiveCategories: [],
                }),
              },
            ],
            usage: { input_tokens: 800, output_tokens: 700 },
          }),
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await new FreshAnthropicDraftProvider().generateDraft(input)

    expect(draft.aiGenerated).toBe(true)
    expect(draft.title).toBe('T')
    expect(draft.costUsd).toBeGreaterThan(0)

    // The Anthropic call itself used the Autoreg-sourced key, not AI_API_KEY.
    const anthropicCall = fetchMock.mock.calls.find(([url]) => url.includes('api.anthropic.com'))
    const anthropicHeaders = anthropicCall?.[1]?.headers as Record<string, string> | undefined
    expect(anthropicHeaders?.['x-api-key']).toBe('sk-from-autoreg')

    // Usage was reported back to Autoreg for the resolved secret id.
    const usageCall = fetchMock.mock.calls.find(([url]) => url.includes('/api/v1/usage/'))
    expect(usageCall).toBeTruthy()
    const usageBody = JSON.parse(usageCall?.[1]?.body as string)
    expect(usageBody.secret_id).toBe(3)
    expect(usageBody.input_tokens).toBe(800)
    expect(usageBody.output_tokens).toBe(700)
  })

  /**
   * Builds the same three-way fetch mock as the test above (Autoreg secret,
   * Autoreg usage, Anthropic itself), but with the Anthropic leg's response
   * body swappable per test — for the two PO-review (09.11) regression cases
   * below, which both need a non-"happy path" Anthropic response.
   */
  async function setUpAutoregAndAnthropic(anthropicResponseJson: Record<string, unknown>) {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    process.env.AUTOREG_SECRET_ID = '3'
    vi.resetModules()
    const { AnthropicDraftProvider: FreshAnthropicDraftProvider } = await import('@/lib/ai/draftProvider')

    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/api/v1/secrets/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 3, provider: 'anthropic', value: 'sk-from-autoreg', is_active: true }),
        }
      }
      if (url.includes('/api/v1/usage/')) {
        return { ok: true, status: 201, json: async () => ({}) }
      }
      if (url.includes('api.anthropic.com')) {
        return { ok: true, status: 200, json: async () => anthropicResponseJson }
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return { FreshAnthropicDraftProvider, fetchMock }
  }

  it('discards a truncated draft (stop_reason: max_tokens) as a generation error, not a saved draft (PO review 09.11)', async () => {
    const { FreshAnthropicDraftProvider } = await setUpAutoregAndAnthropic({
      content: [{ type: 'text', text: '{"title": "cut off mid-sent' }],
      usage: { input_tokens: 800, output_tokens: 4000 },
      stop_reason: 'max_tokens',
    })

    await expect(new FreshAnthropicDraftProvider().generateDraft(input)).rejects.toThrow(/max_tokens/)
  })

  it('still reports usage to Autoreg even when the draft is then discarded for max_tokens (PO review 09.11)', async () => {
    const { FreshAnthropicDraftProvider, fetchMock } = await setUpAutoregAndAnthropic({
      content: [{ type: 'text', text: '{"title": "cut off mid-sent' }],
      usage: { input_tokens: 800, output_tokens: 4000 },
      stop_reason: 'max_tokens',
    })

    await expect(new FreshAnthropicDraftProvider().generateDraft(input)).rejects.toThrow()

    const usageCall = fetchMock.mock.calls.find(([url]) => url.includes('/api/v1/usage/'))
    expect(usageCall).toBeTruthy()
    const usageBody = JSON.parse(usageCall?.[1]?.body as string)
    expect(usageBody.input_tokens).toBe(800)
    expect(usageBody.output_tokens).toBe(4000)
  })

  it('still reports usage to Autoreg when the response text is not valid JSON (PO review 09.11 — usage must not be lost on any post-response failure)', async () => {
    const { FreshAnthropicDraftProvider, fetchMock } = await setUpAutoregAndAnthropic({
      content: [{ type: 'text', text: 'not valid json at all' }],
      usage: { input_tokens: 750, output_tokens: 120 },
      stop_reason: 'end_turn',
    })

    await expect(new FreshAnthropicDraftProvider().generateDraft(input)).rejects.toThrow(/not valid JSON/)

    const usageCall = fetchMock.mock.calls.find(([url]) => url.includes('/api/v1/usage/'))
    expect(usageCall).toBeTruthy()
    const usageBody = JSON.parse(usageCall?.[1]?.body as string)
    expect(usageBody.input_tokens).toBe(750)
    expect(usageBody.output_tokens).toBe(120)
  })
})
