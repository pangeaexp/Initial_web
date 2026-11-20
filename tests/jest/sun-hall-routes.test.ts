/** @jest-environment node */
/// <reference types="jest" />
import { GET } from '@/app/api/sun-hall/route'
import { POST as challenge } from '@/app/api/sun-hall/challenge/route'
import { POST as publish } from '@/app/api/sun-hall/publish/route'
import { getHall, issueChallenge, publishScore, HallError } from '@/lib/sun-hall/server'
import { RULES_VERSION } from '@/lib/sun-hall/game'

jest.mock('@/lib/sun-hall/server', () => {
  class HallError extends Error { constructor(public code: string, public status: number) { super(code) } }
  return { HallError, getHall: jest.fn(), issueChallenge: jest.fn(), publishScore: jest.fn() }
})
const request = (data: unknown, origin = 'http://localhost') => new Request('http://localhost/api/sun-hall', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data),
})
const valid = { rulesVersion: RULES_VERSION, token: 'a'.repeat(64), alias: 'Pilota_7', consent: true, inputs: [] }
beforeEach(() => {
  jest.mocked(getHall).mockResolvedValue([])
  jest.mocked(issueChallenge).mockResolvedValue({ rulesVersion: RULES_VERSION, token: 'a'.repeat(64), seed: 1, width: 480, height: 300 })
  jest.mocked(publishScore).mockResolvedValue({ id: 'score-id', entries: [] })
})
afterEach(() => jest.resetAllMocks())
test('GET returns the public ranking and a clear unavailable response', async () => {
  expect(await (await GET()).json()).toEqual({ entries: [] })
  jest.mocked(getHall).mockRejectedValue(new Error('private database detail'))
  const response = await GET()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'unavailable' })
})
test('issues a bounded challenge and rejects cross-origin or invalid requests before writes', async () => {
  expect((await challenge(request({ width: 480, height: 300 }))).status).toBe(200)
  jest.mocked(issueChallenge).mockClear()
  expect((await challenge(request({ width: 480, height: 300 }, 'https://other.example'))).status).toBe(403)
  expect((await challenge(request({ width: 100, height: 100 }))).status).toBe(400)
  expect(issueChallenge).not.toHaveBeenCalled()
})
test('publication requires explicit consent and rejects supplied scores and unsafe aliases', async () => {
  for (const data of [{ ...valid, consent: false }, { ...valid, points: 900 }, { ...valid, alias: '<script>' }]) expect((await publish(request(data))).status).toBe(400)
  expect(publishScore).not.toHaveBeenCalled()
  const response = await publish(request({ ...valid, alias: '  Àlex  ' }))
  expect(response.status).toBe(200)
  expect(publishScore).toHaveBeenCalledWith(valid.token, 'Àlex', [])
})
test('maps session and rate-limit errors and limits streamed bodies', async () => {
  jest.mocked(issueChallenge).mockRejectedValue(new HallError('limited', 429))
  expect((await challenge(request({ width: 480, height: 300 }))).status).toBe(429)
  jest.mocked(publishScore).mockRejectedValue(new HallError('expired', 410))
  expect((await publish(request(valid))).status).toBe(410)
  expect((await publish(request({ ...valid, padding: 'x'.repeat(25_000) }))).status).toBe(413)
})
