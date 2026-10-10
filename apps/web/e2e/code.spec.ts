import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test.setTimeout(90000)
test('code practice preserves a frozen version through reload and exports its actual output', async ({ page }, testInfo) => {
  await page.goto('/code?activity=custom-addition')
  await page.getByLabel('运行语言').selectOption('python313')
  await page.getByLabel('代码源文件').fill('print(2+3)')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByRole('heading', { name: '运行成功', exact: true })).toBeVisible({ timeout: 60000 })
  await expect(page.getByLabel('标准输出')).toContainText('5')
  await page.reload()
  await expect(page.getByLabel('代码源文件')).toHaveValue('print(2+3)')
  await expect(page.getByLabel('标准输出')).toContainText('5')
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel('代码源文件').fill('print(6)')
  await expect(page.getByLabel('标准输出')).toHaveCount(0)
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByLabel('标准输出')).toContainText('6', { timeout: 60000 })
  await page.goto('/evidence')
  await expect(page.getByRole('heading', { name: '代码运行作品' })).toHaveCount(2)
  await page.goto('/code?activity=custom-addition')
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('code-practice.png'), fullPage: true })
  await page.goto('/local')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出全部本地记录' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.codeAttempts).toHaveLength(2)
  expect(saved.codeAttempts.find((row: { request: { files: Record<string, string> } }) => row.request.files['main.py'] === 'print(2+3)').result.stdout).toBe('5\n')
  expect(saved.codeAttempts.find((row: { request: { files: Record<string, string> } }) => row.request.files['main.py'] === 'print(6)').result.stdout).toBe('6\n')
})

test('a course code draft enters the reusable runner with the student source intact', async ({ page }) => {
  await page.goto('/learn/CS03-STACK-02')
  const editor = page.getByRole('textbox', { name: '括号匹配 Python 源码' })
  await editor.fill('print("my code")')
  await page.getByRole('link', { name: '用这一份代码开始运行' }).click()
  await expect(page.getByLabel('代码源文件')).toHaveValue('print("my code")')
})

for (const [language, source] of [
  ['c17', '#include <stdio.h>\nint main(void) { puts("5"); return 0; }'],
  ['cpp17', '#include <iostream>\nint main() { std::cout << 5 << "\\n"; }'],
  ['java21', 'public class Main { public static void main(String[] args) { System.out.println(5); } }'],
  ['node24', 'console.log(5);'],
] as const) {
  test(`${language} runs through the browser and preserves the declared language`, async ({ page }) => {
    await page.goto(`/code?activity=language-${language}`)
    await page.getByLabel('运行语言').selectOption(language)
    await page.getByLabel('代码源文件').fill(source)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(page.getByRole('heading', { name: '运行成功', exact: true })).toBeVisible({ timeout: 60000 })
    await expect(page.getByLabel('标准输出')).toContainText('5')
    await page.reload()
    await expect(page.getByLabel('运行语言')).toHaveValue(language)
    await expect(page.getByLabel('标准输出')).toContainText('5')
  })
}

test('a cancelled program preserves source and a fresh version can run after cleanup', async ({ page }) => {
  await page.goto('/code?activity=cancel-check')
  await page.getByLabel('代码源文件').fill('while True: pass')
  const started = page.waitForResponse(response => response.url().endsWith('/operations') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await started
  await page.getByRole('button', { name: '停止运行' }).click()
  await expect(page.getByText('已请求停止运行；代码版本仍保留本地。')).toBeVisible({ timeout: 40000 })
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel('代码源文件').fill('print(7)')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByLabel('标准输出')).toContainText('7', { timeout: 60000 })
})

test('compile errors remain compiler facts and a multi-file correction can be restored', async ({ page }) => {
  await page.goto('/code?activity=multi-file-check')
  await page.getByLabel('运行语言').selectOption('c17')
  await page.getByLabel('代码源文件').fill('int main(void) { syntax error }')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByRole('heading', { name: '编译未通过' })).toBeVisible({ timeout: 60000 })
  await expect(page.getByLabel('错误输出')).toContainText('error')
  await page.getByRole('button', { name: '修改并开始新版本' }).click()
  await page.getByLabel('代码源文件').fill('#include <stdio.h>\nint value(void);\nint main(void) { printf("%d\\n", value()); return 0; }')
  await page.getByLabel('新源文件名').fill('helper.c')
  await page.getByRole('button', { name: '添加源文件' }).click()
  await page.getByLabel('代码源文件').fill('int value(void) { return 11; }')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByLabel('标准输出')).toContainText('11', { timeout: 60000 })
  await page.reload()
  await page.getByLabel('编辑文件').selectOption('helper.c')
  await expect(page.getByLabel('代码源文件')).toHaveValue('int value(void) { return 11; }')
})
