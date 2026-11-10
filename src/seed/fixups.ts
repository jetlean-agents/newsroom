import type { Payload } from 'payload'
import { classifyFallbackRubric } from '@/lib/ai/rubricClassifier'

/**
 * FACT-381/FACT-382 data fixups, run by seed's `main()` on every deploy.
 * Split out of `src/seed/index.ts` so they're importable (and unit-testable)
 * without triggering that file's top-level `main().catch(...)` run.
 */

/**
 * FACT-381 bug #2: recategorizes articles already stuck in "Без рубрики"
 * (from before draftFromEvent.ts stopped using it as a fallback) onto a real
 * rubric via the same keyword classifier the pipeline now uses going
 * forward. Idempotent — queries "Без рубрики" itself, so a second run is a
 * no-op once every article has moved off it.
 *
 * FACT-382 PO review (PR #31): scoped to `status: 'published'` only. Since
 * FACT-382, `bez-rubryky` is also where draftFromEvent.ts deliberately parks
 * an unclassifiable draft under `in_review` for a human to pick its real
 * rubric (the /review queue) — this legacy published-article cleanup must
 * never touch those, or every redeploy's `npm run seed` would silently move
 * them to a keyword/suspilstvo guess before anyone reviewed them, undoing
 * FACT-382 AC2 on every deploy.
 */
export async function recategorizeBezRubrykyArticles(payload: Payload, rubricBySlug: (slug: string) => { id: number }) {
  const bezRubryky = await payload.find({ collection: 'rubrics', where: { slug: { equals: 'bez-rubryky' } }, limit: 1 })
  const stuckRubricId = bezRubryky.docs[0]?.id
  if (stuckRubricId == null) return

  const stuck = await payload.find({
    collection: 'articles',
    where: { and: [{ rubric: { equals: stuckRubricId } }, { status: { equals: 'published' } }] },
    limit: 200,
  })
  for (const doc of stuck.docs) {
    // Unlike the live pipeline (draftFromEvent.ts), this is a one-off cleanup
    // of already-published legacy articles — they need *some* real rubric
    // today, so a keyword miss here still lands on suspilstvo rather than
    // routing back into bez-rubryky (the article is published, not pending
    // review).
    const slug = classifyFallbackRubric(`${doc.title} ${doc.lead ?? ''}`) ?? 'suspilstvo'
    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { rubric: rubricBySlug(slug).id },
      disableTransaction: true,
    })
  }
}

/**
 * FACT-381 bug #3: the two QA-flagged "Гроші" drafts whose own text admits
 * the source didn't carry the actual figures ("Курс валют на 9 листопада",
 * "Бензин, дизель і автогаз...") already auto-published before this issue's
 * `insufficientFacts` gate (draftFromEvent.ts) existed to stop them. There's
 * no real number to backfill without scraping the full source article
 * (against docs/sources/policy.md §1) — so these are pulled back to `draft`
 * (never `unpublished`/410: they were never a legitimate published fact in
 * the first place) rather than "fixed" with invented content. Keyed by
 * exact title, idempotent.
 */
const INSUFFICIENT_FACTS_TITLES = ['Курс валют на 9 листопада', 'Бензин, дизель і автогаз']

export async function retractInsufficientFactsArticles(payload: Payload, editor: { id: number | string }) {
  for (const titlePrefix of INSUFFICIENT_FACTS_TITLES) {
    const existing = await payload.find({
      collection: 'articles',
      where: { title: { like: titlePrefix } },
      limit: 5,
    })
    for (const doc of existing.docs) {
      if (doc.status === 'draft') continue
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { status: 'draft', featured: false },
        user: editor,
        disableTransaction: true,
      })
    }
  }
}

/**
 * FACT-381 bug #4: the clustering fix (src/lib/ingest/hash.ts — bare numeric
 * tokens no longer drive a simhash match) stops this happening going
 * forward, but the one already-published article needs its mismatched first
 * source corrected by hand: it cited a 032.ua article about a forest sale
 * that only coincidentally shared the sum "27 млн грн" with the real event
 * (electrical-grid equipment procurement in Lviv), not the actual story.
 * Idempotent — only touches the doc if that exact bad source URL is still
 * first in `sources`.
 */
const LVIV_PROCUREMENT_ARTICLE_TITLE = 'У Львові закупили нову техніку для ремонту електромереж за 27 млн грн'
const LVIV_PROCUREMENT_BAD_SOURCE_URL_FRAGMENT = '032.ua'

export async function fixLvivProcurementSource(payload: Payload) {
  const existing = await payload.find({
    collection: 'articles',
    where: { title: { equals: LVIV_PROCUREMENT_ARTICLE_TITLE } },
    limit: 1,
  })
  const doc = existing.docs[0]
  if (!doc) return
  const sources = (doc.sources ?? []) as Array<{ title?: string; url?: string; publisher?: string; accessed_at?: string }>
  const badIndex = sources.findIndex((s) => s.url?.includes(LVIV_PROCUREMENT_BAD_SOURCE_URL_FRAGMENT))
  if (badIndex === -1) return
  const fixedSources = sources.filter((_, i) => i !== badIndex)
  await payload.update({
    collection: 'articles',
    id: doc.id,
    data: { sources: fixedSources },
    disableTransaction: true,
  })
}
