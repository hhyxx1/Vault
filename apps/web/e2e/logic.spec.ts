import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const selections = [
  ['true', 'true', 'true'],
  ['true', 'true', 'false'],
  ['false', 'false', 'false'],
  ['true', 'true', 'true'],
] as const
const names = ['蕴含', '逆否', '双条件'] as const

test('CS05 keeps an editable local attempt, pinpoints wrong truth cells, and retries without claiming mastery', async ({ page }, testInfo) => {
  await page.goto('/atlas?course=CS05')
  await expect(page.getByRole('img', { name: /课程知识图谱，2 个唯一目标/ })).toBeVisible()
  await page.locator('.overview-grid').getByRole('button', { name: /用真值表比较/ }).click()
  await page.getByRole('link', { name: '进入真值表工作台' }).click()
  await expect(page).toHaveURL('/learn/CS05-LOGIC-01')
  await page.getByLabel('第1行蕴含的真值').selectOption('false')
  await expect(page.getByText('本地已保存')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('第1行蕴含的真值')).toHaveValue('false')
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 3; column++) {
      await page.getByLabel(`第${row + 1}行${names[column]}的真值`).selectOption(row === 0 && column === 0 ? 'false' : selections[row][column])
    }
  }
  await page.getByLabel('你的反例与推理').fill('P 真、Q 假时蕴含为假；逆否命题逐行同值。')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.locator('.logic-wrong')).toHaveCount(1)
  await expect(page.locator('.logic-wrong')).toContainText('应为 真')
  await expect(page.getByText('有真值格需要修正。')).toBeVisible()
  await page.reload()
  await expect(page.getByText('有真值格需要修正。')).toBeVisible()
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel('第1行蕴含的真值').selectOption('true')
  await page.getByRole('button', { name: '保存并核验这一版' }).click()
  await expect(page.getByText('固定真值表逐格一致，目标仍未宣称掌握。')).toBeVisible()
  await expect(page.locator('.logic-history button')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('logic-desktop.png'), fullPage: true })
  await page.getByRole('link', { name: '本地空间' }).click()
  await expect(page.getByRole('link', { name: '回到学习工作台' })).toHaveAttribute('href', '/learn/CS05-LOGIC-01')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出全部本地记录' }).click()
  const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(exported.courseAttempts).toHaveLength(2)
  expect(exported.courseAttempts.every((attempt: { result: unknown }) => attempt.result)).toBe(true)
  await page.goto('/atlas?course=CS05')
  await expect(page.getByRole('img', { name: /课程知识图谱，2 个唯一目标/ })).toHaveAttribute('aria-label', /1 项部分满足.*1 项尚未评估/)
  await expect(page.locator('.scope-total strong')).toContainText('0 / 2')
})

test('CS05 remains usable at 320px and self-study answer disclosure is recorded', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/learn/CS05-LOGIC-01')
  await expect(page.getByRole('heading', { name: '用四组赋值，拆开一句“如果”。' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  const lastColumn = await page.getByLabel('第1行双条件的真值').boundingBox()
  expect(lastColumn).not.toBeNull()
  expect(lastColumn!.x + lastColumn!.width).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: '自主查看参考答案' }).click()
  await expect(page.getByText('固定四行参考真值')).toBeVisible()
  await expect(page.getByText('参考答案已查看 1 次')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('logic-mobile.png'), fullPage: true })
})
