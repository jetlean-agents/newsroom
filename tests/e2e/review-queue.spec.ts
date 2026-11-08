import { test, expect, type Page } from '@playwright/test'

/**
 * FACT-236: fast review queue (/review) e2e. Same env-gated pattern as
 * tests/e2e/editorial.spec.ts — needs real demo-account credentials that
 * live only in Dokploy env (docs/deploy.md); `test.skip`s itself without them
 * so this file is a no-op on a machine without them (local run, CI).
 *
 *   E2E_EDITOR_EMAIL / E2E_EDITOR_PASSWORD
 *   E2E_AUTHOR_EMAIL / E2E_AUTHOR_PASSWORD
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

async function createInReviewArticle(page: Page, authorId: string | number, rubricId: string | number, title: string) {
  const res = await page.request.post('/api/articles', {
    data: {
      title,
      lead: `${title} — e2e test lead.`,
      body: demoBody(`${title} — e2e test body, not a real article.`),
      rubric: rubricId,
      author: authorId,
      status: 'in_review',
      sources: [{ title: 'Приклад джерела', url: 'https://example.com/1', publisher: 'Example' }],
    },
  })
  expect(res.ok(), `create article failed: ${await res.text()}`).toBeTruthy()
  return (await res.json()).doc as { id: string | number; slug: string }
}

test.describe('fast review queue /review (skipped without E2E_* credentials)', () => {
  test('editor sees the draft, its lead, lead sources, and publishes it with one click', async ({ page }) => {
    test.skip(!haveEditorCreds, 'E2E_EDITOR_EMAIL/E2E_EDITOR_PASSWORD not set')

    const editor = await login(page, EDITOR_EMAIL!, EDITOR_PASSWORD!)
    const rubricId = await firstRubricId(page)
    const title = uniqueTitle('review-queue')
    const article = await createInReviewArticle(page, editor.id, rubricId, title)

    await page.goto(`/review?id=${article.id}`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByText('Приклад джерела')).toBeVisible()

    await page.getByRole('button', { name: /Опублікувати/ }).click()
    await expect(page.getByText(/Опубліковано/)).toBeVisible()

    const status = await page.request.get(`/api/articles/${article.id}`)
    expect((await status.json()).status).toBe('published')

    // Cleanup: don't leave an e2e article live on the public feed/sitemap.
    await page.request.patch(`/api/articles/${article.id}`, { data: { status: 'unpublished' } })
  })

  test('a logged-out visitor is redirected away from /review', async ({ page }) => {
    const res = await page.goto('/review')
    expect(res?.url()).not.toContain('/review')
  })

  test('an author (not editor/admin) is redirected away from /review', async ({ page }) => {
    test.skip(!haveAuthorCreds, 'E2E_AUTHOR_EMAIL/E2E_AUTHOR_PASSWORD not set')
    await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!)
    const res = await page.goto('/review')
    expect(res?.url()).not.toContain('/review')
  })
})
