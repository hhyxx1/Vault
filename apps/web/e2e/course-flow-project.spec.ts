import { expect, test } from '@playwright/test'

for (const task of ['flow-reverse', 'flow-bottleneck']) {
  test(`maximum flow ${task} real counterexample and repair`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS04-M06-O03?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const criteria = page.getByRole('region', { name: '任务条件核验' })
    await expect(criteria).toContainText('本次固定条件：未满足', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('flow.py')
    const source = page.getByLabel('代码源文件')
    const initial = await source.inputValue()
    const wrong = task === 'flow-reverse' ? '# missing backward residual edge' : 'delta = max(step["residual_before"] for step in path)'
    const correct = task === 'flow-reverse' ? 'adjacency[v].append((u, identity, -1))' : 'delta = min(step["residual_before"] for step in path)'
    expect(initial).toContain(wrong)
    const repaired = initial.replace(wrong, correct)
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(criteria).toContainText('本次固定条件：满足', { timeout: 60000 })
    await expect(page.getByLabel('标准输出')).toContainText('"optimal_certificate": true')
    await expect(page.getByLabel('标准输出')).toContainText('"feasible": true')
    await page.reload()
    await page.getByLabel('编辑文件').selectOption('flow.py')
    await expect(source).toHaveValue(repaired)
    await expect(page.getByLabel('标准输出')).toContainText('"optimal_certificate": true')
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 27')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
