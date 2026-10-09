import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { detail: 'Guest preview' } }))
})

test('chapter map opens its complete declared network and fit keeps nodes reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/atlas?course=CS03')
  await expect(page.locator('.chapter-region')).toHaveCount(8)
  await page.screenshot({ path: testInfo.outputPath('atlas-panorama.png'), fullPage: true, animations: 'disabled' })
  await page.locator('.chapter-region').filter({ hasText: '栈与队列' }).getByRole('button', { name: /栈与队列/ }).click()
  await expect(page.locator('.map-point:not(.is-external)')).toHaveCount(4)
  await expect(page.locator('.map-point').filter({ hasText: '解释并推演栈' })).toBeVisible()
  await page.getByRole('button', { name: '放大图谱', exact: true }).click()
  await page.getByRole('button', { name: '适应画布', exact: true }).click()
  await page.locator('.map-point').filter({ hasText: '解释并推演栈' }).click()
  await expect(page.locator('.objective-inspector h2')).toContainText('解释并推演栈')
  await expect(page.locator('.map-point[aria-pressed=true]')).toHaveCount(1)
  await expect(page.locator('.scope-total strong')).toContainText('0 / 32')
})

test('unstructured course panorama is a real small network with no invented chapters', async ({ page }) => {
  await page.goto('/atlas?course=CS05')
  await expect(page.locator('.map-point')).toHaveCount(2)
  await expect(page.locator('.map-point').filter({ hasText: '用真值表比较' })).toBeVisible()
  await expect(page.locator('.chapter-region')).toHaveCount(0)
  await page.locator('.map-point').filter({ hasText: '用真值表比较' }).click()
  await expect(page.getByRole('link', { name: '进入真值表工作台' })).toBeVisible()
})

test('phone small network fits both declared goals without hiding one offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/atlas?course=CS05')
  await expect(page.locator('.map-point')).toHaveCount(2)
  await page.getByRole('button', { name: '适应画布', exact: true }).click()
  const canvas = await page.locator('.atlas-map-viewport').boundingBox()
  for (const point of await page.locator('.map-point').all()) {
    const box = await point.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(canvas!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width)
  }
})

test('atlas restores an objective, view and relation selection through reload and browser history', async ({ page }) => {
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01&relations=application&view=map')
  await expect(page.locator('.objective-inspector h2')).toHaveText('解释并推演栈的后进先出行为')
  await expect(page.getByRole('button', { name: '严格先修', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '目录', exact: true }).click()
  await expect(page).toHaveURL(/view=list/)
  await page.reload()
  await expect(page.getByRole('button', { name: '目录', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goBack()
  await expect(page.getByRole('button', { name: '图谱', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('atlas renders directed relation lines and exposes their declared sources', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01')
  await expect(page.locator('.network-edges path[data-relation]').first()).toBeAttached()
  await expect(page.locator('.network-edges path[data-kind=mandatory_prerequisite]').first()).toHaveAttribute('marker-end', /.+/)
  await page.locator('.atlas-relations summary').click()
  await expect(page.locator('.focus-relations')).toContainText('来源：')
  await expect(page.locator('.scope-total strong')).toContainText('0 / 32')
  await page.locator('.atlas-relations summary').click()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.screenshot({ path: testInfo.outputPath('atlas-stack-desktop.png'), fullPage: true, animations: 'disabled' })
})

test('unbuilt goals offer an honest boundary instead of a dead learning route', async ({ page }) => {
  await page.goto('/atlas?course=CS03')
  await expect(page.locator('.atlas-workspace')).toBeVisible()
  const directory = page.getByRole('button', { name: '展开目录', exact: true })
  if (await directory.isVisible()) await directory.click()
  await page.getByLabel('查找知识点').fill('排序')
  await page.locator('.scope-search-row').first().click()
  const inspector = page.getByRole('complementary', { name: '目标证据与下一步' })
  await expect(inspector.getByRole('link', { name: /进入.*工作台/ })).toHaveCount(0)
  await expect(inspector.getByText('活动待建设', { exact: true })).toBeVisible()
  await expect(inspector).toContainText('尚未提供这个目标的理论实践活动')
})

test('state filtering has an explicit empty result and preserves the complete course denominator', async ({ page }) => {
  await page.goto('/atlas?course=CS03')
  await page.getByLabel('目标状态', { exact: true }).selectOption('verified')
  await expect(page.getByText('当前筛选没有匹配目标。', { exact: true })).toBeVisible()
  await expect(page.locator('.scope-total strong')).toContainText('0 / 32')
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.chapter-region')).toHaveCount(8)
})

test('CS05 uses the same atlas without inventing chapters; mobile scope can be collapsed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/atlas?course=CS05&goal=CS05-LOGIC-01')
  await expect(page.locator('.atlas-workspace')).toBeVisible()
  await expect(page.locator('.objective-inspector h2')).toHaveText('用真值表比较蕴含、逆否与双条件')
  await expect(page.getByRole('link', { name: '进入真值表工作台', exact: true })).toBeVisible()
  const toggle = page.getByRole('button', { name: '展开目录', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(page.getByLabel('查找知识点')).toBeVisible()
  await page.getByRole('button', { name: '收起目录', exact: true }).click()
  await expect(toggle).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.screenshot({ path: testInfo.outputPath('atlas-logic-mobile.png'), fullPage: true, animations: 'disabled' })
})
