import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
test.use({ trace: 'off' })
const password = 'Temporary-Test-Password-20261005'
const appOrigin = `http://127.0.0.1:${process.env.VAULT_E2E_PORT ?? 5173}`
async function capture(page: Page, name: string, mobile: boolean) {
  const directory = process.env.VAULT_E2E_CAPTURE_DIR
  if (!directory) return
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.press('Control+Home')
  await mkdir(directory, { recursive: true }); await page.screenshot({ path: join(directory, `${name}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true })
}
async function confirmationToken(email: string, purpose = 'verify_email') {
  const directory = process.env.VAULT_E2E_MAIL_CAPTURE_DIR
  if (!directory) throw new Error('真实邮箱验证测试需要 VAULT_E2E_MAIL_CAPTURE_DIR；不能跳过账号验收。')
  let token: string | undefined
  await expect.poll(async () => {
    for (const name of await readdir(directory)) {
      if (!name.endsWith('.json')) continue
      const mail = JSON.parse(await readFile(join(directory, name), 'utf8'))
      if (mail.to === email && mail.purpose === purpose) token = mail.token
    }
    return !!token
  }).toBe(true)
  return token!
}
async function register(page: Page, email: string, type: 'student' | 'teacher', name: string) {
  await page.goto('/account')
  await page.getByRole('button', { name: '创建账号', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('显示名称', { exact: true }).fill(name)
  await page.getByRole('radio', { name: type === 'teacher' ? '教师 独立账号，认证后教学' : '学生 自学与持续练习' }).check()
  await page.getByLabel('密码', { exact: false }).fill(password)
  await page.getByRole('button', { name: '创建账号，确认邮箱', exact: false }).click()
  await expect(page.getByLabel('邮箱确认码', { exact: true })).toBeVisible()
  await page.getByLabel('邮箱确认码', { exact: true }).fill(await confirmationToken(email))
  await page.locator('form').getByRole('button', { name: '确认邮箱', exact: false }).click()
  await expect(page.getByText('邮箱已确认。现在可以登录并关联已有学习记录。', { exact: true })).toBeVisible()
}
async function login(page: Page, email: string, value = password) {
  await page.goto('/account')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: false }).fill(value)
  await page.getByRole('button', { name: '登录并关联本机记录', exact: false }).click()
  await expect(page.locator('.account-email')).toHaveText(email)
}
async function logout(page: Page) {
  await page.goto('/account'); await page.getByRole('button', { name: '退出账号，打开新访客空间', exact: true }).click()
  await expect(page.getByRole('button', { name: '登录并关联本机记录', exact: false })).toBeVisible()
}
async function completedWork(page: Page) {
  await page.goto('/learn/CS03-STACK-01'); await page.getByRole('button', { name: '确认目标，开始尝试', exact: false }).click()
  for (const [index, stack] of ['[8]', '[8,3]', '[8]', '[8,5]', '[8]', '[]', '[]'].entries()) await page.getByLabel(`第${index + 1}步操作后的栈`, { exact: true }).fill(stack)
  for (const [index, output] of ['', '', '3', '', '5', '8', ''].entries()) await page.getByLabel(`第${index + 1}步输出`, { exact: true }).fill(output)
  await page.getByLabel('第7步发生下溢', { exact: true }).check()
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill('账户 A 的真实推演；最后入栈者先取出，空栈出栈没有输出并标记下溢。')
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByText('七步推演核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
}
async function confirmedSync(page: Page) {
  await page.goto('/local'); await page.getByRole('button', { name: '同步并恢复云端记录', exact: false }).click()
  await expect(page.getByRole('button', { name: '同步并恢复云端记录', exact: false })).toBeEnabled()
  await expect(page.locator('.sync-badge.pending')).toHaveCount(0)
  await expect(page.locator('.sync-badge.conflict')).toHaveCount(0)
  await expect(page.locator('.sync-badge.rejected')).toHaveCount(0)
}
async function selectRecoveredSpace(page: Page) {
  const choices = page.locator('#record-space option')
  if (await choices.count() > 1) {
    const current = await page.locator('#record-space').inputValue()
    const values = await choices.evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
    await page.locator('#record-space').selectOption(values.find(value => value !== current)!)
  }
}

test('course code draft and prediction follow the claimed student account across devices', async ({ page, browser, isMobile }) => {
  test.setTimeout(120000)
  const email = `code-draft-${Date.now()}-${isMobile ? 'mobile' : 'desktop'}@example.test`
  await page.goto('/learn/CS01-M02-O02')
  await page.getByLabel('代码源文件').fill('#include <stdio.h>\nint main(void) { puts("draft only"); return 0; }')
  await page.getByLabel('运行前预测').fill('尚未运行的代码预测，也应在登录后恢复。')
  await page.getByRole('button', { name: '查看提示 1' }).click()
  await expect(page.getByText('草稿已保存到本机。', { exact: true })).toBeVisible()
  await register(page, email, 'student', '代码草稿测试')
  await login(page, email); await confirmedSync(page)
  const context = await browser.newContext({ baseURL: appOrigin })
  try {
    const second = await context.newPage()
    await login(second, email); await confirmedSync(second); await selectRecoveredSpace(second)
    await second.goto('/learn/CS01-M02-O02')
    await expect(second.getByLabel('代码源文件')).toHaveValue(/draft only/)
    await expect(second.getByLabel('运行前预测')).toHaveValue('尚未运行的代码预测，也应在登录后恢复。')
    await expect(second.getByRole('button', { name: '查看提示 1' })).toHaveCount(0)
    await expect(second.getByLabel('标准输出')).toHaveCount(0)
    await expect(second.getByText('这是该版本的实际工具结果。', { exact: true })).toHaveCount(0)
  } finally { await context.close() }
  await logout(page); await page.goto('/learn/CS01-M02-O02')
  await expect(page.getByLabel('代码源文件')).not.toHaveValue(/draft only/)
  await expect(page.getByLabel('运行前预测')).toHaveValue('')
})
test('real teacher and student accounts claim work, restore across devices, isolate identities and recover a lost claim', async ({ page, browser, isMobile }) => {
  test.setTimeout(180000)
  const suffix = `${Date.now()}-${isMobile ? 'mobile' : 'desktop'}`
  const teacher = `teacher-${suffix}@example.test`; const a = `student-a-${suffix}@example.test`; const b = `student-b-${suffix}@example.test`
  await register(page, teacher, 'teacher', '教师测试'); await login(page, teacher)
  await expect(page.getByText('教师认证待审核', { exact: true })).toBeVisible()
  await capture(page, 'teacher-pending', isMobile)
  await page.goto('/teacher'); await page.getByLabel('课程名称', { exact: true }).fill('教师私人系统课程')
  await page.getByLabel('教学大纲与学习目标', { exact: true }).fill('私人教学大纲；尚未发布给学生。')
  await page.getByRole('button', { name: '保存设备草稿', exact: false }).click()
  await expect(page.getByText('私人备课草稿已保存本机，将逐项同步到教师账号。没有发布给学生。', { exact: true })).toBeVisible()
  await confirmedSync(page); await logout(page)
  await page.goto('/teacher'); await expect(page.getByText('还没有保存的备课草稿。', { exact: true })).toBeVisible()
  await completedWork(page); await register(page, a, 'student', '学生 A'); await login(page, a); await confirmedSync(page)
  await capture(page, 'student-sync', isMobile)
  await page.goto('/atlas'); await page.getByRole('button', { name: /栈与队列/ }).first().click(); await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
  const device: BrowserContext = await browser.newContext({ baseURL: appOrigin, viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile, hasTouch: isMobile }); const second = await device.newPage()
  try {
    await login(second, a); await confirmedSync(second); await selectRecoveredSpace(second)
    await second.goto('/evidence'); await expect(second.getByText('云端恢复的客户端记录 · 待复核', { exact: true })).toBeVisible()
    await capture(second, 'restored-evidence', isMobile)
    await second.goto('/atlas'); await second.getByRole('button', { name: /栈与队列/ }).first().click(); await expect(second.locator('.objective-inspector .evidence-pill')).toHaveText('尚未有效评估')
    await second.goto('/learn/CS03-STACK-01'); await expect(second.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('账户 A 的真实推演；最后入栈者先取出，空栈出栈没有输出并标记下溢。')
    await page.goto('/learn/CS03-STACK-01')
    await second.getByLabel('把你的解释也留下来', { exact: false }).fill('另一设备的新解释，不能被旧屏幕的其他字段修改抹掉。')
    await expect(second.getByText('本地已保存', { exact: true })).toBeVisible(); await confirmedSync(second)
    await page.evaluate(async () => {
      const { database } = await import('/src/local/database.ts')
      const { syncAccount } = await import('/src/local/sync.ts')
      const { account } = await (await fetch('/api/v1/auth/session')).json()
      const space = await database.meta.get('spaceId')
      await syncAccount(space.value, { account, isCurrent: () => true })
    })
    await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('另一设备的新解释，不能被旧屏幕的其他字段修改抹掉。')
    await page.getByRole('button', { name: '修改', exact: true }).click()
    await page.getByLabel('本次学习目标', { exact: true }).fill('保留其他设备解释，再编辑目标。')
    await expect(page.getByText('本地已保存', { exact: true })).toBeVisible()
    await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('另一设备的新解释，不能被旧屏幕的其他字段修改抹掉。')
    await confirmedSync(page)
  } finally { await device.close() }
  await logout(page); await page.goto('/learn/CS03-STACK-01'); await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('')
  await register(page, b, 'student', '学生 B'); await login(page, b)
  await page.goto('/learn/CS03-STACK-01'); await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('')
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill('学生 B 的独立作品。')
  await expect(page.getByText('本地已保存', { exact: true })).toBeVisible()
  await page.reload(); await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('学生 B 的独立作品。')
  await page.goto('/teacher'); await expect(page.getByRole('button', { name: '学生账号不提供备课提交', exact: false })).toBeDisabled()
  const sibling = await page.context().newPage(); await sibling.goto('/learn/CS03-STACK-01')
  await expect(sibling.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('学生 B 的独立作品。')
  let oldSessionRead = false; let releaseOldSession: () => void = () => undefined
  const oldSessionGate = new Promise<void>(resolve => { releaseOldSession = resolve })
  await sibling.route('**/api/v1/auth/session', async route => {
    if (!oldSessionRead) { oldSessionRead = true; const response = await route.fetch(); await oldSessionGate; await route.fulfill({ response }).catch(() => undefined) }
    else await route.continue()
  })
  await sibling.reload(); await expect.poll(() => oldSessionRead).toBe(true)
  await logout(page); await expect(sibling.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('')
  releaseOldSession(); await expect(sibling.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue(''); await sibling.close()
  await page.goto('/learn/CS03-STACK-01'); await page.getByLabel('把你的解释也留下来', { exact: false }).fill('丢失响应后也只能属于学生 A 的作品。')
  await expect(page.getByText('本地已保存', { exact: true })).toBeVisible()
  let lost = false; const claimIds: string[] = []
  await page.route('**/api/v1/sync/claims', async route => {
    claimIds.push(route.request().postDataJSON().claim_id)
    if (!lost) { lost = true; await route.fetch(); await route.abort('failed'); return }
    await route.continue()
  })
  await login(page, a); await page.goto('/local')
  await expect.poll(() => lost).toBe(true)
  await expect(page.getByText('归属请求已固定到当前账号，正在等待确认；不会转给其他账号', { exact: true })).toBeVisible()
  await logout(page); await login(page, b); await page.goto('/learn/CS03-STACK-01')
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('学生 B 的独立作品。')
  await logout(page); await login(page, a); await confirmedSync(page)
  expect(new Set(claimIds).size).toBe(claimIds.length)
  const spaces = page.locator('#record-space option'); expect(await spaces.count()).toBeGreaterThan(1)
  const oldSession = await browser.newContext({ storageState: await page.context().storageState() })
  try {
    expect((await oldSession.request.get(`${appOrigin}/api/v1/auth/session`)).status()).toBe(200)
    await page.goto('/account'); await page.getByRole('button', { name: '重置账号密码', exact: true }).click()
    await page.getByRole('button', { name: '申请密码重置', exact: false }).click()
    await page.getByLabel('密码重置码', { exact: true }).fill(await confirmationToken(a, 'reset_password'))
    const newPassword = 'Temporary-Replacement-Password-20261005'
    await page.getByLabel('新密码', { exact: false }).fill(newPassword)
    await page.getByRole('button', { name: '确认重置密码', exact: false }).click()
    await expect(page.getByRole('button', { name: '登录并关联本机记录', exact: false })).toBeVisible()
    expect((await oldSession.request.get(`${appOrigin}/api/v1/auth/session`)).status()).toBe(401)
    await login(page, a, newPassword)
  } finally { await oldSession.close() }
  await page.goto('/local')
  await expect.poll(() => page.locator('#record-space option').count()).toBeGreaterThan(1)
  const target = await page.locator('#record-space option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
  const selected = await page.locator('#record-space').inputValue()
  const delayed = target.find(value => value !== selected)!
  await page.evaluate(async () => {
    const { registerIdentityFlusher } = await import('/src/local/identity.ts')
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const unregister = registerIdentityFlusher(() => gate)
    Object.assign(window, { releaseSpaceSwitch: () => { unregister(); release() } })
  })
  await page.locator('#record-space').selectOption(delayed)
  const switcher = await page.context().newPage(); await logout(switcher); await login(switcher, b)
  await page.evaluate(() => { (window as unknown as { releaseSpaceSwitch: () => void }).releaseSpaceSwitch() })
  await page.goto('/account'); await expect(page.locator('.account-email')).toHaveText(b)
  await page.goto('/learn/CS03-STACK-01'); await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('学生 B 的独立作品。')
  await switcher.close()
})
