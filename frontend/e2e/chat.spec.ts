import { device, expect, test } from './helpers'

test.beforeEach(async ({ request }) => { await request.post('/api/dev/reset-admin-locks') })

test('secure chat: create, join with password, messages relay, wrong password fails, wipe on leave', async ({ browser }) => {
  const a = await device(browser, '/chat')
  await a.getByPlaceholder('At least 8 characters').fill('correct horse battery')
  await a.getByRole('button', { name: 'Create secure room' }).click()
  await a.waitForURL(/\/c\/[A-Z0-9]+$/)
  const code = a.url().split('/').pop()!
  await expect(a.getByText(`Room ${code}`)).toBeVisible({ timeout: 15_000 })
  await a.getByPlaceholder('Write a message').fill('secret hello')
  await a.getByRole('button', { name: 'Send' }).click()
  await expect(a.getByText('secret hello')).toBeVisible()

  const b = await device(browser)
  await b.goto(`/c/${code}`)
  await b.getByPlaceholder('Room password').fill('wrong password!!')
  await b.getByRole('button', { name: 'Join chat' }).click()
  await expect(b.getByText('Wrong password')).toBeVisible()
  await b.getByPlaceholder('Room password').fill('correct horse battery')
  await b.getByRole('button', { name: 'Join chat' }).click()
  await expect(b.getByText(`Room ${code}`)).toBeVisible({ timeout: 15_000 })
  await expect(b.getByText('secret hello')).toHaveCount(0)
  await expect(a.getByText('Someone joined')).toBeVisible()
  await expect(b.getByText('2/4 in room')).toBeVisible()
  await a.getByPlaceholder('Write a message').fill('second message')
  await a.getByRole('button', { name: 'Send' }).click()
  await expect(b.getByText('second message')).toBeVisible()
  await b.getByPlaceholder('Write a message').fill('reply!')
  await b.keyboard.press('Enter')
  await expect(a.getByText('reply!')).toBeVisible()

  b.once('dialog', d => d.accept())
  await b.getByRole('button', { name: /Leave/ }).click()
  await expect(a.getByText('Someone left')).toBeVisible()
  const c = await device(browser)
  await c.goto(`/c/${code}`)
  await c.getByPlaceholder('Room password').fill('correct horse battery')
  await c.getByRole('button', { name: 'Join chat' }).click()
  await expect(c.getByText(`Room ${code}`)).toBeVisible({ timeout: 15_000 })
  await expect(c.getByText('second message')).toHaveCount(0)
})

const BLOG = process.env.E2E_BLOG_URL ?? 'http://localhost:3001'
