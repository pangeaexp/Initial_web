/// <reference types="jest" />
import { advanceGame, applyInput, createGame, replayGame, RULES_VERSION, type GameInput } from '@/lib/sun-hall/game'
import { boardSchema, publishSchema } from '@/lib/sun-hall/contracts'
import { BALL_RADIUS, paddlePosition, projectTableBall, projectTablePoint, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH, TABLE_HEIGHT } from '@/lib/table-tennis'

const board = { width: 480, height: 300 }
function trace() {
  const game = createGame(board, 1234), inputs: GameInput[] = []
  for (let i = 0; i < 20; i++) {
    const t = 200 + i * 250
    // Rendering can advance at arbitrary refresh rates between contacts.
    advanceGame(game, t - 17); advanceGame(game, t)
    const { x, y } = projectTableBall(game.ball, board.width, board.height)
    const input = { t, x, y }
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
  expect(Math.abs(replayed.ball.x)).toBeLessThan(TABLE_HALF_WIDTH)
})
test('altered coordinates are evaluated as misses instead of accepting the claimed hits', () => {
  const { inputs } = trace()
  inputs[0] = { t: inputs[0].t, x: 0, y: 0 }
  const replayed = replayGame(board, 1234, inputs)
  expect(replayed.misses).toBeGreaterThan(0)
  expect(replayed.points).toBeLessThan(47)
})
test('a successful paddle contact returns the ball toward the opponent', () => {
  const game = createGame(board, 1234)
  advanceGame(game, 200)
  expect(game.ball.vz).toBeLessThan(0)
  const depth = game.ball.z
  const { x, y } = projectTableBall(game.ball, board.width, board.height)
  expect(applyInput(game, { t: 200, x, y })).toBe(true)
  expect(game.ball.vz).toBeGreaterThan(0)
  advanceGame(game, 300)
  expect(game.ball.z).toBeGreaterThan(depth)
})

test.each([0, 20])('a player with %i hits can return from the baseline more than half a second after a bounce', (hits) => {
  const seed = 5000
  const game = createGame(board, seed)
  game.hits = hits
  let bounce = 0
  for (let t = 17; t <= 1300 && bounce === 0; t += 17) {
    const wasFalling = game.ball.vy < 0
    advanceGame(game, t)
    if (wasFalling && game.ball.vy > 0 && game.ball.vz < 0 && game.ball.z < 0) bounce = t
  }
  expect(bounce).toBeGreaterThan(0)
  const t = bounce + 650
  advanceGame(game, t)
  expect(game.ball.z).toBeLessThan(-TABLE_HALF_LENGTH)
  expect(game.ball.vz).toBeLessThan(0)
  const baseline = projectTablePoint([0, TABLE_HEIGHT, -TABLE_HALF_LENGTH], board.width, board.height)
  const { x, y } = paddlePosition(baseline.x, baseline.y, board.width, board.height)
  expect(applyInput(game, { t, x, y })).toBe(true)
  expect(game.ball.vz).toBeGreaterThan(0)
  if (hits === 0) expect(replayGame(board, seed, [{ t, x, y }])).toEqual(game)
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
  expect(game.ball.y).toBeGreaterThanOrEqual(BALL_RADIUS)
  expect(Math.abs(game.ball.z)).toBeLessThan(TABLE_HALF_LENGTH)
})
test('publication rejects direct scores, missing consent and identifying/unsafe aliases', () => {
  const valid = { rulesVersion: RULES_VERSION, token: 'a'.repeat(64), alias: 'Pilota_7', consent: true, inputs: [] }
  expect(publishSchema.safeParse(valid).success).toBe(true)
  expect(publishSchema.safeParse({ ...valid, rulesVersion: 3 }).success).toBe(false)
  expect(publishSchema.safeParse({ ...valid, rulesVersion: undefined }).success).toBe(false)
  expect(publishSchema.safeParse({ ...valid, points: 900 }).success).toBe(false)
  expect(publishSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
  for (const alias of ['ab', 'a'.repeat(21), 'mail@example.org', '<script>', 'https://club.es']) expect(publishSchema.safeParse({ ...valid, alias }).success).toBe(false)
  expect(publishSchema.parse({ ...valid, alias: '  Àlex  ' }).alias).toBe('Àlex')
  expect(boardSchema.safeParse({ width: 100, height: 100 }).success).toBe(false)
})
