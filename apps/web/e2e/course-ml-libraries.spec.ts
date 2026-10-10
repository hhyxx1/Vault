import { expect, test } from '@playwright/test'

const labs = [
  ['CS13-M03-O01', 'linear', 'fit_intercept=False', 'fit_intercept=True'],
  ['CS13-M03-O03', 'ridge', 'alpha=0.0', 'alpha=10.0'],
  ['CS13-M05-O01', 'tree', 'max_depth=1', 'max_depth=2'],
  ['CS13-M06-O03', 'svm', 'kernel="linear"', 'kernel="rbf"'],
  ['CS13-M07-O01', 'kmeans', 'n_clusters=1', 'n_clusters=2'],
  ['CS13-M07-O02', 'pca', 'n_components=0', 'n_components=1'],
  ['CS13-M08-O02', 'mlp', 'hidden_layer_sizes=()', 'hidden_layer_sizes=(8,)'],
]

for (const [goal, task, wrong, correct] of labs) {
  test(`scientific library ${task} actual repair and local continuation`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/${goal}?task=library-${task}`)
    await expect(page.getByLabel('运行语言')).toHaveValue('python313ml')
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const criteria = page.getByRole('region', { name: '任务条件核验' })
    await expect(criteria).toContainText('本次固定条件：未满足', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    const source = page.getByLabel('代码源文件')
    const initial = await source.inputValue()
    expect(initial).toContain(wrong)
    const repaired = initial.replace(wrong, correct)
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(criteria).toContainText('本次固定条件：满足', { timeout: 60000 })
    const output = await page.getByLabel('标准输出').textContent()
    expect(output?.trim()).not.toBe('')
    await page.reload()
    await expect(source).toHaveValue(repaired)
    await expect(page.getByLabel('标准输出')).toHaveText(output!)
    await expect(criteria).toContainText('本次固定条件：满足')
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 30')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
