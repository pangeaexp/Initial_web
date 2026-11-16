/// <reference types="jest" />
import { advanceGame, applyInput, createGame, replayGame, type GameInput } from '@/lib/sun-hall/game'
import { boardSchema, publishSchema } from '@/lib/sun-hall/contracts'

const board = { width: 480, height: 300 }
function trace() {
  const game = createGame(board, 1234), inputs: GameInput[] = []
  for (let i = 0; i < 20; i++) {
    const t = 200 + i * 250
    // Rendering can advance at arbitrary refresh rates between contacts.
    advanceGame(game, t - 17); advanceGame(game, t)
    const input = { t, x: game.x + 28, y: game.y + 28 }
    inputs.push(input); applyInput(game, input)
  }
  return { game, inputs }
}
test('server replay matches rendered play, including progressive speed and combo bonuses', () => {
  const { game, inputs } = trace()
  const replayed = replayGame(board, 1234, inputs)
  expect(replayed).toEqual(game)
  expect(replayed.points).toBe(47)
  expect(replayed.bestStreak).toBe(20)
  expect(replayed.x).toBeGreaterThanOrEqual(0)
  expect(replayed.x).toBeLessThanOrEqual(board.width - 56)
})
test('altered coordinates are evaluated as misses instead of accepting the claimed hits', () => {
  const { inputs } = trace()
  inputs[0] = { t: inputs[0].t, x: 0, y: 0 }
  const replayed = replayGame(board, 1234, inputs)
  expect(replayed.misses).toBeGreaterThan(0)
  expect(replayed.points).toBeLessThan(47)
})
test.each([
  [{ t: -1, x: 20, y: 20 }], [{ t: 30_000, x: 20, y: 20 }],
  [{ t: 200, x: 20, y: 20 }, { t: 250, x: 20, y: 20 }],
  [{ t: 200, x: 20, y: 20 }, { t: 100, x: 20, y: 20 }],
  [{ t: 200, x: 500, y: 20 }], [{ t: 200, x: NaN, y: 20 }],
])('rejects impossible timestamps, bursts and coordinates: %j', (...inputs) => {
  expect(() => replayGame(board, 1234, inputs as GameInput[])).toThrow()
})
test('zero-input rounds and long animations stay bounded', () => {
  const game = replayGame(board, 99, [])
  advanceGame(game, 1_000_000)
  expect(game.tick).toBeLessThanOrEqual(1800)
  expect(game.points).toBe(0)
  expect(game.y).toBeGreaterThanOrEqual(0)
  expect(game.y).toBeLessThanOrEqual(board.height - 56)
})
test('publication rejects direct scores, missing consent and identifying/unsafe aliases', () => {
  const valid = { token: 'a'.repeat(64), alias: 'Pilota_7', consent: true, inputs: [] }
  expect(publishSchema.safeParse(valid).success).toBe(true)
  expect(publishSchema.safeParse({ ...valid, points: 900 }).success).toBe(false)
  expect(publishSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
  for (const alias of ['ab', 'a'.repeat(21), 'mail@example.org', '<script>', 'https://club.es']) expect(publishSchema.safeParse({ ...valid, alias }).success).toBe(false)
  expect(publishSchema.parse({ ...valid, alias: '  Àlex  ' }).alias).toBe('Àlex')
  expect(boardSchema.safeParse({ width: 100, height: 100 }).success).toBe(false)
})
