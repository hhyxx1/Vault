import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const course = JSON.parse(readFileSync(new URL('../../../content/courses/CS03/CS03-core-practice-0.3.0/manifest.json', import.meta.url), 'utf8'))
const activities = course.activities.filter((activity: { semantic_suite?: unknown }) => activity.semantic_suite)

for (const activity of activities) {
  test(`${activity.objective_codes[0]} repairs, verifies and resumes the same saved work`, async ({ page }, testInfo) => {
    test.setTimeout(150000)
    await page.goto(`/learn/${activity.objective_codes[0]}?courseVersion=${course.course_version_id}`)
    await expect(page.getByRole('heading', { name: activity.title, exact: true })).toBeVisible()
    await page.getByLabel('运行前预测').fill('逐次记录状态，拒绝操作不改变状态；用边界序列验证修正。')
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const fixed = page.getByRole('region', { name: '任务条件核验' })
    await expect(fixed).toContainText('本次固定条件：未满足', { timeout: 60000 })
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByRole('button', { name: '查看参考答案' }).click()
    await expect(page.getByText('参考答案只供本活动自学对照，下一次运行仍使用你的作品。')).toBeVisible()
    await page.getByLabel('代码源文件').fill(activity.reference_answer.files['main.cpp'])
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(fixed).toContainText('本次固定条件：满足', { timeout: 60000 })
    await page.getByLabel('运行后解释与下一步').fill('使用参考作品进行帮助下练习；解释和独立迁移仍待审阅，不声称独立掌握。')
    await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
    const suite = page.getByRole('region', { name: '独立语义核验' })
    await expect(suite.getByText('多组输入核验通过。')).toBeVisible({ timeout: 90000 })
    await expect(suite).toContainText('不授予独立掌握')
    await page.reload()
    await expect(suite.getByText('多组输入核验通过。')).toBeVisible()
    await expect(page.getByLabel('运行后解释与下一步')).toHaveValue(/帮助下练习/)
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('navigation', { name: '课程连续学习' })).toContainText('掌握状态由实际证据决定')
    if (activity.objective_codes[0] === 'CS03-M03-O02') {
      const screenshot = testInfo.outputPath('queue-workspace.png')
      await page.screenshot({ path: screenshot, fullPage: true })
      await testInfo.attach('queue-workspace', { path: screenshot, contentType: 'image/png' })
    }
  })
}


test('the next objective retains the course version and opens a distinct saved workspace', async ({ page }) => {
  await page.goto(`/learn/CS03-M01-O01?courseVersion=${course.course_version_id}`)
  await expect(page.getByRole('heading', { name: '为顺序表写清可执行操作契约', exact: true })).toBeVisible()
  await expect(page.getByLabel('代码源文件')).toBeEnabled()
  const navigation = page.getByRole('navigation', { name: '课程连续学习' })
  const next = navigation.getByRole('link', { name: '下一目标：区分逻辑与存储结构' })
  await expect(next).toHaveAttribute('href', `/learn/CS03-M01-O02?courseVersion=${course.course_version_id}`)
  await next.click()
  await expect(page.getByRole('heading', { name: '让数组与单链表示执行同一操作序列', exact: true })).toBeVisible()
})

for (const goal of ['CS03-M03-O02', 'CS03-M10-O03']) {
  test(`${goal} builds from an empty work and retains its independent verdict`, async ({ page }) => {
    test.setTimeout(150000)
    const activity = activities.find((row: { objective_codes: string[] }) => row.objective_codes[0] === goal)
    await page.goto(`/learn/${goal}?courseVersion=${course.course_version_id}&task=from-scratch`)
    await expect(page.getByLabel('代码源文件')).toBeEnabled()
    await page.getByLabel('代码源文件').fill(activity.reference_answer.files['main.cpp'])
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(page.getByRole('region', { name: '任务条件核验' })).toContainText('本次固定条件：满足', { timeout: 60000 })
    await page.getByRole('button', { name: '对这一版做独立语义核验' }).click()
    const suite = page.getByRole('region', { name: '独立语义核验' })
    await expect(suite.getByText('多组输入核验通过。')).toBeVisible({ timeout: 90000 })
    await page.reload()
    await expect(suite.getByText('多组输入核验通过。')).toBeVisible()
  })
}

test('default CS03 atlas opens the current thirty-objective learning release', async ({ page }) => {
  await page.goto('/atlas?course=CS03')
  await expect(page.getByRole('main')).toContainText('30')
  await expect(page.getByRole('main')).toContainText('数据结构')
  await page.getByRole('button', { name: /描述抽象操作契约/ }).first().click()
  await expect(page.locator('a[href*="/learn/CS03-M01-O01"]').first()).toBeVisible()
  const links = await page.locator('a[href*="/learn/"]').evaluateAll(elements => elements.map(element => element.getAttribute('href')))
  expect(links.some(link => link?.includes(course.course_version_id))).toBe(true)
})
