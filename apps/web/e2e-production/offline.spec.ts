import { expect, test } from '@playwright/test'

test('reopens a previously visited guest workspace offline without caching API responses', async ({ page, context }) => {
  await page.goto('/learn/CS03-STACK-01')
  const explanation = page.getByLabel('把你的解释也留下来', { exact: false })
  await explanation.fill('离线重开后仍能找到的本人作品。')
  await page.getByRole('link', { name: '探索', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const cachedPaths = await page.evaluate(async () => {
    const names = await caches.keys()
    const urls = (await Promise.all(names.filter(name => name.startsWith('vault-shell-')).map(async name => {
      const cache = await caches.open(name)
      return (await cache.keys()).map(request => new URL(request.url).pathname)
    }))).flat()
    return urls
  })
  expect(cachedPaths).toContain('/index.html')
  expect(cachedPaths.some(path => path.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/learn/CS03-STACK-01')
  const resumed = reopened.getByLabel('把你的解释也留下来', { exact: false })
  await expect(resumed).toHaveValue('离线重开后仍能找到的本人作品。')
  await resumed.fill('断网重开后继续修改。')
  await reopened.getByRole('link', { name: '探索', exact: true }).click()
  await reopened.goto('/learn/CS03-STACK-01')
  await expect(resumed).toHaveValue('断网重开后继续修改。')
})
