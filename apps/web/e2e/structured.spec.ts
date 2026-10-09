import { expect, test, type Page } from '@playwright/test'

// U01 bounded stack (capacity 3), reached through the activity route. Rows are
// [items, output value, status] for: pop, push4, push7, pop, push9, push2, push5.
const stackLabel = '操作后的栈（底→顶，右端为栈顶）'
const u01Rows: Array<[string, string, 'ok' | 'underflow' | 'full']> = [
  ['[]', '', 'underflow'],
  ['[4]', '', 'ok'],
  ['[4, 7]', '', 'ok'],
  ['[4]', '7', 'ok'],
  ['[4, 9]', '', 'ok'],
  ['[4, 9, 2]', '', 'ok'],
  ['[4, 9, 2]', '', 'full'],
]

async function fillTraceRow(page: Page, row: number, items: string, value: string, status: string): Promise<void> {
  await page.getByLabel(`第${row}步${stackLabel}`).fill(items)
  await page.getByLabel(`第${row}步输出值`).fill(value)
  await page.getByLabel(`第${row}步状态`).selectOption(status)
}

test('CS03 U01 bounded stack trace pinpoints a wrong step, then verifies server-side without claiming mastery', async ({ page }, testInfo) => {
  await page.goto('/practice/CS03-STACK-U01-TRACE@0.1.0')
  await expect(page.getByRole('heading', { name: '容量受限的顺序栈', exact: true })).toBeVisible()
  await expect(page.locator('.structured-table tbody tr')).toHaveCount(7)

  // First attempt: deliberately mark step 2 as underflow (it is a normal push).
  for (let i = 0; i < u01Rows.length; i += 1) {
    const [items, value, status] = u01Rows[i]
    await fillTraceRow(page, i + 1, items, value, i === 1 ? 'underflow' : status)
  }
  await page.locator('#structured-explanation').fill('容量为 3 时，空栈 pop 下溢、满栈 push 被拒且状态不变，其余按后进先出变化。')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.locator('.logic-wrong').first()).toBeVisible()
  await expect(page.getByText('有条件需要修正。', { exact: true })).toBeVisible()

  // New version: correct step 2 and resubmit.
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel('第2步状态').selectOption('ok')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.getByText('逐格核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
  await expect(page.locator('.logic-history button')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('structured-u01-stack.png'), fullPage: true })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01')
  await expect(page.locator('.atlas-criteria .met')).toHaveCount(2)
  await expect(page.locator('.atlas-criteria .needs_review')).toHaveCount(2)

  // A later wrong attempt must replace the earlier success in current goal evidence.
  await page.goto('/practice/CS03-STACK-U01-TRACE@0.1.0')
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel(`第2步${stackLabel}`).fill('[99]')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.getByText('有条件需要修正。', { exact: true })).toBeVisible()
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-01')
  await expect(page.locator('.atlas-criteria .not_met')).toHaveCount(1)
})

test('CS03 U04 bracket judgement flags a wrong verdict, then verifies all six fixed cases', async ({ page }, testInfo) => {
  await page.goto('/practice/CS03-STACK-U04-JUDGE@0.1.0')
  await expect(page.getByRole('heading', { name: '括号匹配判定', exact: true })).toBeVisible()
  await expect(page.locator('.bracket-table tbody tr')).toHaveCount(6)

  // First attempt: mark every case matched; cases 4-6 are actually mismatches.
  for (let i = 1; i <= 6; i += 1) await page.getByLabel(`第${i}组串是否匹配`).selectOption('matched')
  await page.locator('#structured-explanation').fill('左括号入栈，遇右括号与栈顶配对，类型不符或最后栈非空即不匹配。')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.locator('.logic-wrong').first()).toBeVisible()

  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  const mismatches: Record<number, number> = { 4: 2, 5: 0, 6: 0 }
  for (const [rowText, index] of Object.entries(mismatches)) {
    const row = Number(rowText)
    await page.getByLabel(`第${row}组串是否匹配`).selectOption('mismatch')
    await page.getByLabel(`第${row}组串首个问题括号索引`).fill(String(index))
  }
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.getByText('逐格核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
  await expect(page.locator('.logic-history button')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('structured-u04-bracket.png'), fullPage: true })
  await page.goto('/atlas?course=CS03&goal=CS03-STACK-02')
  await expect(page.locator('.atlas-criteria .met')).toHaveCount(0)
  await expect(page.locator('.atlas-criteria').getByText('这里只核对匹配判断，尚未提交并执行括号匹配实现。')).toBeVisible()
})

test('CS03 ring-queue objective routes through /learn into the data-driven trace workspace', async ({ page }, testInfo) => {
  await page.goto('/learn/CS03-QUEUE-02')
  await expect(page.getByRole('heading', { name: '循环队列（顺序存储）', exact: true })).toBeVisible()
  await expect(page.locator('.structured-table tbody tr')).toHaveCount(11)
  // The responsive layout hides the table header on narrow screens, so assert
  // the columns are declared in the DOM rather than visible there.
  for (const header of ['物理数组（空位填 null）', 'head（下次出队位置）', 'tail（下次入队位置）', 'size（元素个数）']) {
    await expect(page.locator('.structured-table thead').getByText(header, { exact: true })).toBeAttached()
  }
  await page.screenshot({ path: testInfo.outputPath('structured-u02-ring-queue.png'), fullPage: true })
})
