import { expect, test } from '@playwright/test'

for (let i = 1; i <= 13; i++) {
  const code = `CS${String(i).padStart(2, '0')}`
  const modules = [10, 8, 10, 9, 10, 9, 9, 10, 10, 9, 9, 9, 10][i - 1]
  test(`${code} full core scope navigates without fabricated assessment`, async ({ page }) => {
    await page.goto(`/atlas?course=${code}&edition=core`)
    await expect(page.locator('.chapter-region')).toHaveCount(modules)
    await expect(page.locator('.scope-total strong')).toContainText(`0 / ${modules * 3}`)
    await page.locator('.chapter-region').first().getByRole('button').first().click()
    await expect(page.locator('.objective-inspector h2')).toBeVisible()
    if (code === 'CS01') {
      await expect(page.locator('.next-action').getByRole('link', { name: '进入学习工作台' })).toBeVisible()
      await expect(page.locator('.next-action')).toContainText('不自动增加达标数')
    } else {
      await expect(page.locator('.next-action')).toContainText('活动待建设')
    }
    await page.reload()
    await expect(page.locator('.objective-inspector h2')).toBeVisible()
    await expect(page.locator('.scope-total strong')).toContainText(`0 / ${modules * 3}`)
  })
}

test('full scope and legacy activities retain separate versions', async ({ page }) => {
  await page.goto('/atlas?course=CS03')
  await page.locator('.atlas-range-note summary').click()
  await page.getByRole('link', { name: '查看完整核心范围' }).click()
  await expect(page.locator('.scope-total strong')).toContainText('0 / 30')
  await page.locator('.atlas-range-note summary').click()
  await page.getByRole('link', { name: '查看当前活动版本' }).click()
  await expect(page.locator('.scope-total strong')).toContainText('0 / 32')
})


test('unregistered learning routes do not dispatch by course prefix', async ({ page }) => {
  await page.goto('/learn/CS05-M01-O01')
  await expect(page.getByRole('heading', { name: '这个目标的实践尚未开放' })).toBeVisible()
  await expect(page.getByRole('button', { name: /提交临时核验/ })).toHaveCount(0)
})
