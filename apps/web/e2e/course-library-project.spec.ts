import { expect, test } from '@playwright/test'

for (const [task, copies] of [['library-owner', 1], ['library-two-borrowers', 2]] as const) {
  test(`Java borrowing ${task} actual file recovery and ownership repair`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS02-M08-O03?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const output = page.getByLabel('标准输出')
    await expect(output).toContainText('other owner accepted', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('Library.java')
    const source = page.getByLabel('代码源文件')
    const repaired = (await source.inputValue()).replace('// missing ownership guard', 'if (!loan.owner().equals(owner)) throw new IllegalArgumentException("owner required");')
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(output).toContainText('other owner rejected', { timeout: 60000 })
    await expect(output).toContainText(`reopened=${copies}`)
    await expect(output).toContainText('monotonic ID=true')
    await page.reload()
    await expect(output).toContainText(`reopened=${copies}`)
    await page.getByLabel('编辑文件').selectOption('Library.java')
    await expect(source).toHaveValue(repaired)
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 24')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
