import { test, expect, type Page } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
const cs03 = JSON.parse(readFileSync(new URL('../../../content/courses/CS03/CS03-core-practice-0.3.0/manifest.json', import.meta.url), 'utf8'))
const cs03Queue = cs03.activities.find((row: { objective_codes: string[] }) => row.objective_codes.includes('CS03-M03-O02'))

test.use({ trace: 'off' })

// A known isolated fixture seeded by tools/testing/seed_review_fixture.py.
// Unverified teachers cannot claim or sign, so the flow needs a genuinely
// verified teacher account; no real human reviewer is forged.
const TEACHER_EMAIL = 'review-verified-teacher@invalid.test'
const TEACHER_PASSWORD = process.env.VAULT_E2E_TEACHER_PASSWORD ?? ''
const STUDENT_PASSWORD = 'Temporary-Review-Password-20261012'
const CS01_VERSION = '0a210de3-0057-5957-986a-902ab7580e18'

const GENERAL_SOURCE = `#include <stdio.h>
int main(void) {
  int minutes = 45;
  scanf("%d", &minutes);
  int amount;
  if (minutes <= 30) amount = 0;
  else if (minutes <= 60) amount = 5;
  else amount = 10;
  printf("%d\\n", amount);
  return 0;
}
`

const REVISED_SOURCE = `#include <stdio.h>
int main(void) {
  int minutes = 45;
  scanf("%d", &minutes);
  int amount;
  /* inclusive three-tier fee, endpoints documented for the reviewer */
  if (minutes <= 30) { amount = 0; }
  else if (minutes <= 60) { amount = 5; }
  else { amount = 10; }
  printf("%d\\n", amount);
  return 0;
}
`

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
  }, { timeout: 30000 }).toBe(true)
  return token!
}

async function registerStudent(page: Page, email: string) {
  await page.goto('/account')
  await page.getByRole('button', { name: '创建账号', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('显示名称', { exact: true }).fill('审阅流程学生')
  await page.getByRole('radio', { name: /学生/ }).check()
  await page.getByLabel('密码', { exact: false }).fill(STUDENT_PASSWORD)
  await page.getByRole('button', { name: '创建账号，确认邮箱', exact: false }).click()
  await expect(page.getByLabel('邮箱确认码', { exact: true })).toBeVisible()
  await page.getByLabel('邮箱确认码', { exact: true }).fill(await confirmationToken(email))
  await page.locator('form').getByRole('button', { name: '确认邮箱', exact: false }).click()
  await expect(page.getByText('邮箱已确认。现在可以登录并关联已有学习记录。', { exact: true })).toBeVisible()
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/account')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: false }).fill(password)
  await page.getByRole('button', { name: '登录并关联本机记录', exact: false }).click()
  await expect(page.locator('.account-email')).toHaveText(email)
}

async function saveAndRun(page: Page, source: string) {
  // A previously saved version keeps the editor read-only; open a new version
  // before editing again (the first run starts with an open editor).
  const newVersion = page.getByRole('button', { name: '修改并开始新版本' })
  await expect.poll(async () => await newVersion.isVisible() || await page.getByLabel('代码源文件').isEnabled()).toBe(true)
  if (await newVersion.isVisible().catch(() => false)) {
    await newVersion.click()
    await expect(page.getByLabel('代码源文件')).toBeEnabled()
  }
  await page.getByLabel('代码源文件').fill(source)
  await page.getByLabel('运行前预测').fill('按含端点的三段区间预测费用，并准备在独立环境核验。')
  await page.getByRole('button', { name: '保存并运行这一版' }).click()
  await expect(page.getByRole('region', { name: '任务条件核验' })).toBeVisible({ timeout: 120000 })
  // The saved revision must be the one we just wrote.
  await expect(page.getByLabel('代码源文件')).toHaveValue(source)
}

async function waitForSync(page: Page) {
  await page.goto('/local')
  await expect.poll(async () => {
    const text = await page.locator('.sync-counts').textContent()
    const confirmed = Number((text ?? '').match(/(\d+)\s*已确认/)?.[1] ?? '0')
    return confirmed > 0
  }, { timeout: 60000 }).toBe(true)
}

for (const kind of ['code', 'logic', 'cs03'] as const) {
const isCode = kind !== 'logic'
const OBJECTIVE = kind === 'cs03' ? 'CS03-M03-O02' : 'CS01-M03-O03'
const COURSE_VERSION = kind === 'cs03' ? cs03.course_version_id : CS01_VERSION
const workSource = kind === 'cs03' ? cs03Queue.reference_answer.files['main.cpp'] : GENERAL_SOURCE
const revisedSource = kind === 'cs03' ? workSource + '\n// Revision: FIFO, empty/full transitions and circular/linked agreement.\n' : REVISED_SOURCE
test(`${kind}: student submits, teacher returns, student revises, teacher signs and student appeals`, async ({ browser }, testInfo) => {
  test.setTimeout(180000)
  test.skip(!TEACHER_PASSWORD, 'Run against the isolated review fixture database.')
  const studentEmail = `review-flow-student-${Date.now()}@example.test`
  const device = { viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch, deviceScaleFactor: testInfo.project.use.deviceScaleFactor }
  const studentContext = await browser.newContext({ ...device, baseURL: `http://127.0.0.1:${process.env.VAULT_E2E_PORT ?? 5173}` })
  const teacherContext = await browser.newContext({ ...device, baseURL: `http://127.0.0.1:${process.env.VAULT_E2E_PORT ?? 5173}` })
  studentContext.setDefaultTimeout(15000)
  teacherContext.setDefaultTimeout(15000)
  const student = await studentContext.newPage()
  const teacher = await teacherContext.newPage()
  try {
    // --- Student creates and syncs real work -------------------------------
    await registerStudent(student, studentEmail)
    await login(student, studentEmail, STUDENT_PASSWORD)
    if (isCode) {
      await student.goto(`/learn/${OBJECTIVE}?courseVersion=${COURSE_VERSION}`)
      await expect(student.getByRole('heading', { name: kind === 'cs03' ? cs03Queue.title : '选择能揭示条件缺口的反例' })).toBeVisible()
      await saveAndRun(student, workSource)
    } else {
      await student.goto('/learn/CS05-LOGIC-01')
      await student.locator('#logic-explanation').fill('用 P 真 Q 假作为反例，我还需要教师反馈推理。')
      await expect(student.locator('.save-state')).toContainText('本地已保存')
    }
    await waitForSync(student)

    // --- Student submits the work for human review -------------------------
    await student.goto('/reviews')
    const target = student.locator('#review-target')
    await expect(target.locator('option')).not.toHaveCount(1, { timeout: 60000 })
    await target.selectOption({ index: 1 })
    await student.getByLabel('给教师的设计与思路说明').fill('实现了含端点的三段计费，请审阅设计与独立迁移。')
    await student.getByRole('button', { name: '提交人工审阅' }).click()

    const studentCard = student.locator('.review-card').first()
    await expect(studentCard).toBeVisible({ timeout: 60000 })
    // The server re-ran the work and derived server_tool evidence itself.
    await expect(studentCard).toContainText(isCode ? '服务端在隔离环境重新执行' : '已冻结学生作品')
    const assignmentId = await studentCard.getAttribute('data-assignment-id')
    expect(assignmentId).toBeTruthy()

    // --- Verified teacher claims and inspects the frozen work --------------
    await login(teacher, TEACHER_EMAIL, TEACHER_PASSWORD)
    await teacher.goto('/teacher')
    const queue = teacher.locator('.review-queue')
    await expect(queue).toContainText('人工审阅队列')
    // Scope to THIS student's assignment: the queue holds prior runs too.
    const teacherCard = queue.locator(`.review-card[data-assignment-id="${assignmentId}"]`)
    await expect(teacherCard).toBeVisible({ timeout: 60000 })
    // The frozen snapshot shows the real source and the server verification.
    await expect(teacherCard).toContainText('冻结的作品与核验')
    await teacherCard.getByText('冻结的作品与核验').click()
    await expect(teacherCard).toContainText(isCode ? 'int main' : '用 P 真 Q 假作为反例')
    if (kind === 'logic') await expect(teacherCard).toContainText('尚无服务端自动核验结论')
    await teacherCard.getByRole('button', { name: '接单审阅' }).click()
    await expect(teacherCard.locator('.review-status')).toHaveText('教师已接单')

    // --- Teacher returns the work for more evidence ------------------------
    const rubricFields = teacherCard.locator('fieldset.rubric-field')
    await expect(rubricFields).toHaveCount(3)
    await rubricFields.nth(0).getByRole('radio', { name: '达到', exact: true }).check()
    await rubricFields.nth(1).getByRole('radio', { name: '未达到', exact: true }).check()
    await rubricFields.nth(2).getByRole('radio', { name: '待核', exact: true }).check()
    for (let index = 0; index < 3; index += 1) {
      await rubricFields.nth(index).getByRole('textbox').fill(`第 ${index + 1} 条：依据当前作品与独立结果的判断。`)
    }
    await teacherCard.getByLabel('总评意见').fill('解释未说明端点与不变量，请补充后重审。')
    await teacherCard.getByRole('button', { name: '退回补充材料' }).click()
    await expect(teacherCard.locator('.review-status')).toHaveText('退回补充材料')

    // --- Student resubmits a real new revision -----------------------------
    await student.reload()
    const returnedCard = student.locator(`.review-card[data-assignment-id="${assignmentId}"]`)
    await expect(returnedCard.locator('.review-status')).toHaveText('退回补充材料', { timeout: 60000 })
    if (isCode) {
      await student.goto(`/learn/${OBJECTIVE}?courseVersion=${COURSE_VERSION}`)
      await saveAndRun(student, revisedSource)
    } else {
      await student.goto('/learn/CS05-LOGIC-01')
      await student.getByRole('button', { name: '修改并开始新版本' }).click()
      await student.locator('#logic-explanation').fill('补证：原命题与逆否命题逐行等值，逆命题并不总等值。')
      await expect(student.locator('.save-state')).toContainText('本地已保存')
    }
    await waitForSync(student)
    await student.goto('/reviews')
    const supplementCard = student.locator(`.review-card[data-assignment-id="${assignmentId}"]`)
    const supplementSelect = supplementCard.locator('select[id^="supplement-"]')
    await expect(supplementSelect.locator('option')).not.toHaveCount(1, { timeout: 60000 })
    await supplementSelect.selectOption({ index: 1 })
    await supplementCard.locator('textarea[id^="note-"]').fill('补充了端点与不变量说明，并附新版本运行。')
    await supplementCard.getByRole('button', { name: '提交补充材料' }).click()
    await expect(supplementCard.locator('.review-status')).toHaveText('已补充，等待复核', { timeout: 60000 })

    // --- Teacher approves the revised work and signs -----------------------
    await teacher.reload()
    const redecideCard = teacher.locator(`.review-card[data-assignment-id="${assignmentId}"]`)
    await expect(redecideCard).toBeVisible({ timeout: 60000 })
    const redoFields = redecideCard.locator('fieldset.rubric-field')
    await expect(redoFields).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      await redoFields.nth(index).getByRole('radio', { name: '达到', exact: true }).check()
      await redoFields.nth(index).getByRole('textbox').fill(`复核第 ${index + 1} 条：补证充分。`)
    }
    await redecideCard.getByLabel('总评意见').fill('补证充分，设计解释与边界处理清楚。')
    await redecideCard.getByRole('button', { name: '判定通过' }).click()
    await expect(redecideCard).toHaveCount(0, { timeout: 60000 })

    // --- Student sees the result and appeals -------------------------------
    await student.reload()
    const approvedCard = student.locator(`.review-card[data-assignment-id="${assignmentId}"]`)
    await expect(approvedCard.locator('.review-status')).toHaveText('审阅通过', { timeout: 60000 })
    await expect(approvedCard).toContainText('授权教师意见')
    if (isCode) {
      await student.goto(`/atlas?course=${kind === 'cs03' ? 'CS03' : 'CS01'}&courseVersion=${COURSE_VERSION}&goal=${OBJECTIVE}`)
      await expect(student.locator('.objective-inspector .evidence-pill')).toHaveText('有达标证据', { timeout: 30000 })
      await expect(student.locator('.scope-total strong')).toContainText('1 / 30')
      await student.goto('/reviews')
      await expect(approvedCard.locator('.review-status')).toHaveText('审阅通过')
    }
    await approvedCard.getByPlaceholder(/具体说明你不同意哪一条判定/).fill('对独立迁移一条的判定有异议，请复核。')
    await approvedCard.getByRole('button', { name: '提出异议并请求复核' }).click()
    await expect(approvedCard.locator('.review-status')).toHaveText('异议复核中', { timeout: 60000 })
    if (isCode) {
      await student.goto(`/atlas?course=${kind === 'cs03' ? 'CS03' : 'CS01'}&courseVersion=${COURSE_VERSION}&goal=${OBJECTIVE}`)
      await expect(student.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
      await expect(student.locator('.scope-total strong')).toContainText('0 / 30')
    }

  } finally {
    await studentContext.close()
    await teacherContext.close()
  }
})

}
