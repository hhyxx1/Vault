import { expect, test } from '@playwright/test'

const cases = [
  ['CS06-M06-O03', 'store', '"mem_write": False', '"mem_write": op == "STORE"'],
  ['CS06-M05-O03', 'branch', 'registers[dest] != 0', 'registers[dest] == 0'],
  ['CS06-M08-O02', 'cache', 'if False:  # missing dirty eviction writeback', 'if line["valid"] and line["dirty"]:'],
]

for (const [goal, task, wrong, correct] of cases) {
  test(`processor ${task} repair, phase observation and continuation`, async ({ page }, testInfo) => {
    test.setTimeout(90000)
    await page.goto(`/learn/${goal}?task=processor-${task}`)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    const criteria = page.getByRole('region', { name: '任务条件核验' })
    await expect(criteria).toContainText('本次固定条件：未满足', { timeout: 60000 })
    const trace = page.getByRole('region', { name: '处理器逐周期观察' })
    await expect(trace).toContainText('取指')
    await trace.getByRole('button', { name: '下一周期' }).click()
    await expect(trace.locator('[aria-current="step"]')).toHaveText('译码')
    await page.getByRole('button', { name: '修改并开始新版本' }).click()
    await page.getByLabel('编辑文件').selectOption('cpu.py')
    const source = page.getByLabel('代码源文件')
    const initial = await source.inputValue()
    expect(initial).toContain(wrong)
    const repaired = initial.replace(wrong, correct)
    await source.fill(repaired)
    await page.getByRole('button', { name: '保存并运行这一版' }).click()
    await expect(criteria).toContainText('本次固定条件：满足', { timeout: 60000 })
    const slider = trace.getByLabel('观察周期')
    await slider.focus()
    await slider.press('Home')
    for (let step = 0; step < 3; step++) await slider.press('ArrowRight')
    await expect(trace.locator('[aria-current="step"]')).toHaveText('提交')
    await trace.getByRole('button', { name: '上一周期' }).click()
    await expect(trace.locator('[aria-current="step"]')).toHaveText('执行')
    await slider.press('End')
    await expect(trace.getByRole('button', { name: '下一周期' })).toBeDisabled()
    if (task === 'store') await trace.screenshot({ path: testInfo.outputPath('processor-observation.png') })
    await page.reload()
    await page.getByLabel('编辑文件').selectOption('cpu.py')
    await expect(source).toHaveValue(repaired)
    await expect(trace.locator('[aria-current="step"]')).toHaveText('取指')
    await page.getByRole('link', { name: '回到知识图谱' }).click()
    await expect(page.locator('.scope-total strong')).toContainText('0 / 27')
    await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
