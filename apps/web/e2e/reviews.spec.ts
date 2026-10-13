import { test, expect, type Page } from '@playwright/test'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

test.use({ trace: 'off' })
const password = 'Temporary-Review-Password-20261012'
async function capture(page: Page, name: string, mobile: boolean) {
  const directory = process.env.VAULT_E2E_CAPTURE_DIR
  if (!directory) return
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.press('Control+Home')
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, `${name}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true })
}

async function confirmationToken(email: string, purpose = 'verify_email') {
  const directory = process.env.VAULT_E2E_MAIL_CAPTURE_DIR
  if (!directory) throw new Error('真实邮箱验证测试需要 VAULT_E2E_MAIL_CAPTURE_DIR。')
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

async function login(page: Page, email: string) {
  await page.goto('/account')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: false }).fill(password)
  await page.getByRole('button', { name: '登录并关联本机记录', exact: false }).click()
  await expect(page.locator('.account-email')).toHaveText(email)
}

test('student review page is honest about the absence of a real reviewer', async ({ page, isMobile }) => {
  test.setTimeout(120000)
  const email = `review-student-${Date.now()}-${isMobile ? 'm' : 'd'}@example.test`
  await register(page, email, 'student', '审阅学生')
  await login(page, email)
  await page.goto('/reviews')

  await expect(page.getByRole('heading', { level: 1, name: '人工审阅与异议' })).toBeVisible()
  // No real verified teacher and no professional review: the UI must not claim
  // a teacher was arranged and must state nothing is auto-signed.
  await expect(page.locator('.reviews-page')).toContainText('不会自动签名或通过')
  await expect(page.locator('.reviews-page')).toContainText('专业审校当前')
  // With no verified local artifact there is nothing to submit yet.
  await expect(page.locator('.review-submit')).toContainText('还没有可提交的作品版本')
  await expect(page.locator('.review-list')).toContainText('还没有提交过人工审阅')
  await capture(page, 'reviews-student', isMobile)
})

test('unverified teacher cannot claim or sign any review', async ({ page, isMobile }) => {
  test.setTimeout(120000)
  const email = `review-teacher-${Date.now()}-${isMobile ? 'm' : 'd'}@example.test`
  await register(page, email, 'teacher', '待认证教师')
  await login(page, email)
  await page.goto('/teacher')

  const queue = page.locator('.review-queue')
  await expect(queue.getByRole('heading', { name: '人工审阅队列' })).toBeVisible()
  await expect(queue).toContainText('不能接单、判定或签署任何审阅')
  await expect(page.getByRole('button', { name: '接单审阅' })).toHaveCount(0)
  await capture(page, 'reviews-teacher-queue', isMobile)
})
