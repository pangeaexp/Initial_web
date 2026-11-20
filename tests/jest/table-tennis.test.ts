/// <reference types="jest" />
import { advanceTableBall, BALL_RADIUS, BASELINE_FLIGHT, createTableBall, paddleHitsBall, paddlePosition, projectTableBall, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '@/lib/table-tennis'

test('the centre of the rubber face tracks the pointer and remains inside the board at edges', () => {
  expect(paddlePosition(240, 150, 480, 300)).toMatchObject({ x: 240, y: 150 })
  expect(paddlePosition(0, 0, 480, 300)).toMatchObject({ x: 24, y: 22.75 })
  const edge = paddlePosition(480, 300, 480, 300)
  expect(edge.x).toBeLessThan(480)
  expect(edge.y).toBeLessThan(300)
})

test('the rubber face can hit while its centre is outside the ball button, but distant shots miss', () => {
  const ball = { x: 100, y: 100, radius: 12 }
  expect(paddleHitsBall({ x: 130, y: 100 }, ball)).toBe(true)
  expect(paddleHitsBall({ x: 150, y: 100 }, ball)).toBe(false)
  expect(paddleHitsBall({ x: 130, y: 130 }, ball)).toBe(false)
})

test('the ball falls and rebounds on both halves of the table without penetrating it', () => {
  const ball = createTableBall(0.9)
  const bounces = new Set<number>()
  for (let frame = 0; frame < 300; frame++) {
    const wasFalling = ball.vy < 0
    const direction = Math.sign(ball.vz)
    advanceTableBall(ball, 1 / 120)
    expect(ball.y).toBeGreaterThanOrEqual(BALL_RADIUS)
    expect(Math.abs(ball.x)).toBeLessThan(TABLE_HALF_WIDTH)
    expect(Math.abs(ball.z)).toBeLessThan(TABLE_HALF_LENGTH)
    if (wasFalling && ball.vy > 0 && Math.sign(ball.vz) === direction) {
      expect(ball.y).toBeLessThan(BALL_RADIUS + 0.05)
      bounces.add(Math.sign(ball.z))
    }
  }
  expect(bounces).toEqual(new Set([-1, 1]))
  const near = projectTableBall({ ...ball, z: -2 }, 800, 500)
  const far = projectTableBall({ ...ball, z: 2 }, 800, 500)
  expect(near.radius).toBeGreaterThan(far.radius)
})

test('a ball past the table edge keeps falling instead of bouncing in mid-air', () => {
  const ball = { x: 0, y: BALL_RADIUS + 0.01, z: -TABLE_HALF_LENGTH - 0.1, vx: 0, vy: -1, vz: -1 }
  advanceTableBall(ball, 0.05, BASELINE_FLIGHT, true)
  expect(ball.y).toBeLessThan(BALL_RADIUS)
  expect(ball.vy).toBeLessThan(-1)
})
