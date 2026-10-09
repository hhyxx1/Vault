import { expect, test } from '@playwright/test'

test('a sparse local graph balances its visible nodes within the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1520, height: 960 })
  await page.goto('/atlas?course=CS03&goal=CS03-LIST-02')
  await expect.poll(() => page.locator('.atlas-map-viewport').evaluate(canvas => {
    const bounds = [...canvas.querySelectorAll('.map-point')].map(node => node.getBoundingClientRect())
    const center = (Math.min(...bounds.map(node => node.left)) + Math.max(...bounds.map(node => node.right))) / 2
    const rect = canvas.getBoundingClientRect()
    return Math.abs(center - (rect.x + rect.width / 2))
  })).toBeLessThan(3)
})

test('relation details navigate to the actual related objective and support browser back', async ({ page }) => {
  await page.setViewportSize({ width: 1520, height: 960 })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01&relations=mandatory_prerequisite,application')
  await page.locator('.atlas-relations > summary').click()
  const related = page.locator('.atlas-relations button').first()
  await expect(related).toBeVisible()
  const title = await related.textContent()
  await related.click()
  await expect(page.locator('.objective-inspector h2')).toHaveText(title!.replace(/^查看「|」$/g, ''))
  await expect(page.locator('.map-point[aria-pressed=true]')).toContainText(await page.locator('.objective-inspector h2').innerText())
  await page.goBack()
  await expect(page.locator('.objective-inspector h2')).toHaveText('解释并推演栈的后进先出行为')
})

test('node position transitions respect the system reduced motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 1520, height: 960 })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01')
  await expect(page.locator('.map-point').first()).toHaveCSS('transition-property', /left/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.map-point').first()).toHaveCSS('transition-duration', '0s')
  await page.locator('.map-point').filter({ hasText: '用栈设计括号匹配方法' }).click()
  await expect(page.locator('.objective-inspector h2')).toHaveText('用栈设计括号匹配方法')
  expect(await page.locator('.objective-inspector').evaluate(el => el.getAnimations().length)).toBe(0)
})

test('phone can return from the selected details to the same map node', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01')
  await page.locator('.map-point').filter({ hasText: '用栈设计括号匹配方法' }).click()
  await expect(page.locator('.objective-inspector')).toBeFocused()
  await page.getByRole('button', { name: '回到局部图谱', exact: true }).click()
  await expect(page.locator('.map-point[aria-pressed=true]')).toBeFocused()
  await expect(page.locator('.map-point[aria-pressed=true]')).toBeInViewport()
  await expect(page).toHaveURL(/goal=CS03-STACK-02/)
})
