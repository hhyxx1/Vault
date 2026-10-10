import { expect, test } from '@playwright/test'

for (const task of ['service-owner', 'service-replay']) {
  test(`two-increment HTTP service ${task} repair and restored audit`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/learn/CS10-M09-O03?task=${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const output = page.getByLabel('标准输出')
    await expect(output).toContainText(task === 'service-owner' ? '"other_owner_status": 200' : '"audit": ["created", "submitted", "submitted"]', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('service.py')
    const source = page.getByLabel('代码源文件')
    const before = await source.inputValue()
    const repaired = task === 'service-owner'
      ? before.replace('if False:  # missing ownership policy', 'if identity != row[0]:')
      : before.split('\n').filter(line => !line.includes('# erroneous repeated side effect')).join('\n')
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(output).toContainText('"other_owner_status": 403', { timeout: 60000 })
    await expect(output).toContainText('"audit": ["created", "submitted"]')
    await expect(output).toContainText('"repeated_identical": true')
    await expect(output).toContainText('"restored_submission": [200,')
    await page.reload()
    await expect(output).toContainText('"audit": ["created", "submitted"]')
    await page.getByLabel('编辑文件').selectOption('service.py')
    await expect(source).toHaveValue(repaired)
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 27')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
