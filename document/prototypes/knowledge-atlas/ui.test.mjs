import { test, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const url = process.env.VAULT_GRAPH_DESIGN_URL ?? 'http://127.0.0.1:5176/prototypes/knowledge-atlas/index.html'
let browser, context, page
let errors, requests
before(async () => { browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true }) })
after(async () => { await browser?.close() })
beforeEach(async () => {
  context = await browser.newContext({ viewport: {width:1520,height:1120}, reducedMotion:'reduce' })
  page = await context.newPage()
  page.setDefaultTimeout(6000)
  errors = []; requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  await page.goto(url)
  await expect(page.locator('#scope-summary')).toContainText('5 / 32')
})
afterEach(async () => {
  assert.deepEqual(errors, [], 'Prototype must have no unhandled browser errors')
  assert.ok(requests.every(request => request.startsWith('http://127.0.0.1:5176/') || request.startsWith('data:')), 'No learning APIs or external requests')
  assert.equal(await page.evaluate(() => localStorage.length),0,'No learning or account storage writes')
  await context.close()
})

test('overview and filtered list preserve 32 unique goals with cross-chapter references', async () => {
  await expect(page.locator('.chapter-region')).toHaveCount(8)
  await page.getByLabel('目标状态',{exact:true}).selectOption('consolidate')
  await expect(page.locator('#visible-count')).toHaveText('范围 32 · 匹配 4')
  await expect(page.locator('#scope-summary')).toContainText('5 / 32')
  await page.getByRole('button',{name:'清除筛选',exact:true}).click()
  await page.getByRole('button',{name:'目录',exact:true}).click()
  await expect(page.locator('.goal-pick')).toHaveCount(33)
  await expect(page.locator('[data-id="cost-analysis"].goal-pick')).toHaveCount(2)
  await expect(page.locator('#scope-summary')).toContainText('5 / 32')
})

test('drill-down, typed relationships, evidence and learning-return loop are usable', async () => {
  await page.getByRole('button',{name:'继续栈的推演'}).click()
  await page.getByText('知识关系与来源 · 5 条',{exact:true}).click()
  await page.getByText('本章全部 4 个目标',{exact:true}).click()
  await expect(page.locator('#inspector h2')).toHaveText('推演栈的状态变化')
  await expect(page.locator('.network-node')).toHaveCount(3)
  await page.getByRole('checkbox',{name:'后续应用',exact:true}).check()
  await expect(page.locator('.other-goals')).toHaveAttribute('open','')
  await expect(page.locator('#inspector details').filter({has:page.getByText('知识关系与来源 · 5 条',{exact:true})})).toHaveAttribute('open','')
  await expect(page.locator('.network-edge.application')).toHaveCount(2)
  await page.getByRole('button',{name:'后续应用：推演栈的状态变化 → 处理括号匹配',exact:true}).click()
  await expect(page.locator('.selection-note').last()).toContainText('来源：模拟设计关系')
  const hash=await page.evaluate(()=>location.hash)
  await page.getByRole('button',{name:'预览学习入口',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('不会运行代码或产生学习证据')
  await page.getByRole('button',{name:'返回原来的图谱位置'}).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  assert.equal(await page.evaluate(()=>location.hash),hash)
  await expect(page.locator('#inspector h2')).toHaveText('推演栈的状态变化')
})

test('simulation changes only the covered goal and preserves selection and viewport', async () => {
  await page.getByRole('button',{name:'继续栈的推演'}).click()
  const before = await page.locator('.network-node').allTextContents()
  const beforeScroll = await page.locator('.network-scroll').evaluate(element=>element.scrollLeft)
  await page.getByLabel('模拟核验结果',{exact:true}).selectOption('pass')
  await expect(page.locator('#scope-summary')).toContainText('6 / 32')
  await expect(page.locator('#inspector > .state')).toContainText('有达标证据')
  assert.equal(await page.locator('.network-scroll').evaluate(element=>element.scrollLeft),beforeScroll)
  const after = await page.locator('.network-node').allTextContents()
  assert.equal(before.filter((text,index)=>text!==after[index]).length,1)
  await page.getByLabel('模拟核验结果',{exact:true}).selectOption('conflict')
  await expect(page.locator('#scope-summary')).toContainText('5 / 32')
  await expect(page.locator('#inspector > .state')).toContainText('需要巩固')
  await expect(page.locator('#inspector')).toContainText('后续核验发现缺口')
  await expect(page.locator('#inspector')).toContainText('独立新条件核验通过')
  await page.reload()
  await expect(page.locator('#inspector')).toContainText('独立新条件核验通过')
  await expect(page.locator('#inspector > .state')).toContainText('需要巩固')
})

test('application sources are not labelled as mandatory prerequisites', async () => {
  await page.goto(`${url}#chapter=trees&goal=heap-adjust&relations=application`)
  await expect(page.locator('.network-column').first()).toHaveText('先修或应用来源')
  await expect(page.locator('.focus-relations')).toContainText('后续应用')
})

test('resize preserves keyboard focus and expanded evidence details', async () => {
  await page.getByRole('button',{name:'继续栈的推演'}).click()
  await page.getByText('已有证据与帮助 · 3 条',{exact:true}).click()
  await page.locator('.network-node[aria-pressed="true"]').focus()
  await page.setViewportSize({width:1280,height:960})
  await expect(page.locator('#inspector details').first()).toHaveAttribute('open','')
  await expect(page.locator('.network-node[aria-pressed="true"]')).toBeFocused()
})

test('invalid chapter and goal combinations recover to a consistent graph', async () => {
  await page.goto(`${url}#chapter=trees&goal=stack-trace`)
  await expect(page.locator('#canvas-title')).toHaveText('栈与队列')
  await expect(page.locator('#inspector h2')).toHaveText('推演栈的状态变化')
  await page.goto(`${url}#chapter=trees`)
  await expect(page.locator('.network-node[aria-pressed="true"]')).toContainText('推演树的遍历')
  await expect(page.locator('#inspector h2')).toHaveText('推演树的遍历')
})

test('search, refresh, browser back, unavailable activity and empty results stay truthful', async () => {
  await page.getByLabel('查找知识点',{exact:true}).fill('装载')
  await page.locator('#search-results').getByRole('button',{name:/比较装载因子/}).click()
  await expect(page.locator('#inspector h2')).toHaveText('比较装载因子')
  await expect(page.getByRole('button',{name:'运行环境待适配',exact:true})).toBeDisabled()
  await page.reload()
  await expect(page.locator('#inspector h2')).toHaveText('比较装载因子')
  await page.getByRole('button',{name:'课程全景',exact:true}).click()
  await page.goBack()
  await expect(page.locator('#inspector h2')).toHaveText('比较装载因子')
  await page.getByLabel('查找知识点',{exact:true}).fill('<script>不存在</script>')
  await expect(page.locator('#search-results')).toContainText('没有找到')
  await expect(page.locator('#scope-summary')).toContainText('5 / 32')
})

test('keyboard path selects a target and opens and closes the learning preview', async () => {
  await page.getByRole('button',{name:'继续栈的推演'}).focus()
  await page.keyboard.press('Enter')
  const selected = page.locator('.network-node[aria-pressed="true"]')
  await selected.focus()
  await page.keyboard.press('Enter')
  await expect(selected).toBeFocused()
  await page.getByRole('button',{name:'预览学习入口',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

for (const viewport of [{width:320,height:800},{width:390,height:844},{width:844,height:390}]) {
  test(`responsive graph and directory at ${viewport.width}x${viewport.height}`, async () => {
    await page.setViewportSize(viewport)
    await page.getByRole('button',{name:'继续栈的推演'}).click()
    await expect(page.locator('#inspector h2')).toHaveText('推演栈的状态变化')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'No document horizontal overflow')
    const boxes=await page.locator('.network-node').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j]
      assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y, 'Nodes do not overlap')
    }
    await page.getByRole('button',{name:'目录',exact:true}).click()
    await expect(page.locator('.goal-pick')).toHaveCount(4)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await page.getByRole('button',{name:'图谱',exact:true}).click()
    if(viewport.width===390){
      await mkdir(new URL('./previews/',import.meta.url),{recursive:true})
      await page.screenshot({path:new URL('./previews/mobile-focus.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true})
    }
  })
}

test('capture desktop design states for visual review', async () => {
  await mkdir(new URL('./previews/',import.meta.url),{recursive:true})
  const path = name => new URL(`./previews/${name}`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')
  await page.screenshot({path:path('desktop-overview.png'),fullPage:true})
  await page.getByRole('button',{name:'继续栈的推演'}).click()
  await page.getByRole('checkbox',{name:'后续应用',exact:true}).check()
  await page.locator('#canvas-title').focus()
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.screenshot({path:path('desktop-focus.png'),fullPage:true})
})
