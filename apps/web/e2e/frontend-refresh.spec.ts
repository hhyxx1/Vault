import { expect, test } from '@playwright/test'

const pages = [
  ['入口', '/'],
  ['知识图谱', '/atlas?course=CS03'],
  ['学习工作台', '/learn/CS03-STACK-01'],
  ['逻辑工作台', '/learn/CS05-LOGIC-01'],
  ['学习证据', '/evidence'],
  ['个人课程', '/my-courses'],
  ['教师备课', '/teacher'],
  ['本地空间', '/local'],
  ['账号', '/account'],
] as const

const widths = [320, 390, 768, 1024, 1440, 1920]

test('redesigned learning surfaces stay readable and within the viewport across the supported width matrix', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 960 })
    for (const [name, path] of pages) {
      await page.goto(path)
      await expect(page.locator('#main-content h1').first(), `${name} should render at ${width}px`).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name} overflows at ${width}px`).toBe(true)
      if (width <= 390) {
        expect(await page.locator('.main-nav').evaluate(nav => nav.scrollWidth <= nav.clientWidth + 1), `${name} navigation is clipped at ${width}px`).toBe(true)
      }
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: 'disabled' })
      }
    }
  }
})
