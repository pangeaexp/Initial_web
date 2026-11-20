/// <reference types="jest" />
import { advanceTableMatch, createTableMatch, MATCH_DIFFICULTIES, MATCH_SHOTS, MATCH_TARGETS, returnMatchBall, tableMatchStatus, type TableMatch } from '@/lib/table-tennis-match'
import { paddleHitsBall, paddlePosition, projectTableBall, projectTablePoint, TABLE_HALF_LENGTH, TABLE_HEIGHT } from '@/lib/table-tennis'

function playFor(match: TableMatch, seconds: number) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) advanceTableMatch(match, 1 / 60)
}

test('easy extends the post-bounce return window and hard shortens it', () => {
  const windows = MATCH_DIFFICULTIES.map((difficulty) => {
    const match = createTableMatch(Math.PI / 2, difficulty)
    let bounceFrame = 0
    for (let frame = 1; frame <= 360; frame++) {
      const wasFalling = match.ball.vy < 0
      advanceTableMatch(match, 1 / 120)
      if (!bounceFrame && wasFalling && match.ball.vy > 0) bounceFrame = frame
      if (match.lastPoint) {
        expect(bounceFrame).toBeGreaterThan(0)
        return (frame - bounceFrame) / 120
      }
    }
    throw new Error('The serve never reached the end of the court')
  })
  const [easy, normal, hard] = windows
  expect(easy).toBeGreaterThan(normal * 1.28)
  expect(normal).toBeGreaterThan(hard)
})

test('a missed return gives the AI one point and starts a fresh serve after the break', () => {
  const match = createTableMatch(Math.PI / 4)
  expect(returnMatchBall(match, 0)).toBe(false)
  playFor(match, 1.8)
  expect(match.score).toEqual({ player: 0, opponent: 1 })
  expect(tableMatchStatus(match)).toBe('opponent')
  expect(returnMatchBall(match, 0)).toBe(false)
  playFor(match, 0.5)
  expect(match.score.opponent).toBe(1)
  playFor(match, 0.5)
  expect(match.lastPoint).toBeNull()
  expect(match.ball.vz).toBeLessThan(0)
})

test('the AI moves and returns a reachable shot, but a wide shot can beat it', () => {
  const reachable = createTableMatch(Math.PI / 4)
  playFor(reachable, 0.97)
  expect(returnMatchBall(reachable, 0)).toBe(true)
  expect(returnMatchBall(reachable, 0)).toBe(false)
  playFor(reachable, 1.05)
  expect(reachable.opponentX).toBeGreaterThan(0.3)
  expect(reachable.ball.vz).toBeLessThan(0)
  expect(reachable.score).toEqual({ player: 0, opponent: 0 })

  const wide = createTableMatch(Math.PI / 4)
  playFor(wide, 0.9)
  expect(returnMatchBall(wide, 1)).toBe(true)
  playFor(wide, 0.95)
  expect(wide.score).toEqual({ player: 1, opponent: 0 })
  expect(tableMatchStatus(wide)).toBe('player')
})

test('topspin goes faster and rebounds higher, while backspin stays slower and lower', () => {
  const shots = MATCH_SHOTS.map((shot) => {
    const match = createTableMatch(Math.PI / 2)
    playFor(match, 1.6)
    expect(returnMatchBall(match, 0, shot)).toBe(true)
    const speed = match.ball.vz
    for (let frame = 0; frame < 220; frame++) {
      const descending = match.ball.vy < 0
      advanceTableMatch(match, 1 / 120)
      if (descending && match.ball.vy > 0 && match.ball.vz > 0) {
        expect(match.ball.z).toBeGreaterThan(0)
        return { speed, rebound: match.ball.vy }
      }
    }
    throw new Error(`The ${shot} shot never bounced on the opponent's half`)
  })
  const [flat, topspin, backspin] = shots
  expect(topspin.speed).toBeGreaterThan(flat.speed)
  expect(topspin.rebound).toBeGreaterThan(flat.rebound)
  expect(backspin.speed).toBeLessThan(flat.speed)
  expect(backspin.rebound).toBeLessThan(flat.rebound)
})

test.each([{ width: 1160, height: 640 }, { width: 356, height: 500 }])('a paddle at the baseline can return after the ball clears the tabletop on a $width px court', ({ width, height }) => {
  const match = createTableMatch(Math.PI / 2)
  const baseline = projectTablePoint([0, TABLE_HEIGHT, -TABLE_HALF_LENGTH], width, height)
  const paddle = paddlePosition(baseline.x, baseline.y, width, height)
  let bounced = false
  for (let frame = 0; frame < 72 && !bounced; frame++) {
    const wasFalling = match.ball.vy < 0
    advanceTableMatch(match, 1 / 60)
    bounced = wasFalling && match.ball.vy > 0 && match.ball.z < 0
  }
  expect(bounced).toBe(true)
  playFor(match, 0.65)
  expect(match.ball.z).toBeLessThan(-TABLE_HALF_LENGTH)
  expect(tableMatchStatus(match)).toBe('return')
  expect(paddleHitsBall(paddle, projectTableBall(match.ball, width, height), 10)).toBe(true)
  expect(returnMatchBall(match, 0)).toBe(true)
  expect(match.ball.vz).toBeGreaterThan(0)
  expect(match.score).toEqual({ player: 0, opponent: 0 })
})

test.each(MATCH_TARGETS)('a game to %i points continues at deuce until a two-point lead', (target) => {
  const match = createTableMatch(Math.PI / 2, 'normal', target)
  match.score = { player: target - 1, opponent: target - 1 }
  playFor(match, 1.8)
  expect(match.score.opponent).toBe(target)
  expect(match.winner).toBeNull()
  playFor(match, 4.3)
  expect(match.score.opponent).toBe(target + 1)
  expect(match.winner).toBe('opponent')
  playFor(match, 3)
  expect(match.score).toEqual({ player: target - 1, opponent: target + 1 })
})
