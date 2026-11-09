import { getPayloadClient } from '@/lib/payload'
import { getDraftProvider, type DraftFact } from '@/lib/ai/draftProvider'
import { maxOverlap } from '@/lib/ai/originality'
import { factCheckFlags } from '@/lib/ai/factCheck'
import { classifySensitivity } from '@/lib/ai/sensitivity'
import { spendLimitReached } from '@/lib/ai/spendGuard'
import { prioritizeEvents } from '@/lib/review/priority'
import { ORIGINALITY_MAX_OVERLAP, DRAFTS_PER_DAY, AUTO_PUBLISH } from '@/lib/env'
import { SYSTEM_AUTHOR_EMAIL, AUTO_EDITOR_EMAIL, AUTO_EDITOR_NAME } from '@/lib/ingest/systemAuthor'
import type { Source, Rubric, Tag } from '@/payload-types'

const DEFAULT_RUBRIC_SLUG = 'bez-rubryky'

async function getOrCreateFallbackRubric() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'rubrics', where: { slug: { equals: DEFAULT_RUBRIC_SLUG } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'rubrics', data: { title: 'Без рубрики' }, disableTransaction: true })
}

async function findRubricBySlug(slug: string | undefined): Promise<Rubric | null> {
  if (!slug) return null
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'rubrics', where: { slug: { equals: slug } }, limit: 1 })
  return existing.docs[0] ?? null
}

async function getOrCreateTags(titles: string[] | undefined): Promise<Tag[]> {
  if (!titles?.length) return []
  const payload = await getPayloadClient()
  const tags: Tag[] = []
  for (const title of titles) {
    const existing = await payload.find({ collection: 'tags', where: { title: { equals: title } }, limit: 1 })
    tags.push(existing.docs[0] ?? (await payload.create({ collection: 'tags', data: { title }, disableTransaction: true })))
  }
  return tags
}

async function getOrCreateSystemAuthor() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'users', where: { email: { equals: SYSTEM_AUTHOR_EMAIL } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({
    collection: 'users',
    data: {
      name: 'Ingest (система)',
      email: SYSTEM_AUTHOR_EMAIL,
      password: `sys-${Math.random().toString(36).slice(2)}${Date.now()}`,
      role: 'author',
    },
    disableTransaction: true,
  })
}

/**
 * The real, disclosed byline for an AUTO_PUBLISH article (FACT-337 scope
 * item 4) — distinct from the ingest placeholder above, which only ever
 * reaches a reader after a human editor has claimed it.
 */
async function getOrCreateAutoEditor() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'users', where: { email: { equals: AUTO_EDITOR_EMAIL } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({
    collection: 'users',
    data: {
      name: AUTO_EDITOR_NAME,
      email: AUTO_EDITOR_EMAIL,
      password: `sys-${Math.random().toString(36).slice(2)}${Date.now()}`,
      role: 'editor',
    },
    disableTransaction: true,
  })
}

function paragraphNode(text: string) {
  return { type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text }] }
}

function headingNode(text: string) {
  return { type: 'heading', tag: 'h3', version: 1, children: [{ type: 'text', version: 1, text }] }
}

function buildLexicalBody(paragraphs: string[], whatIsKnown: string, whatIsUnknown: string) {
  const children = paragraphs.map(paragraphNode)
  if (whatIsKnown) {
    children.push(headingNode('Що відомо'), paragraphNode(whatIsKnown))
  }
  if (whatIsUnknown) {
    children.push(headingNode('Що невідомо'), paragraphNode(whatIsUnknown))
  }
  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children,
    },
  }
}

function startOfUtcDay(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function draftsCreatedToday(): Promise<number> {
  const payload = await getPayloadClient()
  const result = await payload.count({
    collection: 'articles',
    where: { drafted_at: { greater_than_equal: startOfUtcDay().toISOString() } },
  })
  return result.totalDocs
}

/**
 * Today's draft count per rubric id, so no single rubric can crowd out the
 * other 11 (issue brief: "распределение по рубрикам, не больше ~40% в
 * одной"). A plain count grouped in JS — the daily volume here (tens of
 * rows) makes a DB-side aggregate unnecessary.
 */
async function draftsPerRubricToday(): Promise<Map<number, number>> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { drafted_at: { greater_than_equal: startOfUtcDay().toISOString() } },
    depth: 0,
    limit: 2000,
    select: { rubric: true },
  })
  const counts = new Map<number, number>()
  for (const doc of result.docs) {
    const rubricId = typeof doc.rubric === 'object' ? (doc.rubric as Rubric).id : (doc.rubric as number)
    if (rubricId == null) continue
    counts.set(rubricId, (counts.get(rubricId) ?? 0) + 1)
  }
  return counts
}

/** Max drafts one rubric may take of DRAFTS_PER_DAY's daily budget. */
function rubricDailyCap(): number {
  return Math.max(1, Math.ceil(DRAFTS_PER_DAY * 0.4))
}

/**
 * Turns a confirmed event into a draft Article (FACT-169 scope item 4, extended
 * by FACT-236): the configured DraftProvider (AI_PROVIDER=none|mock|anthropic)
 * writes a UA-language draft from the event's source facts only — never
 * auto-published, never mixing in facts the sources didn't report.
 *
 * Adds (FACT-236):
 * - anti-copypaste: originality_overlap/originality_blocked (src/lib/ai/originality.ts)
 * - fact-check assist: fact_flags (src/lib/ai/factCheck.ts)
 * - queue prioritization: most-sourced, freshest events drafted first
 * - DRAFTS_PER_DAY cap so the review queue can't outgrow editor capacity
 *
 * `disableTransaction: true` on every write below for the same reason as
 * src/seed/index.ts: many sequential Local API calls on one connection can
 * leave it idle-in-transaction across calls and deadlock the next one
 * (Payload 3.37); each write here is already a single all-or-nothing op.
 */
export async function draftFromEvent() {
  const payload = await getPayloadClient()
  const events = await payload.find({
    collection: 'events',
    where: { and: [{ status: { equals: 'new' } }, { independent_confirmation: { equals: true } }] },
    limit: 200,
  })

  const ranked = prioritizeEvents(
    events.docs.map((e) => ({ id: e.id, sourceCount: e.source_count ?? 1, firstSeenAt: e.first_seen_at })),
  )
  const rankedEvents = ranked.map((r) => events.docs.find((e) => e.id === r.id)!)

  const provider = getDraftProvider()
  let budgetRemaining = Math.max(0, DRAFTS_PER_DAY - (await draftsCreatedToday()))

  // Checked once per run, not per event: a mid-run spend update from another
  // process wouldn't change this anyway, and it's one extra DB round trip
  // worth skipping when AI_PROVIDER isn't even "anthropic" (none/mock never
  // spend anything).
  const spendExhausted = provider.name === 'anthropic' && (await spendLimitReached())
  const rubricCounts = await draftsPerRubricToday()
  const rubricCap = rubricDailyCap()

  let drafted = 0
  let autoPublished = 0
  let skippedBudget = 0
  let skippedError = 0
  let skippedSpendLimit = 0
  let skippedRubricCap = 0
  // Counts per error message (FACT-362 AC1: "skippedError с причиной") —
  // provider failures group by message (e.g. rate limit vs. malformed
  // response) so the funnel report can tell *why* drafting failed, not just
  // how many times.
  const skippedErrorReasons: Record<string, number> = {}

  for (const event of rankedEvents) {
    if (budgetRemaining <= 0) {
      skippedBudget++
      continue
    }
    if (spendExhausted) {
      skippedSpendLimit++
      continue
    }

    const members = await payload.find({
      collection: 'source-items',
      where: { event: { equals: event.id } },
      sort: 'published_at',
      depth: 1,
      limit: 50,
    })
    if (!members.docs.length) continue

    const facts: DraftFact[] = members.docs.map((item) => ({
      title: item.title,
      summary: item.summary,
      url: item.url,
      publisher: typeof item.source === 'object' ? (item.source as Source).name : undefined,
      publishedAt: item.published_at,
    }))

    let draft
    try {
      draft = await provider.generateDraft({ eventTitle: event.title, facts })
    } catch (err) {
      console.error(`[draftFromEvent] provider "${provider.name}" failed for event ${event.id}:`, err)
      skippedError++
      const reason = err instanceof Error ? err.message : String(err)
      skippedErrorReasons[reason] = (skippedErrorReasons[reason] ?? 0) + 1
      continue
    }

    const rubric = (await findRubricBySlug(draft.suggestedRubricSlug)) ?? (await getOrCreateFallbackRubric())

    if ((rubricCounts.get(rubric.id) ?? 0) >= rubricCap) {
      // This rubric already has its ~40%-of-the-day share (issue brief:
      // "распределение по рубрикам, не больше ~40% в одной") — leave the
      // event `new` for a later run once other rubrics have caught up or
      // the daily cap resets, rather than drafting into an already-full
      // rubric. Doesn't consume the DRAFTS_PER_DAY budget: no draft was made.
      skippedRubricCap++
      continue
    }

    const author = await getOrCreateSystemAuthor()
    const tags = await getOrCreateTags(draft.tags)

    const bodyText = [draft.lead, ...draft.paragraphs, draft.whatIsKnown, draft.whatIsUnknown].filter(Boolean).join('\n')
    const sourceTexts = facts.map((f) => `${f.title} ${f.summary ?? ''}`)
    const overlap = draft.aiGenerated ? maxOverlap(bodyText, sourceTexts) : 0
    const originalityBlocked = overlap > ORIGINALITY_MAX_OVERLAP
    const factFlags = draft.aiGenerated ? factCheckFlags(bodyText, sourceTexts) : []

    const sources = facts.map((f) => ({ title: f.title, url: f.url, publisher: f.publisher, accessed_at: f.publishedAt }))

    // Sensitivity (FACT-337 scope item 4): the dictionary classifier plus
    // whatever the same Anthropic call itself judged — never trust either
    // signal alone (the dictionary catches keyword matches the model might
    // soften around; the model catches phrasing a keyword list can't see).
    const sensitivity = classifySensitivity(bodyText)
    const isSensitive = sensitivity.sensitive || !!draft.sensitive

    // `anthropic` writes a complete, publish-ready article (not a digest an
    // author still has to write from scratch like none/mock) — it goes
    // straight into the fast review queue (/review) instead of sitting in
    // `draft` waiting for someone to claim it, matching the issue brief's
    // "чувствительные темы... идут в /review".
    const isAnthropicPipeline = provider.name === 'anthropic' && draft.aiGenerated
    const initialStatus: 'draft' | 'in_review' = isAnthropicPipeline ? 'in_review' : 'draft'

    const eligibleForAutoPublish =
      AUTO_PUBLISH && isAnthropicPipeline && !originalityBlocked && factFlags.length === 0 && !isSensitive

    const article = await payload.create({
      collection: 'articles',
      data: {
        title: draft.title,
        lead: draft.lead,
        body: buildLexicalBody(draft.paragraphs, draft.whatIsKnown, draft.whatIsUnknown),
        rubric: rubric.id,
        tags: tags.map((t) => t.id),
        event: event.id,
        event_date: members.docs[0].published_at || members.docs[0].fetched_at,
        sources,
        status: initialStatus,
        author: author.id,
        drafted_at: new Date().toISOString(),
        ai_assisted: draft.aiGenerated,
        ai_disclosure: draft.aiGenerated
          ? isAnthropicPipeline
            ? 'Цей матеріал повністю згенеровано AI (Claude) на основі фактів і посилань нижче.'
            : 'Цей чернетковий матеріал згенеровано за допомогою AI з фактів нижче і перевірений редактором перед публікацією.'
          : undefined,
        originality_overlap: overlap,
        originality_blocked: originalityBlocked,
        fact_flags: factFlags,
        ai_cost_usd: draft.costUsd ?? null,
      },
      disableTransaction: true,
    })

    await payload.update({
      collection: 'events',
      id: event.id,
      data: { status: 'drafted', draft_article: article.id },
      disableTransaction: true,
    })
    drafted++
    budgetRemaining--
    rubricCounts.set(rubric.id, (rubricCounts.get(rubric.id) ?? 0) + 1)

    if (eligibleForAutoPublish) {
      try {
        const autoEditor = await getOrCreateAutoEditor()
        await payload.update({
          collection: 'articles',
          id: article.id,
          data: { status: 'published' },
          context: { autoPublish: true, autoEditorId: autoEditor.id },
          disableTransaction: true,
        })
        autoPublished++
      } catch (err) {
        // Defense in depth: the publish-transition guard in Articles.ts
        // (originality_blocked, in_review -> published only) re-checks
        // everything above independently. A rejection here just means the
        // article stays in_review for a human — never a reason to fail the
        // whole run.
        console.error(`[draftFromEvent] auto-publish rejected for article ${article.id}:`, err)
      }
    }
  }

  return {
    eventsConsidered: events.docs.length,
    drafted,
    autoPublished,
    skippedBudget,
    skippedError,
    skippedErrorReasons,
    skippedSpendLimit,
    skippedRubricCap,
    provider: provider.name,
  }
}
