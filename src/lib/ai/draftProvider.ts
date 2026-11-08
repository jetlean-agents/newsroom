import { AI_PROVIDER, AI_MODEL, AI_API_KEY } from '@/lib/env'

/**
 * One fact the draft is allowed to use — only fields SourceItems is allowed to
 * store (title/summary/url/publisher/dates), never a scraped full article body
 * (docs/editorial-pipeline.md, docs/sources/policy.md).
 */
export type DraftFact = {
  title: string
  summary?: string | null
  url: string
  publisher?: string | null
  publishedAt?: string | null
}

export type DraftInput = {
  eventTitle: string
  facts: DraftFact[]
}

export type DraftOutput = {
  title: string
  lead: string
  /** 3-6 body paragraphs, UA prose. */
  paragraphs: string[]
  whatIsKnown: string
  whatIsUnknown: string
  suggestedRubricSlug?: string
  tags?: string[]
  /** False for the `none` provider's plain facts digest — never actual AI-written prose. */
  aiGenerated: boolean
}

/**
 * A draft provider turns a cluster of source facts into a UA-language draft.
 * `none` and `mock` need no external call and no key; a real provider
 * (`anthropic`) is only ever selected via AI_PROVIDER — see docs/env.md.
 */
export interface DraftProvider {
  readonly name: string
  generateDraft(input: DraftInput): Promise<DraftOutput>
}

function factLine(fact: DraftFact): string {
  const bits = [fact.title]
  if (fact.summary) bits.push(fact.summary)
  const attribution = fact.publisher ? ` (${fact.publisher})` : ''
  return `${bits.join(' — ')}${attribution}`
}

/**
 * Default provider: no AI call, no AI-written prose at all — a plain
 * facts-with-citations scaffold for the human author to rewrite from scratch.
 * This is what AI_PROVIDER=none (the sandbox default) resolves to.
 */
export class NoneDraftProvider implements DraftProvider {
  readonly name = 'none'

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const facts = input.facts.map(factLine)
    return {
      title: input.eventTitle,
      lead: `[ЧЕРНОВИК-ЗАВДАННЯ] ${input.eventTitle}`,
      paragraphs: [`Факти з ${input.facts.length} джерел для самостійного переписування (не копіювати):`, ...facts],
      whatIsKnown: facts.join('\n'),
      whatIsUnknown: '',
      aiGenerated: false,
    }
  }
}

/**
 * Deterministic stand-in for a real LLM, used in tests and whenever
 * AI_PROVIDER=mock. Produces structured UA prose from the facts without ever
 * inventing a detail that isn't already in one of them.
 */
export class MockDraftProvider implements DraftProvider {
  readonly name = 'mock'

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { eventTitle, facts } = input
    const publishers = Array.from(new Set(facts.map((f) => f.publisher).filter(Boolean))) as string[]

    const lead = `${eventTitle}. За даними ${publishers.length || facts.length} джерел, подію підтверджено.`

    const paragraphs = facts.map((fact, i) => {
      const attribution = fact.publisher ? `За повідомленням ${fact.publisher}` : 'За даними джерела'
      const detail = fact.summary ? `: ${fact.summary}` : '.'
      return `${i === 0 ? attribution : `Крім того, ${attribution.toLowerCase()}`}${detail}`
    })

    return {
      title: eventTitle,
      lead,
      paragraphs,
      whatIsKnown: facts.map(factLine).join('\n'),
      whatIsUnknown: 'Деталі уточнюються; нові підтвердження з’являться в міру надходження.',
      tags: publishers.slice(0, 3),
      aiGenerated: true,
    }
  }
}

const ANTHROPIC_SYSTEM_PROMPT = `Ти — редакційний асистент українського новинного сайту. Пишеш короткий чернетковий матеріал
українською мовою виключно на основі наданих фактів (заголовок, стислий виклад, посилання, видавець, дата) кожного джерела.

ПРАВИЛА (порушувати заборонено):
- Не вигадуй цитати, людей, посади, цифри, дати чи деталі, яких немає у наданих фактах.
- Кожне твердження має спиратися на один із наданих фактів.
- Якщо інформації недостатньо для якогось аспекту — прямо напиши це в "whatIsUnknown", а не вигадуй.
- Нейтральний, стриманий тон новинного репортажу.

Відповідай ЛИШЕ JSON без жодного тексту навколо, у форматі:
{"title": string, "lead": string, "paragraphs": string[3..6], "whatIsKnown": string, "whatIsUnknown": string, "suggestedRubricSlug": string, "tags": string[]}`

/**
 * Real provider, selected only via AI_PROVIDER=anthropic once Roman's budget/key
 * decision is wired into AI_API_KEY (epic FACT-164 / key storage FACT-262). Safe
 * to leave selected with no key present: generateDraft throws a clear error
 * instead of silently calling out, and draftFromEvent treats that the same as
 * any other per-event failure (skips the event, keeps going).
 */
export class AnthropicDraftProvider implements DraftProvider {
  readonly name = 'anthropic'

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    if (!AI_API_KEY) {
      throw new Error('AI_PROVIDER=anthropic but AI_API_KEY is not set — see docs/env.md.')
    }

    const factsBlock = input.facts
      .map((f, i) => `${i + 1}. ${f.title}${f.summary ? ` — ${f.summary}` : ''} [${f.publisher ?? 'джерело'}, ${f.url}]`)
      .join('\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 2000,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Подія: ${input.eventTitle}\n\nФакти:\n${factsBlock}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = data.content?.find((block) => block.type === 'text')?.text
    if (!text) throw new Error('Anthropic response had no text content block.')

    let parsed: Omit<DraftOutput, 'aiGenerated'>
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`Anthropic response was not valid JSON: ${text.slice(0, 200)}`)
    }

    return { ...parsed, aiGenerated: true }
  }
}

export function getDraftProvider(): DraftProvider {
  switch (AI_PROVIDER) {
    case 'mock':
      return new MockDraftProvider()
    case 'anthropic':
      return new AnthropicDraftProvider()
    case 'none':
    default:
      return new NoneDraftProvider()
  }
}
