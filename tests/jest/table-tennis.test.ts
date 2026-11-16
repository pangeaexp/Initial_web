/// <reference types="jest" />
import { paddleHitsBall, paddlePosition } from '@/lib/table-tennis'

test('the centre of the rubber face tracks the pointer and remains inside the board at edges', () => {
  expect(paddlePosition(240, 150, 480, 300)).toMatchObject({ x: 240, y: 150 })
  expect(paddlePosition(0, 0, 480, 300)).toMatchObject({ x: 24, y: 22.75 })
  const edge = paddlePosition(480, 300, 480, 300)
  expect(edge.x).toBeLessThan(480)
  expect(edge.y).toBeLessThan(300)
})

test('the rubber face can hit while its centre is outside the ball button, but distant shots miss', () => {
  const ball = { x: 78, y: 78 } // Visible ball and its button are centred on (100,100).
  expect(paddleHitsBall({ x: 130, y: 100 }, ball, 44)).toBe(true)
  expect(paddleHitsBall({ x: 150, y: 100 }, ball, 44)).toBe(false)
  expect(paddleHitsBall({ x: 130, y: 130 }, ball, 44)).toBe(false)
})
