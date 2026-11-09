/**
 * Cost estimation for Anthropic draft generation (FACT-337 scope item 2):
 * "посчитай фактическую цену и укажи её в отчёте". Prices are $/million
 * tokens, standard (<=100K input) tier, verified against third-party
 * pricing trackers quoting Anthropic's own page as of 2026-11 — re-check
 * https://platform.claude.com/docs/en/about-claude/pricing before relying
 * on this for a real budget decision; override via AI_PRICE_INPUT_PER_MTOK /
 * AI_PRICE_OUTPUT_PER_MTOK if it's drifted.
 */

const KNOWN_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5-5': { input: 3.0, output: 15.0 },
}

// Haiku 5.5 is the cheapest current Claude model and AI_MODEL's default
// (docs/env.md) — used whenever the configured model isn't in the table
// above, so a cost estimate is never silently skipped for an unrecognized
// model name.
const FALLBACK_PRICING = KNOWN_PRICING_USD_PER_MTOK['claude-haiku-5-5']

function envOverride(name: string): number | null {
  const raw = process.env[name]
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function pricingForModel(model: string): { input: number; output: number } {
  const inputOverride = envOverride('AI_PRICE_INPUT_PER_MTOK')
  const outputOverride = envOverride('AI_PRICE_OUTPUT_PER_MTOK')
  if (inputOverride != null && outputOverride != null) {
    return { input: inputOverride, output: outputOverride }
  }
  return KNOWN_PRICING_USD_PER_MTOK[model] ?? FALLBACK_PRICING
}

/** USD cost for one generation call given its token usage. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = pricingForModel(model)
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
}
