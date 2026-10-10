import { expect, test } from '@playwright/test'

test('ledger combines rejected transactions, real file recovery and frozen revision resumption', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/learn/CS01-M10-O03?task=ledger-recovery')
  await expect(page.getByRole('heading', { name: '组合实践：拒绝透支后保存并恢复', exact: true })).toBeVisible()
  await page.getByLabel('运行前预测').fill('拒绝后不该改变余额；错误版本会保存负数，重新加载失败。')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByLabel('标准输出')).toContainText('rejected balance=-1000', { timeout: 60000 })
  await expect(page.getByRole('region', { name: '任务条件核验' })).toContainText('本次固定条件：未满足')
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  const source = page.getByLabel('代码源文件')
  await source.fill((await source.inputValue()).replace(
    'book->cents = candidate; /* BUG: rejected withdrawal changes the ledger */\n    if (candidate < 0 || candidate > 10000) return 0;',
    'if (candidate < 0 || candidate > 10000) return 0;\n    book->cents = candidate;',
  ))
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByLabel('标准输出')).toContainText('loaded balance=1000', { timeout: 60000 })
  await expect(page.getByRole('region', { name: '任务条件核验' })).toContainText('本次固定条件：满足')
  await page.getByRole('button', { name: '查看参考答案', exact: true }).click()
  await expect(page.locator('.code-course-help pre')).toContainText('typedef struct { int cents; } Ledger;')
  await page.reload()
  await expect(page.getByLabel('标准输出')).toContainText('loaded balance=1000')
  await page.getByRole('link', { name: '回到知识图谱' }).click()
  await expect(page.locator('.scope-total strong')).toContainText('0 / 30')
})
