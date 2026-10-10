import { expect, test } from '@playwright/test'

for (const task of ['compiler-expression', 'compiler-loop']) {
  test(`compiler pipeline ${task} repair and cross-session evidence`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS11-M09-O03?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const output = page.getByLabel('标准输出')
    await expect(output).toContainText('"equivalent": false', { timeout: 60000 })
    for (const stage of ['tokens=', 'ast=', 'instructions=']) {
      await expect(output).toContainText(stage)
    }
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('tiny.py')
    const source = page.getByLabel('代码源文件')
    const repaired = (await source.inputValue()).replace('result = right - left', 'result = left - right')
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(output).toContainText('"equivalent": true', { timeout: 60000 })
    await expect(output).toContainText(task === 'compiler-expression' ? '"machine_result": [4, -2]' : '"machine_result": [0]')
    await page.reload()
    await expect(output).toContainText('"equivalent": true')
    await page.getByLabel('编辑文件').selectOption('tiny.py')
    await expect(source).toHaveValue(repaired)
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 27')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
