import { test, expect, type Page } from '@playwright/test'

const tracePath = '/learn/CS03-STACK-01'
const codePath = '/learn/CS03-STACK-02'
const explanation = '后加入且未取出的元素先取出；空栈不改变并标记下溢。'
async function openAndComplete(page: Page) {
  await page.goto(tracePath)
  await page.getByRole('button', { name: '确认目标，开始尝试' }).click()
  const stacks = ['[8]', '[8, 3]', '[8]', '[8, 5]', '[8]', '[]', '[]']
  const outputs = ['', '', '3', '', '5', '8', '']
  for (let index = 0; index < 7; index++) {
    await page.getByLabel(`第${index + 1}步操作后的栈`, { exact: true }).fill(stacks[index])
    await page.getByLabel(`第${index + 1}步输出`, { exact: true }).fill(outputs[index])
  }
  await page.getByLabel('第7步发生下溢', { exact: true }).check()
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill(explanation)
}

test('catalog states its construction scope and narrow pages do not horizontally overflow', async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/atlas', tracePath, '/teacher', '/local', '/evidence', '/account']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(100)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} at ${width}px must keep horizontal scrolling inside its own panel`).toBe(true)
      if (path === '/') {
        await expect(page.locator('.course-row')).toHaveCount(13)
        await expect(page.getByText('完整建成 0 / 13 门。', { exact: false })).toBeVisible()
      }
      if (path === '/teacher') await expect(page.getByText('教师账号已接入；资料上传、AI 建课、学生预览与发布尚未接入。', { exact: false })).toBeVisible()
    }
  }
})

test('flushes edits before an immediate SPA departure and resumes the actual last objective', async ({ page }) => {
  await page.goto(tracePath)
  const field = page.getByLabel('把你的解释也留下来', { exact: false })
  await field.fill('离开前最后一次输入应该保留。')
  await page.getByRole('link', { name: '探索', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: '继续本地学习', exact: false }).click()
  await expect(field).toHaveValue('离开前最后一次输入应该保留。')
  await page.reload()
  await expect(field).toHaveValue('离开前最后一次输入应该保留。')
  await page.goto(codePath)
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill('这是括号匹配工作台的最新位置。')
  await page.getByRole('link', { name: '探索', exact: true }).click()
  await page.getByRole('link', { name: '继续本地学习', exact: false }).click()
  await expect(page).toHaveURL(codePath)
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('这是括号匹配工作台的最新位置。')
})

test('clears only the current guest device space after an explicit confirmation', async ({ page }) => {
  await page.goto(tracePath)
  const explanationField = page.getByLabel('把你的解释也留下来', { exact: false })
  await explanationField.fill('待清理的访客学习记录。')
  await page.goto('/local')
  await expect(page.getByRole('button', { name: '清除此设备的访客记录' })).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: '清除此设备的访客记录' }).click()
  await page.goto(tracePath)
  await expect(explanationField).toHaveValue('待清理的访客学习记录。')
  await page.goto('/local')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '清除此设备的访客记录' }).click()
  await expect(page.getByText('当前访客空间已从本机清除，已建立新的空白空间。')).toBeVisible()
  await page.goto(tracePath)
  await expect(explanationField).toHaveValue('')
  await page.reload()
  await expect(explanationField).toHaveValue('')
})

test('records requested self-study answers and preserves a real verification without claiming mastery', async ({ page, isMobile }) => {
  await openAndComplete(page)
  if (isMobile) await page.getByRole('button', { name: '原理与帮助', exact: true }).click()
  await page.getByRole('button', { name: '参考答案', exact: true }).click()
  await expect(page.getByText('自学答案 · 已记录查看', { exact: true })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: '动手实践', exact: true }).click()
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByText('七步推演核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '学习证据', exact: true }).click()
  await expect(page.getByText('状态推演正确 · 目标仍待复核', { exact: true })).toBeVisible()
  await page.getByText('核验依据与帮助范围', { exact: true }).click()
  await expect(page.getByText('1 条', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('状态推演正确 · 目标仍待复核', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '知识图谱', exact: true }).click()
  await expect(page.locator('.scope-total strong')).toContainText('0 / 2')
  await expect(page.locator('.objective-inspector .evidence-pill')).toHaveText('部分条件满足')
})

test('binds a delayed result to its submitted snapshot while keeping later edits', async ({ page }) => {
  await openAndComplete(page)
  await page.route('**/api/v1/guest-leases/*/operations', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.continue().catch(() => undefined) })
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill('提交之后继续编辑的新解释。')
  await expect(page.getByText('七步推演核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
  await expect(page.getByText('这是已提交作品版本的结论；当前编辑尚未重新核验。', { exact: true })).toBeVisible()
  await page.reload()
  if (await page.getByRole('button', { name: '动手实践', exact: true }).isVisible()) await page.getByRole('button', { name: '动手实践', exact: true }).click()
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('提交之后继续编辑的新解释。')
})

test('can cancel a pending check and navigate without leaving the next objective disabled', async ({ page }) => {
  await openAndComplete(page)
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/guest-leases/*/operations', async route => { await gate; await route.continue().catch(() => undefined) })
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await page.getByRole('link', { name: '知识图谱', exact: true }).click()
  await expect(page.getByText('核验正在进行。请等待完成，或取消核验后继续离开。', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '取消核验', exact: true }).click()
  release()
  await expect(page).toHaveURL('/atlas')
  await page.goto(codePath)
  await expect(page.getByRole('button', { name: '保存作品版本', exact: true })).toBeEnabled()
})

test('network failure preserves work and does not create verification evidence', async ({ page }) => {
  await openAndComplete(page)
  await page.route('**/api/v1/guest-leases/*/operations', route => route.abort('failed'))
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByRole('button', { name: '提交临时核验', exact: false })).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue(explanation)
  await page.getByRole('link', { name: '学习证据', exact: true }).click()
  await expect(page.getByText('已保存作品，尚无核验结果。', { exact: false })).toBeVisible()
})

test('a lost response retries the same operation and creates one durable evidence record', async ({ page }) => {
  await openAndComplete(page)
  const keys: string[] = []
  let lost = false
  await page.route('**/api/v1/guest-leases/*/operations', async route => {
    keys.push(route.request().headers()['idempotency-key'])
    if (!lost) { lost = true; await route.fetch(); await route.abort('failed'); return }
    await route.continue()
  })
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByRole('button', { name: '提交临时核验', exact: false })).toBeEnabled()
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByText('七步推演核验通过，完整目标仍待复核。', { exact: true })).toBeVisible()
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1])
  await page.getByRole('link', { name: '学习证据', exact: true }).click()
  await expect(page.locator('.evidence-record')).toHaveCount(1)
  await expect(page.locator('.stored-result')).toHaveCount(1)
})

test('rejects a tampered real checker response before local evidence is written', async ({ page }) => {
  await openAndComplete(page)
  await page.route('**/api/v1/guest-leases/*/operations', async route => {
    const response = await route.fetch()
    const data = await response.json()
    data.result.artifact_hash = '0'.repeat(64)
    await route.fulfill({ response, json: data })
  })
  await page.getByRole('button', { name: '提交临时核验', exact: false }).click()
  await expect(page.getByText('核验结果的来源或作品版本不一致，已停止写入学习证据。', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '学习证据', exact: true }).click()
  await expect(page.locator('.stored-result')).toHaveCount(0)
  await expect(page.getByText('已保存作品，尚无核验结果。', { exact: false })).toBeVisible()
})

test('storage failure keeps unsaved work visible and blocks unsafe departure until recovered', async ({ page }) => {
  await page.goto(tracePath)
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toBeVisible()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    Object.assign(window, { restoreDraftWrites: () => { IDBObjectStore.prototype.put = original } })
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'workDrafts') throw new DOMException('Quota fixture', 'QuotaExceededError')
      return original.apply(this, args)
    }
  })
  await page.getByLabel('把你的解释也留下来', { exact: false }).fill('存储失败时也不能把我还没有保存的解释清空。')
  await expect(page.getByText('本地保存失败', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '探索', exact: true }).click()
  await expect(page.getByText('离开前保存失败，已保留当前页面。请重试或导出作品。', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(tracePath)
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('存储失败时也不能把我还没有保存的解释清空。')
  await page.evaluate(() => { (window as unknown as { restoreDraftWrites: () => void }).restoreDraftWrites() })
  await page.getByRole('button', { name: '保存作品版本', exact: true }).click()
  await expect(page.getByText('作品版本 1 已保存在本地。', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('把你的解释也留下来', { exact: false })).toHaveValue('存储失败时也不能把我还没有保存的解释清空。')
})

test('assistant sends nothing before opt-in and restores its reply with the same work revision', async ({ page, isMobile }) => {
  let sent: Record<string, unknown> | undefined
  await page.route('**/api/v1/model-profiles', route => route.fulfill({ json: {
    profiles: [
      { id: 'local_tutor', label: '本地辅导', provider: '本地', capabilities: ['text'] },
      { id: 'remote_reasoner', label: '推理模型', provider: '自选服务', capabilities: ['text', 'reasoning'] },
    ],
    task_defaults: { hint: 'local_tutor', result_feedback: 'remote_reasoner' },
  } }))
  await page.route('**/api/v1/guest-nonce', route => route.fulfill({ json: { nonce: 'x'.repeat(43), expires_at: new Date(Date.now() + 300000).toISOString() } }))
  await page.route('**/api/v1/guest-leases', route => route.fulfill({ status: 201, json: {
    lease_id: 'd8fd8e56-f7d4-47a8-9cc2-7adfa7bd7319', token: 't'.repeat(43),
    created_at: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 1800000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 7200000).toISOString(), allowed_operations: ['verify_trace'], storage: 'ephemeral_memory',
  } }))
  await page.route('**/api/v1/guest-leases/*/learning-assist', async route => {
    sent = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ json: { message: '先检查空栈出栈的约定。', next_action: '写下条件后重新推演。', mastery_asserted: false } })
  })
  await page.goto(tracePath)
  await page.getByRole('button', { name: '确认目标，开始尝试' }).click()
  if (isMobile) await page.getByRole('button', { name: '原理与帮助', exact: true }).click()
  const request = page.getByRole('button', { name: '请求一次学习帮助', exact: false })
  await expect(request).toBeDisabled()
  await expect(page.getByLabel('本次使用的模型')).toHaveValue('local_tutor')
  await page.getByLabel('本次使用的模型').selectOption('remote_reasoner')
  await expect(page.getByRole('region', { name: '学习助手' }).getByText(/发送给 自选服务/)).toBeVisible()
  await page.getByLabel('你的问题').fill('为什么空栈时没有输出？')
  await page.getByLabel(/我同意将当前目标/).check()
  await expect(request).toBeEnabled()
  await request.click()
  await expect(page.getByText('先检查空栈出栈的约定。', { exact: true })).toBeVisible()
  expect(sent?.disclosure_accepted).toBe(true)
  expect(sent?.intent).toBe('hint')
  expect(sent?.model_profile_id).toBe('remote_reasoner')
  expect(sent?.revision_id).toBeTruthy()
  await page.reload()
  if (isMobile) await page.getByRole('button', { name: '原理与帮助', exact: true }).click()
  await expect(page.getByText('先检查空栈出栈的约定。', { exact: true })).toBeVisible()
  await expect(page.getByText(/关联作品版本/)).toBeVisible()
  await page.getByRole('button', { name: '回到作品继续尝试' }).click()
  const explanationField = page.getByLabel('把你的解释也留下来', { exact: false })
  await expect(explanationField).toBeFocused()
  if (isMobile) await expect(page.getByRole('button', { name: '动手实践', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await explanationField.fill('我先检查空栈条件，再重新推演最后一步。')
  await expect(page.locator('.save-state')).toContainText('本地已保存')
  await page.reload()
  await expect(explanationField).toHaveValue('我先检查空栈条件，再重新推演最后一步。')
})
