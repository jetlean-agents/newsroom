import { getPayloadClient } from '@/lib/payload'
import { AI_SPEND_LIMIT_USD, AI_SPEND_PERIOD } from '@/lib/env'

/**
 * Local safety valve (FACT-337 scope item 2): "При исчерпании лимита
 * генерация останавливается, сайт продолжает работать." Independent of
 * whatever limit Autoreg itself enforces on the key (that's Autoreg's own
 * `limit_usd`/spend endpoint — a remote, shared-across-sites check); this is
 * a same-process guard that works even if Autoreg is unreachable or
 * misconfigured, by summing what this app itself has already spent.
 *
 * Spend already recorded against `Article.ai_cost_usd` (set once per draft
 * by draftFromEvent/AnthropicDraftProvider) is the ledger — no separate
 * table, same pattern as DRAFTS_PER_DAY counting `drafted_at`.
 */

const PERIOD_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

function periodStart(): Date {
  const ms = PERIOD_MS[AI_SPEND_PERIOD] ?? PERIOD_MS.week
  return new Date(Date.now() - ms)
}

export async function spentThisPeriodUsd(): Promise<number> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { drafted_at: { greater_than_equal: periodStart().toISOString() } },
        { ai_cost_usd: { greater_than: 0 } },
      ],
    },
    limit: 2000,
    depth: 0,
  })
  return result.docs.reduce((sum, doc) => sum + (doc.ai_cost_usd ?? 0), 0)
}

export async function spendLimitReached(): Promise<boolean> {
  const spent = await spentThisPeriodUsd()
  return spent >= AI_SPEND_LIMIT_USD
}
