import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('starts outside the default catalog with only a name, then records an unverified practice and retry', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('完整建成 0 / 13 门。', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: '开始个人课程', exact: false }).click()
  await expect(page).toHaveURL('/my-courses')
  await expect(page.getByRole('heading', { name: '从你要学的课程开始。' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('personal-course-list.png') })
  await page.getByLabel('课程名称', { exact: true }).fill('编译原理')
  await page.getByRole('button', { name: '创建个人课程', exact: false }).click()
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]+$/)
  await expect(page.getByText('探索目标待确认。', { exact: false })).toBeVisible()
  await expect(page.getByText('还没有学习点。', { exact: false })).toBeVisible()
  await expect(page.getByText('0 项完成独立核验', { exact: false })).toBeVisible()

  await page.getByLabel('学习目标', { exact: true }).fill('理解词法分析，并写出一个可测试的扫描器。')
  await page.getByRole('button', { name: '保存课程目标' }).click()
  await expect(page.getByText('课程目标已保存。', { exact: false })).toBeVisible()
  await page.getByLabel('学习点名称').fill('词法分析')
  await page.getByLabel('想完成的实践或可观察表现').fill('写出扫描器并记录不同输入的 Token。')
  await page.getByRole('button', { name: '保存学习点' }).click()
  await expect(page.getByRole('heading', { name: '词法分析' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('personal-course-detail.png') })

  const fields = [
    ['这次想解决什么问题', '数字开头的字符串会如何被分类？'],
    ['依据的概念或原理', '标识符由字母开头，后续可包含数字。'],
    ['亲手做了什么', '写了一个扫描函数，输入 3abc。'],
    ['实际出现了什么结果', '函数将 3 分类为数字、abc 分类为标识符。'],
    ['结果说明了什么', '词法规则需要明确数字与字母的边界。'],
    ['下一次怎么改或继续验证', '输入 abc3 和 3abc 再比较。'],
  ] as const
  for (const [label, value] of fields) await page.getByLabel(label).fill(value)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: '返回个人课程' }).click()
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]+$/)
  await expect(page.getByLabel('这次想解决什么问题')).toHaveValue(fields[0][1])
  await page.getByRole('button', { name: '保存这次尝试，继续学习', exact: false }).click()
  await expect(page.getByText('这次尝试已保存。', { exact: false })).toBeVisible()
  await expect(page.getByText('1 次自述尝试 · 未核验')).toBeVisible()
  await page.reload()
  await expect(page.getByText('1 次自述尝试 · 未核验')).toBeVisible()
  await expect(page.getByText('0 项完成独立核验', { exact: false })).toBeVisible()
  await page.getByLabel('这次想解决什么问题').fill('abc3 会如何被分类？')
  for (const [label, value] of fields.slice(1)) await page.getByLabel(label).fill(value + '再次验证。')
  await page.getByRole('button', { name: '保存这次尝试，继续学习', exact: false }).click()
  await expect(page.getByText('2 次自述尝试 · 未核验')).toBeVisible()
  await page.getByRole('link', { name: '返回个人课程' }).click()
  await expect(page.getByText('编译原理', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '本地空间' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出全部本地记录', exact: false }).click()
  const download = await downloadPromise
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(exported.personalCourses).toHaveLength(1)
  expect(exported.personalAttempts).toHaveLength(2)
  expect(exported.personalCourses[0].title).toBe('编译原理')
})

test('personal course entry remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/my-courses')
  await expect(page.getByRole('heading', { name: '从你要学的课程开始。' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.getByLabel('课程名称', { exact: true }).fill('软件工程')
  await page.getByRole('button', { name: '创建个人课程', exact: false }).click()
  await expect(page.getByRole('heading', { name: '软件工程' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

test('keeps draft inputs and requires saving a course edit before appending a topic', async ({ page }) => {
  await page.goto('/my-courses')
  await page.getByLabel('课程名称', { exact: true }).fill('操作系统')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: '查看 13 门默认课程的建设状态', exact: false }).click()
  await expect(page).toHaveURL('/my-courses')
  await expect(page.getByLabel('课程名称', { exact: true })).toHaveValue('操作系统')
  await page.getByRole('button', { name: '创建个人课程', exact: false }).click()
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]+$/)

  await page.getByLabel('学习目标', { exact: true }).fill('实现进程调度模拟。')
  await page.getByLabel('学习点名称').fill('时间片轮转')
  await page.getByLabel('想完成的实践或可观察表现').fill('比较不同时间片的等待时间。')
  await page.getByRole('button', { name: '保存学习点' }).click()
  await expect(page.getByText('课程名称或目标尚未保存', { exact: false })).toBeVisible()
  await expect(page.getByLabel('学习点名称')).toHaveValue('时间片轮转')
  await page.getByRole('button', { name: '保存课程目标' }).click()
  await expect(page.locator('.page-heading p')).toHaveText('实现进程调度模拟。')
  await page.getByRole('button', { name: '保存学习点' }).click()
  await expect(page.getByRole('heading', { name: '时间片轮转' })).toBeVisible()

  await page.locator('.personal-add-topic summary').click()
  await page.getByLabel('学习点名称').fill('优先级调度')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: '返回个人课程' }).click()
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]+$/)
  await expect(page.getByLabel('学习点名称')).toHaveValue('优先级调度')
})
