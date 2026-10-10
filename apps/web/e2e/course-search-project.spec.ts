import { expect, test } from '@playwright/test'

for (const task of ['route-weighted', 'route-wall']) {
  test(`actual weighted search ${task} correction and retained trace`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS12-M02-O02?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const output = page.getByLabel('标准输出')
    await expect(output).toContainText('"matches_optimal_cost": false', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('search.py')
    const source = page.getByLabel('代码源文件')
    const repaired = (await source.inputValue()).replace('priority = heuristic(next_node)', 'priority = tentative + heuristic(next_node)')
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(output).toContainText('"matches_optimal_cost": true', { timeout: 60000 })
    await expect(output).toContainText('"replayed_cost": 4')
    await expect(output).toContainText('"trace":')
    await page.reload()
    await expect(output).toContainText('"matches_optimal_cost": true')
    await page.getByLabel('编辑文件').selectOption('search.py')
    await expect(source).toHaveValue(repaired)
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 27')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
