import { expect, test } from '@playwright/test'

// C01 synthetic course: deliberately NOT one of CS01-CS13. Its code semantic
// suite and fixed conditions come from a server-private sidecar and reuse a
// whitelisted oracle, with no backend Python whitelist edit. These tests run
// against the real WSL isolated worker (real compile + run).
const WS_VERSION = '5e2529be-14ed-56a6-9190-71158a22d80e'
const OBJECTIVE = 'WORKSHOP-M01-O1'

const GENERAL_SOURCE = `#include <stdio.h>
int main(void) {
  int minutes = 0;
  if (scanf("%d", &minutes) != 1) return 0;
  int amount;
  if (minutes <= 30) amount = 0;
  else if (minutes <= 60) amount = 5;
  else amount = 10;
  printf("%d\\n", amount);
  return 0;
}
`

// Matches only the two visible endpoints (30/60). The independent inputs 31 and
// 61 are withheld server-side; 31 must fail (expects 5, hard-coded else gives 10)
// while 61 happens to pass, so the suite flags suspected hardcoding 1/2.
const HARDCODED_SOURCE = `#include <stdio.h>
int main(void) {
  int minutes = 0;
  scanf("%d", &minutes);
  int amount;
  if (minutes == 30) amount = 0;
  else if (minutes == 60) amount = 5;
  else amount = 10;
  printf("%d\\n", amount);
  return 0;
}
`

async function openTask(page: import('@playwright/test').Page) {
  await page.goto(`/learn/${OBJECTIVE}?courseVersion=${WS_VERSION}`)
  await expect(page.getByRole('heading', { name: '把分段计费改写成读取输入的通用程序' })).toBeVisible()
  await expect(page.getByText('含保密独立输入的语义核验')).toBeVisible()
  const suite = page.getByRole('region', { name: '独立语义核验' })
  await expect(suite).toContainText('2 个学习可见输入')
  await expect(suite).toContainText('2 个对你保密的独立输入')
  return suite
}

async function saveRevision(page: import('@playwright/test').Page, source: string) {
  await page.getByLabel('代码源文件').fill(source)
  await page.getByLabel('运行前预测').fill('按含端点的三段区间预测费用，并准备在多组输入上核验。')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  // The suite button is enabled as soon as a revision is selected (before its
  // fixed-condition run finishes). Clicking it then issues a concurrent code
  // request on the same lease and stalls, so wait for the fixed run to complete
  // and persist before the suite action.
  await expect(page.getByText('运行结果已保存到这一版代码。').first()).toBeVisible({ timeout: 90000 })
}

test('the non-CS synthetic course appears in the course atlas and loads', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/atlas')
  const picker = page.locator('.course-picker select')
  // The extra course is offered as an option even before the <select> is opened.
  await expect(picker.locator('option')).toContainText(['工具复用演练工坊'])
  await picker.selectOption('WORKSHOP')
  // Selecting it loads its data-driven package atlas (2 declared objectives).
  await expect(page.getByRole('img').first()).toHaveAttribute(
    'aria-label', /2 个唯一目标/, { timeout: 30000 }
  )
})

test('synthetic code activity passes sidecar independent inputs without leaking them', async ({ page }) => {
  test.setTimeout(150000)
  const suite = await openTask(page)
  await saveRevision(page, GENERAL_SOURCE)

  await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
  await expect(suite.getByText('多组输入核验通过。')).toBeVisible({ timeout: 120000 })
  await expect(suite).toContainText('保密独立用例（输入与答案不公开）：共 2，通过 2、未通过 0')

  // Visible cases show full detail; independent inputs 31/61 stay secret.
  await expect(suite).toContainText('输入 30')
  await expect(suite).toContainText('输入 60')
  expect(await suite.textContent()).not.toMatch(/indep|independent-/i)
  expect(await suite.textContent()).not.toContain('输入 31')
  expect(await suite.textContent()).not.toContain('输入 61')
})

test('synthetic suite catches a program hardcoded to the visible samples', async ({ page }) => {
  test.setTimeout(150000)
  const suite = await openTask(page)
  await saveRevision(page, HARDCODED_SOURCE)

  await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
  await expect(suite.locator('.suite-warning')).toContainText('疑似只针对样例硬编码', { timeout: 120000 })
  await expect(suite).toContainText('保密独立用例（输入与答案不公开）：共 2，通过 1、未通过 1')
  expect(await suite.textContent()).not.toMatch(/indep|independent-/i)
  expect(await suite.textContent()).not.toContain('输入 31')
})
