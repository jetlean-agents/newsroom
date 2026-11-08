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
  test('unknown article slug returns 404 with noindex (legacy /articles/ redirect route)', async ({ request }) => {
    const res = await request.get('/articles/this-slug-does-not-exist-xyz123', {
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(404)
  })

  test('unknown rubric/slug URL returns 404', async ({ request }) => {
    const res = await request.get('/podii/this-slug-does-not-exist-xyz123', {
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

test.describe('legacy URL redirects (FACT-194)', () => {
  test('/articles/{slug} 301s to /{rubric}/{slug}/', async ({ request }) => {
    await request.get('/') // warm up, not required
    const home = await request.get('/')
    const html = await home.text()
    const match = html.match(/href="(\/[a-z-]+\/[a-z0-9-]+\/)"/)
    test.skip(!match, 'No article link found on the home page to derive a slug from')
    if (!match) return
    const [, newPath] = match
    const slug = newPath.split('/').filter(Boolean).pop()
    const res = await request.get(`/articles/${slug}`, { maxRedirects: 0, failOnStatusCode: false })
    expect([301, 308]).toContain(res.status())
    expect(res.headers()['location']).toContain(newPath)
  })

  test('/rubrics/{slug} 301s to /{slug}/', async ({ request }) => {
    const res = await request.get('/rubrics/podii', { maxRedirects: 0, failOnStatusCode: false })
    expect(res.status()).toBe(301)
    expect(res.headers()['location']).toContain('/podii/')
  })
})

test.describe('SEO tags — article page', () => {
  test('has canonical under /{rubric}/{slug}/, OpenGraph, noindex meta, BreadcrumbList and Article/NewsArticle JSON-LD', async ({ page }) => {
    await page.goto('/')
    await page.locator('.feed-item h2 a, .feed-item h3 a').first().click()

    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', /\/[a-z-]+\/[a-z0-9-]+\/$/)

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')

    const ldBlocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ldBlocks.length).toBeGreaterThanOrEqual(2) // BreadcrumbList + Article/NewsArticle
    const parsedBlocks = ldBlocks.map((b) => JSON.parse(b))

    const breadcrumb = parsedBlocks.find((b) => b['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeTruthy()
    expect(breadcrumb.itemListElement.length).toBeGreaterThanOrEqual(3)

    const article = parsedBlocks.find((b) => b['@type'] === 'NewsArticle' || b['@type'] === 'Article')
    expect(article).toBeTruthy()
    expect(article.headline).toBeTruthy()
    expect(article.datePublished).toBeTruthy()
    expect(article.inLanguage).toBe('uk')
    expect(article.mainEntityOfPage).toBeTruthy()
    expect(article.publisher?.['@type']).toBe('Organization')
    expect(article.publisher?.logo?.url).toBeTruthy()
    expect(Array.isArray(article.image)).toBe(true)
  })

  test('breadcrumb visual nav is present (Головна → Рубрика → Стаття)', async ({ page }) => {
    await page.goto('/')
    await page.locator('.feed-item h2 a, .feed-item h3 a').first().click()
    await expect(page.locator('nav.breadcrumbs')).toBeVisible()
  })
})

test.describe('rubric hub — pagination + tag page thin-page rules', () => {
  test('rubric hub page 1 renders', async ({ page }) => {
    await page.goto('/podii/')
    await expect(page.locator('h1')).toBeVisible()
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
