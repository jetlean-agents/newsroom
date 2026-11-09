import {
  AUTOREG_API_URL,
  AUTOREG_SERVICE_TOKEN,
  AUTOREG_SITE_SLUG,
  AUTOREG_SECRET_ID,
  AUTOREG_KEY_TTL_SECONDS,
} from '@/lib/env'

/**
 * Client for Autoreg's secrets vault + usage API (contract:
 * docs/integration-secrets.md in jetlean-agents/autoreg, reference client:
 * avto-traffic PR #68 / worker/src/avto_worker/autoreg.py — this is the
 * Node/TS equivalent for the newsroom worker, FACT-337).
 *
 * Nothing here ever logs, throws past its caller with, or embeds the raw key
 * value in an error message. Every failure (missing config, 401/403/404,
 * network/5xx/timeout) degrades to "no key from Autoreg this time" — the
 * caller (`draftProvider.ts`) decides whether to fall back to `AI_API_KEY`.
 */

const REQUEST_TIMEOUT_MS = 5000

function autoregConfigured(): boolean {
  return !!(AUTOREG_API_URL && AUTOREG_SERVICE_TOKEN && AUTOREG_SITE_SLUG)
}

type SecretRow = {
  id: number
  provider: string
  name: string
  value: string
  period: string
  limit_usd: string | null
  warning_threshold_pct: number | null
  is_active: boolean
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSecretRow(): Promise<SecretRow | null> {
  if (!autoregConfigured()) return null
  const headers = { Authorization: `Token ${AUTOREG_SERVICE_TOKEN}` }
  try {
    if (AUTOREG_SECRET_ID != null) {
      const url = `${AUTOREG_API_URL}/api/v1/secrets/${AUTOREG_SECRET_ID}/?site=${encodeURIComponent(AUTOREG_SITE_SLUG)}`
      const res = await fetchWithTimeout(url, { headers })
      if (res.status === 404) {
        console.warn(`[autoreg] secret id ${AUTOREG_SECRET_ID} not bound to site "${AUTOREG_SITE_SLUG}" (or inactive)`)
        return null
      }
      if (res.status === 401 || res.status === 403) {
        console.warn(`[autoreg] service token rejected (HTTP ${res.status}, scope secrets:read) — check AUTOREG_SERVICE_TOKEN`)
        return null
      }
      if (!res.ok) {
        console.warn(`[autoreg] secret fetch failed (HTTP ${res.status})`)
        return null
      }
      const row = (await res.json()) as SecretRow
      if (!row.is_active) return null
      return row
    }

    const url = `${AUTOREG_API_URL}/api/v1/secrets/?site=${encodeURIComponent(AUTOREG_SITE_SLUG)}`
    const res = await fetchWithTimeout(url, { headers })
    if (res.status === 401 || res.status === 403) {
      console.warn(`[autoreg] service token rejected (HTTP ${res.status}, scope secrets:read) — check AUTOREG_SERVICE_TOKEN`)
      return null
    }
    if (!res.ok) {
      console.warn(`[autoreg] secret list fetch failed (HTTP ${res.status})`)
      return null
    }
    const rows = (await res.json()) as SecretRow[]
    const row = rows.find((r) => r.provider === 'anthropic' && r.is_active)
    if (!row) console.warn(`[autoreg] no active "anthropic" key bound to site "${AUTOREG_SITE_SLUG}"`)
    return row ?? null
  } catch (err) {
    // Network error, timeout, or non-JSON body — Autoreg itself is the
    // problem, never a reason to crash the worker (contract doc: "never
    // block the worker's own startup waiting for Autoreg").
    console.warn(`[autoreg] secret fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export type ResolvedKey = {
  value: string
  source: 'autoreg' | 'env_fallback'
  secretId: number | null
}

let cached: { resolved: ResolvedKey; fetchedAtMs: number } | null = null

/**
 * In-memory only cache (never written to disk, never logged) — re-fetched
 * once per `AUTOREG_KEY_TTL_SECONDS` rather than on every call, since this
 * is a vault lookup, not a hot path. A refresh that fails after an earlier
 * one succeeded keeps returning the last working key instead of falling
 * back or stopping mid-run; only a first resolution with no earlier success
 * falls back.
 */
export async function resolveAnthropicKey(envFallback: string): Promise<ResolvedKey | null> {
  const now = Date.now()
  if (cached && now - cached.fetchedAtMs < AUTOREG_KEY_TTL_SECONDS * 1000) {
    return cached.resolved
  }

  const row = await fetchSecretRow()
  let resolved: ResolvedKey | null
  if (row) {
    resolved = { value: row.value, source: 'autoreg', secretId: row.id }
  } else if (cached?.resolved.source === 'autoreg') {
    console.warn(`[autoreg] key refresh failed mid-run — keeping last working Autoreg key (secret_id=${cached.resolved.secretId})`)
    resolved = cached.resolved
  } else if (envFallback) {
    if (autoregConfigured()) console.warn('[autoreg] using AI_API_KEY fallback for provider "anthropic"')
    resolved = { value: envFallback, source: 'env_fallback', secretId: null }
  } else {
    resolved = null
  }

  if (resolved) cached = { resolved, fetchedAtMs: now }
  return resolved
}

/** Test-only: clear the in-memory cache between test cases. */
export function _resetKeyCacheForTests(): void {
  cached = null
}

export type UsageEvent = {
  secretId: number
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string
  idempotencyKey?: string
}

/**
 * Best-effort usage report — never throws, never blocks generation. A
 * failure here is logged and dropped; it only means Autoreg's own ledger
 * under-counts this one event, not that the site stops working (per the
 * issue brief: "расход уходит в Autoreg" is additive bookkeeping, not a
 * dependency of the generation path itself).
 */
export async function reportUsage(event: UsageEvent): Promise<boolean> {
  if (!autoregConfigured()) return false
  try {
    const res = await fetchWithTimeout(`${AUTOREG_API_URL}/api/v1/usage/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${AUTOREG_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret_id: event.secretId,
        site: AUTOREG_SITE_SLUG,
        ts: new Date().toISOString(),
        requests: event.requests,
        input_tokens: event.inputTokens,
        output_tokens: event.outputTokens,
        cost_usd: event.costUsd.toFixed(4),
        model: event.model,
        idempotency_key: event.idempotencyKey,
      }),
    })
    if (!res.ok) {
      console.warn(`[autoreg] usage report failed (HTTP ${res.status})`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[autoreg] usage report failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * Site lifecycle events (collector runs, published, sent to review, errors):
 * NOT implemented — docs/integration-secrets.md (FACT-264) only documents
 * `/api/v1/secrets/`, `/api/v1/usage/` and `/api/v1/secrets/<id>/spend/`.
 * There is no site-events endpoint in the contract today. Flagged in the
 * FACT-337 handoff comment as a gap rather than guessed at here.
 */
export async function getSpendPct(secretId: number): Promise<number | null> {
  if (!autoregConfigured()) return null
  try {
    const res = await fetchWithTimeout(`${AUTOREG_API_URL}/api/v1/secrets/${secretId}/spend/`, {
      headers: { Authorization: `Token ${AUTOREG_SERVICE_TOKEN}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { pct_of_limit: number | null }
    return data.pct_of_limit ?? null
  } catch {
    return null
  }
}
