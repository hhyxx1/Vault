import { expect, test } from '@playwright/test'

const CS01_VERSION = '7ca20169-02d2-5719-b3f0-eff208ae89db'
const OBJECTIVE = 'CS01-M03-O03'

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

// Only reproduces the two learning-visible inputs (30 and 60); every hidden
// independent input falls into the wrong branch. A fixed stdout check passes,
// the independent suite must flag it as suspected hardcoding.
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
  await page.goto(`/learn/${OBJECTIVE}?courseVersion=${CS01_VERSION}`)
  await expect(page.getByRole('heading', { name: '选择能揭示条件缺口的反例' })).toBeVisible()
  await expect(page.getByText('含保密独立输入的语义核验')).toBeVisible()
  const suite = page.getByRole('region', { name: '独立语义核验' })
  await expect(suite).toContainText('2 个学习可见输入')
  await expect(suite).toContainText('6 个对你保密的独立输入')
  return suite
}

async function saveRevision(page: import('@playwright/test').Page, source: string) {
  await page.getByLabel('代码源文件').fill(source)
  await page.getByLabel('运行前预测').fill('按含端点的三段区间预测费用，并准备在多组输入上核验。')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  // The fixed-condition run for the saved revision must finish before the
  // suite action (which targets that saved revision) becomes available.
  await expect(page.getByRole('region', { name: '任务条件核验' })).toBeVisible({ timeout: 90000 })
}

test('a general implementation passes visible and hidden independent inputs without leaking them', async ({ page }) => {
  test.setTimeout(150000)
  const suite = await openTask(page)
  await saveRevision(page, GENERAL_SOURCE)

  await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
  await expect(suite.getByText('多组输入核验通过。')).toBeVisible({ timeout: 120000 })
  await expect(suite).toContainText('保密独立用例（输入与答案不公开）：共 6，通过 6、未通过 0')

  // Visible cases show full detail.
  await expect(suite).toContainText('输入 30')
  await expect(suite).toContainText('输入 60')

  // Hidden independent cases must never expose their code, inputs or expected
  // outputs: only aggregate counts are rendered.
  expect(await suite.textContent()).not.toMatch(/indep|independent-/i)
  expect(await suite.textContent()).not.toContain('120')
})

test('a program hardcoded to the visible samples is caught by hidden independent inputs', async ({ page }) => {
  test.setTimeout(150000)
  const suite = await openTask(page)
  await saveRevision(page, HARDCODED_SOURCE)

  await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
  await expect(suite.locator('.suite-warning')).toContainText('疑似只针对样例硬编码', { timeout: 120000 })
  // 61 and 120 happen to hit the else branch (fee 10); 0/29/31/59 must fail.
  await expect(suite).toContainText('保密独立用例（输入与答案不公开）：共 6，通过 2、未通过 4')
  // Even when flagging hardcoding, hidden inputs/answers stay secret.
  expect(await suite.textContent()).not.toMatch(/indep|independent-/i)
  expect(await suite.textContent()).not.toContain('120')
})
