import { test, expect, type Page } from '@playwright/test'

/**
 * FACT-171: editorial-flow E2E (publish state machine, role restrictions, 410 + corrections).
 *
 * Needs real demo-account credentials, which live only in Dokploy env (see
 * docs/deploy.md) — QA/Build has no access to that host. Every test here
 * reads its creds from env and `test.skip`s itself when they're missing, so
 * this file is a no-op on a machine without them (e.g. a local run, or CI).
 * DevOps runs it for real on Contabo with env sourced from Dokploy (FACT-226).
 *
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   E2E_EDITOR_EMAIL / E2E_EDITOR_PASSWORD
 *   E2E_AUTHOR_EMAIL / E2E_AUTHOR_PASSWORD
 *
 * All articles created here are prefixed "[E2E ...]" with a timestamp, and
 * never touch the 3 seed demo articles.
 */

const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD
const AUTHOR_EMAIL = process.env.E2E_AUTHOR_EMAIL
const AUTHOR_PASSWORD = process.env.E2E_AUTHOR_PASSWORD

const haveEditorCreds = !!(EDITOR_EMAIL && EDITOR_PASSWORD)
const haveAuthorCreds = !!(AUTHOR_EMAIL && AUTHOR_PASSWORD)

function uniqueTitle(label: string) {
  return `[E2E ${label}] ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function demoBody(text: string) {
  return {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text }], version: 1 }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

async function login(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/users/login', { data: { email, password } })
  expect(res.ok(), `login failed for ${email}: ${await res.text()}`).toBeTruthy()
  return (await res.json()).user as { id: string | number }
}

async function firstRubricId(page: Page) {
  const res = await page.request.get('/api/rubrics?limit=1')
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  expect(body.docs.length, 'no rubrics seeded on this environment').toBeGreaterThan(0)
  return body.docs[0].id as string | number
}

async function createDraftArticle(
  page: Page,
  { title, authorId, rubricId, eventId }: { title: string; authorId: string | number; rubricId: string | number; eventId?: string | number },
) {
  const res = await page.request.post('/api/articles', {
    data: {
      title,
      lead: `${title} — e2e test lead.`,
      body: demoBody(`${title} — e2e test body, not a real article.`),
      rubric: rubricId,
      author: authorId,
      ...(eventId ? { event: eventId } : {}),
      status: 'draft',
    },
  })
  expect(res.ok(), `create article failed: ${await res.text()}`).toBeTruthy()
  return (await res.json()).doc as { id: string | number; slug: string }
}

async function patchArticleStatus(page: Page, id: string | number, status: string) {
  return page.request.patch(`/api/articles/${id}`, { data: { status } })
}

test.describe('editorial flow (skipped without E2E_* credentials)', () => {
  test('editor takes event -> draft -> in_review -> published', async ({ page }) => {
    test.skip(!haveEditorCreds, 'E2E_EDITOR_EMAIL/E2E_EDITOR_PASSWORD not set')

    const editor = await login(page, EDITOR_EMAIL!, EDITOR_PASSWORD!)
    const rubricId = await firstRubricId(page)

    const now = new Date().toISOString()
    const eventRes = await page.request.post('/api/events', {
      data: { title: uniqueTitle('event'), first_seen_at: now, last_seen_at: now },
    })
    expect(eventRes.ok(), `create event failed: ${await eventRes.text()}`).toBeTruthy()
    const event = (await eventRes.json()).doc as { id: string | number }

    const article = await createDraftArticle(page, {
      title: uniqueTitle('editorial-flow'),
      authorId: editor.id,
      rubricId,
      eventId: event.id,
    })

    const toReview = await patchArticleStatus(page, article.id, 'in_review')
    expect(toReview.ok(), `draft -> in_review failed: ${await toReview.text()}`).toBeTruthy()

    const toPublished = await patchArticleStatus(page, article.id, 'published')
    expect(toPublished.ok(), `in_review -> published (as editor) failed: ${await toPublished.text()}`).toBeTruthy()

    const live = await page.request.get(`/articles/${article.slug}`)
    expect(live.status()).toBe(200)

    // Cleanup: retract so this test article doesn't linger on the public
    // feed/sitemap/rss after the run.
    await patchArticleStatus(page, article.id, 'unpublished')
  })

  test('author cannot publish (draft -> in_review is OK, in_review -> published is rejected)', async ({
    page,
  }) => {
    test.skip(!haveAuthorCreds, 'E2E_AUTHOR_EMAIL/E2E_AUTHOR_PASSWORD not set')

    const author = await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!)
    const rubricId = await firstRubricId(page)

    const article = await createDraftArticle(page, {
      title: uniqueTitle('author-flow'),
      authorId: author.id,
      rubricId,
    })

    const toReview = await patchArticleStatus(page, article.id, 'in_review')
    expect(toReview.ok(), `author draft -> in_review should be allowed: ${await toReview.text()}`).toBeTruthy()

    const publishAttempt = await patchArticleStatus(page, article.id, 'published')
    expect(publishAttempt.ok(), 'author should NOT be able to publish').toBeFalsy()
    expect([400, 403]).toContain(publishAttempt.status())
  })

  test('retracting a published article returns 410 and records a correction', async ({ page }) => {
    test.skip(!haveEditorCreds, 'E2E_EDITOR_EMAIL/E2E_EDITOR_PASSWORD not set')

    const editor = await login(page, EDITOR_EMAIL!, EDITOR_PASSWORD!)
    const rubricId = await firstRubricId(page)

    const article = await createDraftArticle(page, {
      title: uniqueTitle('retraction-flow'),
      authorId: editor.id,
      rubricId,
    })

    expect((await patchArticleStatus(page, article.id, 'in_review')).ok()).toBeTruthy()
    expect((await patchArticleStatus(page, article.id, 'published')).ok()).toBeTruthy()

    const correctionNote = `E2E: матеріал знято з публікації (тест ${Date.now()}).`
    const retract = await page.request.patch(`/api/articles/${article.id}`, {
      data: {
        status: 'unpublished',
        corrections: [{ date: new Date().toISOString(), note: correctionNote }],
      },
    })
    expect(retract.ok(), `retract failed: ${await retract.text()}`).toBeTruthy()

    const gone = await page.request.get(`/articles/${article.slug}`)
    expect(gone.status()).toBe(410)

    // NOTE for whoever reviews a failure here: src/app/(frontend)/corrections/page.tsx
    // queries `where: { status: { equals: 'published' } }`, so a retracted
    // (status: 'unpublished') article is excluded from /corrections even
    // though it carries a corrections entry. This assertion encodes the
    // issue's literal AC ("снятие -> 410 + запись в исправлениях"); if it
    // fails, that query filter is the pre-existing root cause, not a new
    // regression from this spec or from the retraction itself — flag to
    // Developer rather than re-running.
    const correctionsPage = await page.request.get('/corrections')
    const body = await correctionsPage.text()
    expect(body).toContain(correctionNote)
  })
})
