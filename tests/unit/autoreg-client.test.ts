import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// env.ts reads AUTOREG_* at module-load time, so these must be set before
// the module under test is imported — vi.resetModules() + dynamic import
// per test is what lets each test run with a different "env".
async function freshClient() {
  vi.resetModules()
  return import('@/lib/autoreg/client')
}

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...originalEnv }
})

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

describe('resolveAnthropicKey (FACT-337 scope item 1)', () => {
  it('returns the Autoreg secret value when the site has an active key', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    process.env.AUTOREG_SECRET_ID = '3'
    const fetchMock = mockFetchOnce(200, { id: 3, provider: 'anthropic', value: 'sk-autoreg-secret', is_active: true })
    vi.stubGlobal('fetch', fetchMock)

    const { resolveAnthropicKey } = await freshClient()
    const resolved = await resolveAnthropicKey('')
    expect(resolved).toEqual({ value: 'sk-autoreg-secret', source: 'autoreg', secretId: 3 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/secrets/3/?site=news'),
      expect.objectContaining({ headers: { Authorization: 'Token tok' } }),
    )
  })

  it('falls back to AI_API_KEY on a 404 (secret not bound to this site)', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    process.env.AUTOREG_SECRET_ID = '3'
    vi.stubGlobal('fetch', mockFetchOnce(404, {}))

    const { resolveAnthropicKey } = await freshClient()
    const resolved = await resolveAnthropicKey('env-fallback-key')
    expect(resolved).toEqual({ value: 'env-fallback-key', source: 'env_fallback', secretId: null })
  })

  it('falls back to AI_API_KEY on a network error, never throwing', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { resolveAnthropicKey } = await freshClient()
    const resolved = await resolveAnthropicKey('env-fallback-key')
    expect(resolved).toEqual({ value: 'env-fallback-key', source: 'env_fallback', secretId: null })
  })

  it('returns null when neither Autoreg nor AI_API_KEY has anything', async () => {
    // Autoreg unconfigured (no AUTOREG_API_URL at all).
    delete process.env.AUTOREG_API_URL
    delete process.env.AUTOREG_SERVICE_TOKEN
    delete process.env.AUTOREG_SITE_SLUG
    vi.stubGlobal('fetch', vi.fn())

    const { resolveAnthropicKey } = await freshClient()
    const resolved = await resolveAnthropicKey('')
    expect(resolved).toBeNull()
  })

  it('never logs or embeds the raw key value in a thrown/propagated message', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    process.env.AUTOREG_SECRET_ID = '3'
    const secret = 'sk-super-secret-value'
    vi.stubGlobal('fetch', mockFetchOnce(200, { id: 3, provider: 'anthropic', value: secret, is_active: true }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { resolveAnthropicKey } = await freshClient()
    await resolveAnthropicKey('')
    for (const call of warnSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(secret)
    }
  })
})

describe('reportUsage (FACT-337 scope item 1) — best-effort, never throws', () => {
  it('posts the usage event to /api/v1/usage/ with the configured site', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    const fetchMock = mockFetchOnce(201, {})
    vi.stubGlobal('fetch', fetchMock)

    const { reportUsage } = await freshClient()
    const ok = await reportUsage({
      secretId: 3,
      requests: 1,
      inputTokens: 800,
      outputTokens: 400,
      costUsd: 0.00028,
      model: 'claude-haiku-5-5',
    })
    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/v1/usage/')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.site).toBe('news')
    expect(body.secret_id).toBe(3)
    expect(body.model).toBe('claude-haiku-5-5')
  })

  it('returns false (never throws) when Autoreg rejects the usage report', async () => {
    process.env.AUTOREG_API_URL = 'https://autoreg.example'
    process.env.AUTOREG_SERVICE_TOKEN = 'tok'
    process.env.AUTOREG_SITE_SLUG = 'news'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

    const { reportUsage } = await freshClient()
    const ok = await reportUsage({
      secretId: 3,
      requests: 1,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      model: 'claude-haiku-5-5',
    })
    expect(ok).toBe(false)
  })

  it('is a no-op (false, no fetch) when Autoreg is not configured', async () => {
    delete process.env.AUTOREG_API_URL
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { reportUsage } = await freshClient()
    const ok = await reportUsage({
      secretId: 3,
      requests: 1,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      model: 'claude-haiku-5-5',
    })
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
