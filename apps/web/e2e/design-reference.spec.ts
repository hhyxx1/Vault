import { expect, test } from '@playwright/test'

// The reference values come from document/prototypes/knowledge-atlas/style.css.
// Check visible geometry, not screenshots with incompatible course fixtures.
test('atlas preserves the approved desktop composition and compact next action', async ({ page }) => {
  await page.setViewportSize({ width: 1520, height: 960 })
  await page.goto('/atlas?course=CS03&chapter=ch-list&goal=CS03-LIST-02')
  const workspace = await page.locator('.atlas-workspace').boundingBox()
  const outline = await page.locator('.course-scope').boundingBox()
  const inspector = await page.locator('.objective-inspector').boundingBox()
  expect(workspace!.x).toBe(30)
  expect(workspace!.y).toBe(254)
  expect(workspace!.width).toBe(1460)
  expect(outline!.width).toBe(208)
  expect(inspector!.width).toBe(294)
  await expect(page.locator('.page-heading h1')).toHaveCSS('font-size', '31px')
  await expect(page.locator('.next-action')).toBeVisible()
  await expect(page.locator('.next-action')).toHaveCSS('background-color', 'rgb(237, 243, 255)')
  await expect(page.locator('.next-action')).toHaveCSS('display', 'block')
  expect(await page.locator('.next-action').evaluate(el => {
    const records = document.querySelector('.inspector-evidence')!
    return !!(el.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING)
  })).toBe(true)
  await expect(page.locator('.view-toggle button[aria-pressed=true]')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  expect(await page.locator('.scope-canvas').evaluate(el => el.clientWidth)).toBeGreaterThan(950)
})

test('all learning surfaces use the reference typography and page inset', async ({ page }) => {
  await page.setViewportSize({ width: 1520, height: 960 })
  for (const path of ['/', '/learn/CS03-STACK-01', '/learn/CS05-LOGIC-01', '/evidence', '/my-courses', '/teacher', '/local', '/account']) {
    await page.goto(path)
    await expect(page.locator('#main-content h1').first()).toHaveCSS('font-size', '31px')
    expect((await page.locator('.page').boundingBox())!.x).toBe(0)
    await expect(page.locator('.page')).toHaveCSS('padding-left', '30px')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 247, 251)')
  }
})

test('tablet course header keeps scope statistics beside the title until the phone breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 719, height: 960 })
  await page.goto('/atlas?course=CS03&chapter=ch-list&goal=CS03-LIST-02')
  const title = await page.locator('.atlas-course-header>div').first().boundingBox()
  const scope = await page.locator('.scope-total').boundingBox()
  expect(Math.abs(title!.y - scope!.y)).toBeLessThan(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
