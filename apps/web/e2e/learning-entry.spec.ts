import { expect, test } from '@playwright/test'

const courseVersion = 'f50b5979-1083-5ee7-b700-d5cd1360684d'
const objective = 'CS03-M01-O01'

test('a graph objective opens a guided lesson and carries the learner starting point into practice', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 })
  await page.route('**/api/v1/model-profiles', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ profiles: [], task_defaults: {} }),
  }))

  await page.goto(`/atlas?course=CS03&edition=core&courseVersion=${courseVersion}&goal=${objective}`)
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })
  await expect(page.getByRole('heading', { name: '描述抽象操作契约' })).toBeVisible()
  await page.getByRole('link', { name: '开始本次学习' }).click()

  await expect(page).toHaveURL(new RegExp(`/learn/${objective}\\?courseVersion=${courseVersion}`))
  await expect(page.getByRole('heading', { name: '描述抽象操作契约' })).toBeVisible()
  await expect(page.getByText('先看原理，再决定怎么验证')).toBeVisible()
  await expect(page.getByLabel('代码源文件')).toHaveCount(0)
  await page.getByText('第一次接触', { exact: true }).click()
  await page.getByLabel(/先写下你的猜测、已有经验或最想弄明白的问题/).fill('我想弄清接口契约与具体存储实现有什么区别。')
  await page.getByRole('button', { name: '保存起点，进入动手实践' }).click()

  await expect(page).toHaveURL(new RegExp(`/learn/${objective}\\?.*stage=practice`))
  await expect(page.getByLabel('代码源文件')).toBeVisible()
  await expect(page.getByLabel('运行前预测')).toHaveValue(/第一次接触.*接口契约与具体存储实现/s)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})
