import { test, expect } from '@playwright/test'

test('homepage renders the feed and rubric nav', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.rubric-nav__list a').first()).toBeVisible()
  await expect(page.locator('.feed__item').first()).toBeVisible()
})

test('an article page renders title, lead and sources', async ({ page }) => {
  await page.goto('/')
  await page.locator('.feed__link').first().click()
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('.lead')).toBeVisible()
})
