import { expect, test } from '@playwright/test'

for (const task of ['pipeline-leak', 'pipeline-shift']) {
  test(`actual ${task} fitting repair and preserved model report`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS13-M10-O02?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const output = page.getByLabel('标准输出')
    await expect(output).toContainText('"fit_ids": ["0", "1", "2", "3", "4", "5", "6", "7"]', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('pipeline.py')
    const source = page.getByLabel('代码源文件')
    const repaired = (await source.inputValue()).replace('fit_rows = data', 'fit_rows = train')
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(output).toContainText('"fit_ids": ["0", "1", "2", "3"]', { timeout: 60000 })
    await expect(output).toContainText('"test_mse": 0.0')
    await expect(output).toContainText('"selected": "linear"')
    await expect(output).toContainText(task === 'pipeline-leak' ? '"reload_predictions": [11.0, 15.0]' : '"reload_predictions": [31.0, 35.0]')
    await page.reload()
    await expect(output).toContainText('"test_mse": 0.0')
    await page.getByLabel('编辑文件').selectOption('pipeline.py')
    await expect(source).toHaveValue(repaired)
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 30')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
