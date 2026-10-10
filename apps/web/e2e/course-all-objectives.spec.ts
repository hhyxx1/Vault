import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// Explicit author walkthrough, not independent learning or a Q0–Q5 completion claim.
// Run with VAULT_ALL_OBJECTIVES_E2E=1; standard smoke checks stay bounded.
type Request = { entry: string; language: string; files: Record<string, string>; stdin: string }
type Activity = { objective_codes: string[]; reference_answer: Request; code_request: Request }
const content = resolve(import.meta.dirname, '../../../content/courses')
const catalog = JSON.parse(readFileSync(resolve(content, 'scope-catalog.json'), 'utf8')) as {
  courses: { code: string; package_path: string }[]
}

for (const course of catalog.courses) {
  test(`${course.code} every published core goal author execution and restoration`, async ({ page }, testInfo) => {
    test.skip(process.env.VAULT_ALL_OBJECTIVES_E2E !== '1', 'Explicit full curriculum walkthrough')
    test.skip(testInfo.project.name !== 'chromium', 'Full desktop walkthrough; mobile repair paths have dedicated tests')
    test.setTimeout(15 * 60 * 1000)
    const manifest = JSON.parse(readFileSync(resolve(content, course.package_path), 'utf8')) as {
      activities: Activity[]
    }
    let grants = 0
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/guest-leases')) grants++ })
    for (const activity of manifest.activities) {
      const goal = activity.objective_codes[0]
      await test.step(`${goal}: viewed answer, actual execution, restore`, async () => {
        await page.goto(`/learn/${goal}`)
        await expect(page.getByLabel('运行语言')).toHaveValue(activity.code_request.language)
        await page.getByRole('button', { name: '查看参考答案', exact: true }).click()
        const answer = activity.reference_answer
        for (const [filename, source] of Object.entries(answer.files)) {
          await page.getByLabel('编辑文件').selectOption(filename)
          await page.getByLabel('代码源文件').fill(source)
        }
        if (answer.language !== 'postgres18') await page.getByLabel('标准输入').fill(answer.stdin)
        await page.getByRole('button', { name: '保存并运行这一版' }).click()
        await expect(page.getByRole('region', { name: '任务条件核验' })).toContainText('本次固定条件：满足', { timeout: 60000 })
        await page.reload()
        await expect(page.getByRole('region', { name: '任务条件核验' })).toContainText('本次固定条件：满足')
        await expect(page.getByLabel('代码源文件')).toHaveValue(answer.files[answer.entry])
        expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
      })
    }
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText(`0 / ${manifest.activities.length}`)
    expect(grants).toBeLessThanOrEqual(2) // 20-operation lease budget; reloads reuse the anonymous capability.
  })
}
