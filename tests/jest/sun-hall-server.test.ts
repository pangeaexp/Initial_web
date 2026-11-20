/** @jest-environment node */
/// <reference types="jest" />
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdminConfig } from '@/lib/supabase/env'
import { getHall, issueChallenge, publishScore } from '@/lib/sun-hall/server'
import { advanceGame, applyInput, createGame, type GameInput } from '@/lib/sun-hall/game'
import { projectTableBall } from '@/lib/table-tennis'

jest.mock('server-only', () => ({}))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/env', () => ({ requireSupabaseAdminConfig: jest.fn() }))
const runs = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const scores = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn(), order: jest.fn().mockReturnThis(), limit: jest.fn() }
const db = { from: jest.fn((table: string) => table === 'sun_game_runs' ? runs : scores), rpc: jest.fn() }
const run = () => ({ id: 'run-id', seed: 1234, width: 480, height: 300, created_at: new Date(Date.now() - 31_000).toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null })
beforeEach(() => {
  jest.mocked(requireSupabaseAdminConfig).mockReturnValue({ url: 'http://localhost', anonKey: '', serviceRoleKey: 'test-fixture-only' })
  jest.mocked(createClient).mockReturnValue(db as unknown as ReturnType<typeof createClient>)
  runs.maybeSingle.mockResolvedValue({ data: run(), error: null })
  scores.limit.mockResolvedValue({ data: [], error: null })
  scores.single.mockResolvedValue({ data: { id: 'saved-id' }, error: null })
  db.rpc.mockResolvedValue({ data: 'score-id', error: null })
})
afterEach(() => jest.clearAllMocks())
test('only hashes the session token and caller identifier in the database', async () => {
  const response = await issueChallenge({ width: 480, height: 300 }, new Request('http://localhost', { headers: { 'x-forwarded-for': '127.0.0.1' } }))
  expect(response.token).toMatch(/^[a-f0-9]{64}$/)
  const arguments_ = db.rpc.mock.calls[0][1]
  expect(arguments_.p_token_hash).not.toBe(response.token)
  expect(arguments_.p_client_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(arguments_.p_client_hash).not.toContain('127.0.0.1')
})
test('reconstructs and publishes points from coordinates rather than trusting the browser', async () => {
  const game = createGame({ width: 480, height: 300 }, 1234), inputs: GameInput[] = []
  for (let i = 0; i < 5; i++) {
    const t = 200 + i * 200; advanceGame(game, t)
    const { x, y } = projectTableBall(game.ball, game.width, game.height)
    const input = { t, x, y }; inputs.push(input); applyInput(game, input)
  }
  expect(await publishScore('a'.repeat(64), 'Player', inputs)).toEqual({ id: 'score-id', entries: [] })
  expect(db.rpc).toHaveBeenCalledWith('publish_sun_game_score', expect.objectContaining({ p_points: 6, p_hits: 5, p_misses: 0, p_best_streak: 5 }))
})
test('rejects early, expired and invalid traces without inserting scores', async () => {
  runs.maybeSingle.mockResolvedValueOnce({ data: { ...run(), created_at: new Date().toISOString() }, error: null })
  await expect(publishScore('a'.repeat(64), 'Player', [])).rejects.toMatchObject({ status: 422 })
  runs.maybeSingle.mockResolvedValueOnce({ data: { ...run(), expires_at: new Date(Date.now() - 1).toISOString() }, error: null })
  await expect(publishScore('a'.repeat(64), 'Player', [])).rejects.toMatchObject({ status: 410 })
  await expect(publishScore('a'.repeat(64), 'Player', [{ t: 30_000, x: 0, y: 0 }])).rejects.toMatchObject({ status: 422 })
  expect(db.rpc).not.toHaveBeenCalled()
})
test('retries return the already saved score and the list exposes only public fields', async () => {
  runs.maybeSingle.mockResolvedValue({ data: { ...run(), used_at: new Date().toISOString() }, error: null })
  expect(await publishScore('a'.repeat(64), 'Changed', [])).toEqual({ id: 'saved-id', entries: [] })
  expect(db.rpc).not.toHaveBeenCalled()
  await getHall()
  expect(scores.select).toHaveBeenCalledWith('id,alias,points,hits,misses,best_streak,accuracy')
  expect(scores.limit).toHaveBeenCalledWith(10)
})
