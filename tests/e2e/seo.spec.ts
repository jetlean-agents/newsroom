import { test, expect } from '@playwright/test'

/**
 * FACT-171: anonymous E2E + SEO coverage against the sandbox.
 * Editorial-flow (login) tests are intentionally NOT here — demo account
 * passwords live only in Dokploy env (docs/deploy.md), not reachable from
 * this run; see the FACT-171 handoff comment.
 */

test.describe('rubric hub', () => {
  test('renders a rubric page with its articles', async ({ page }) => {
    await page.goto('/')
    await page.locator('.rubric-nav a').first().click()
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.feed-item').first()).toBeVisible()
  })
})

test.describe('search', () => {
  test('search page renders a query form', async ({ page }) => {
    const res = await page.goto('/search')
    expect(res?.status()).toBe(200)
    await expect(page.locator('form')).toBeVisible()
  })

  test('search is noindex via meta and header', async ({ page, request }) => {
    await page.goto('/search')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    const res = await request.get('/search')
    expect(res.headers()['x-robots-tag']).toContain('noindex')
  })
})

test.describe('corrections', () => {
  test('corrections page renders', async ({ page }) => {
    const res = await page.goto('/corrections')
    expect(res?.status()).toBe(200)
  })
})

test.describe('404 / 410', () => {
  test('unknown article slug returns 404 with noindex', async ({ request }) => {
    const res = await request.get('/articles/this-slug-does-not-exist-xyz123', {
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(404)
    expect(res.headers()['x-robots-tag']).toContain('noindex')
  })

  // Not exercised: retracting/unpublishing an article requires editor/admin
  // login, which this run could not obtain (see handoff comment). The 410
  // path (src/app/api/articles/[slug]/status/route.ts + middleware.ts) is
  // read-verified in code but not driven end-to-end here.
})

test.describe('SEO tags — article page', () => {
  test('has canonical, OpenGraph, noindex meta and NewsArticle JSON-LD', async ({ page }) => {
    await page.goto('/')
    await page.locator('.feed-item h2 a').first().click()

    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', /^https:\/\/news\.bigear\.uk\/articles\//)

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')

    const ldJson = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(ldJson).toBeTruthy()
    const parsed = JSON.parse(ldJson ?? '{}')
    expect(parsed['@type']).toBe('NewsArticle')
    expect(parsed.headline).toBeTruthy()
    expect(parsed.datePublished).toBeTruthy()
    // Known gap (FACT-194, tracked separately, not a new bug here):
    // no `publisher`/`image`/`mainEntityOfPage`, and breadcrumbs render as a
    // plain <nav>, not a BreadcrumbList JSON-LD block.
  })

  test('breadcrumb nav is present (plain nav, not yet schema.org BreadcrumbList — FACT-194)', async ({
    page,
  }) => {
    await page.goto('/')
    await page.locator('.feed-item h2 a').first().click()
    await expect(page.locator('nav.meta')).toBeVisible()
  })
})

test.describe('sitemaps / feed — noindex + content-type', () => {
  for (const path of ['/sitemap.xml', '/news-sitemap.xml']) {
    test(`${path} is XML and noindex`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('xml')
      expect(res.headers()['x-robots-tag']).toContain('noindex')
    })
  }

  test('/feed.xml is RSS and noindex', async ({ request }) => {
    const res = await request.get('/feed.xml')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('rss')
    expect(res.headers()['x-robots-tag']).toContain('noindex')
  })

  test('/robots.txt disallows all on sandbox', async ({ request }) => {
    const res = await request.get('/robots.txt')
    const body = await res.text()
    expect(body).toContain('Disallow: /')
  })
})

test.describe('reading analytics', () => {
  test('scroll fires a scroll_* analytics beacon', async ({ page }) => {
    await page.goto('/')
    await page.locator('.feed-item h2 a').first().click()

    const beacon = page.waitForRequest(
      (req) =>
        req.url().includes('/api/analytics/scroll') &&
        req.method() === 'POST' &&
        /scroll_\d+/.test(req.postData() ?? ''),
      { timeout: 10_000 },
    )
    await page.mouse.wheel(0, 20000)
    await expect(beacon).resolves.toBeTruthy()
  })
})

test.describe('visual — mobile + desktop', () => {
  test('home and article render on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12-ish
    await page.goto('/')
    await expect(page.locator('.feed-item').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })

    await page.locator('.feed-item h2 a').first().click()
    await page.waitForURL(/\/articles\//)
    // `.lead` only exists on the article template — home also has an <h1>,
    // so asserting on h1 alone let a previous version of this test
    // screenshot the still-home page before the SPA navigation landed.
    await expect(page.locator('.lead')).toBeVisible()
    await page.screenshot({ path: 'test-results/article-mobile.png', fullPage: true })
  })

  test('home and article render on a desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('.feed-item').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })

    await page.locator('.feed-item h2 a').first().click()
    await page.waitForURL(/\/articles\//)
    await expect(page.locator('.lead')).toBeVisible()
    await page.screenshot({ path: 'test-results/article-desktop.png', fullPage: true })
  })
})
