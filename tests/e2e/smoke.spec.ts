import { test, expect } from '@playwright/test'

test('homepage renders the feed and rubric nav', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.rubric-nav a').first()).toBeVisible()
  await expect(page.locator('.feed-item').first()).toBeVisible()
})

test('an article page renders title, lead and sources', async ({ page }) => {
  await page.goto('/')
  await page.locator('.feed-item h2 a').first().click()
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('.lead')).toBeVisible()
})
