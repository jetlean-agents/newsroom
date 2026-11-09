import { describe, expect, it } from 'vitest'
import { estimateCostUsd, pricingForModel } from '@/lib/ai/pricing'

describe('pricing (FACT-337 scope item 2 — "посчитай фактическую цену")', () => {
  it('prices Haiku 5.5 (the AI_MODEL default) at $0.10/$0.50 per MTok', () => {
    expect(pricingForModel('claude-haiku-5-5')).toEqual({ input: 0.1, output: 0.5 })
  })

  it('computes a per-article cost well under the ~$0.04 budget (issue brief: $10/week, >=30 drafts/day)', () => {
    // A realistic draft call: ~800 input tokens (facts + system prompt), ~700 output tokens (150-500 UA words).
    const cost = estimateCostUsd('claude-haiku-5-5', 800, 700)
    expect(cost).toBeLessThan(0.04)
    expect(cost).toBeCloseTo(800 / 1_000_000 * 0.1 + 700 / 1_000_000 * 0.5, 10)
  })

  it('falls back to Haiku 5.5 pricing for an unrecognized model name rather than skipping the estimate', () => {
    expect(pricingForModel('some-future-model')).toEqual(pricingForModel('claude-haiku-5-5'))
  })
})
