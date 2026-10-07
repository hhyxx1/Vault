import { test, expect } from '@playwright/test'

test('reduced motion keeps every learning page and its main actions usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const route of ['/', '/atlas', '/learn/CS03-STACK-01', '/evidence', '/local', '/teacher']) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    const moving = await page.evaluate(() => [...document.querySelectorAll('main *, header *')].filter(element => {
      const style = getComputedStyle(element)
      return style.animationName !== 'none' || style.transitionDuration.split(',').some(value => parseFloat(value) > 0)
    }).map(element => element.tagName))
    expect(moving, `Motion should be disabled on ${route}`).toEqual([])
  }
})

test('the graph has an equivalent keyboard route without canvas interaction', async ({ page }) => {
  await page.goto('/atlas')
  const objective = page.getByRole('button', { name: /用栈设计括号匹配方法/ })
  await objective.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.objective-inspector h2')).toHaveText('用栈设计括号匹配方法')
  const enter = page.getByRole('link', { name: /打开学习工作台/ })
  await enter.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/learn/CS03-STACK-02')
  await expect(page.getByRole('button', { name: '保存作品版本', exact: true })).toBeEnabled()
  await expect(page.getByText('代码运行尚未开放', { exact: true })).toBeVisible()
})

test('two hundred percent zoom keeps local controls and teacher navigation reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const route of ['/', '/atlas', '/learn/CS03-STACK-01', '/teacher', '/local']) {
    await page.goto(route)
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect(page.locator('main')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true)
    await expect(page.getByRole('link', { name: '本地空间', exact: true })).toBeVisible()
    const teacher = page.getByRole('link', { name: /教师备课/ })
    await expect(teacher.filter({ visible: true }).first()).toBeVisible()
  }
})
