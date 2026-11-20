// Shared deterministic simulation: the server replays inputs rather than trusting a score.
import { advanceTableBall, BASELINE_FLIGHT, baselineRallySpeed, createTableBall, paddleHitsBall, projectTableBall, returnTableBall, type TableBall } from '../table-tennis.ts'

export const RULES_VERSION = 4
export const ROUND_MS = 30_000
export const BALL_SIZE = 56
export const MIN_INPUT_GAP = 80
export const MAX_INPUTS = 300
const TICK_MS = 1000 / 60
const HIT_TOLERANCE = 10 // A rendered frame can lag the input by one frame.

export type Board = { width: number; height: number }
export type Challenge = Board & { token: string; seed: number; rulesVersion: typeof RULES_VERSION }
export type GameInput = { t: number; x: number; y: number }
export type Game = Board & {
  tick: number; ball: TableBall
  hits: number; misses: number; points: number; streak: number; bestStreak: number
}
export type HallEntry = { id: string; alias: string; points: number; hits: number; misses: number; best_streak: number; accuracy: number }

export function createGame(board: Board, seed: number): Game {
  const angle = Math.PI / 4 + (seed % 10_000) / 10_000 * Math.PI / 2
  return { width: board.width, height: board.height, tick: 0, ball: createTableBall(angle, -1, BASELINE_FLIGHT),
    hits: 0, misses: 0, points: 0, streak: 0, bestStreak: 0 }
}

export function advanceGame(game: Game, ms: number) {
  const target = Math.floor(Math.min(ms, ROUND_MS) / TICK_MS)
  const speedBonus = Math.min(4, Math.floor(game.hits / 5)) * 0.15
  while (game.tick < target) {
    advanceTableBall(game.ball, baselineRallySpeed(game.ball, speedBonus) / 60, BASELINE_FLIGHT)
    game.tick++
  }
}

export function applyInput(game: Game, input: GameInput) {
  advanceGame(game, input.t)
  const ball = projectTableBall(game.ball, game.width, game.height)
  const hit = paddleHitsBall(input, ball, HIT_TOLERANCE)
  if (hit) {
    returnTableBall(game.ball, (input.x - ball.x) / ball.radius, BASELINE_FLIGHT)
    game.hits++; game.streak++
    game.points += Math.min(3, 1 + Math.floor(game.streak / 5))
    game.bestStreak = Math.max(game.bestStreak, game.streak)
  } else {
    game.misses++; game.streak = 0
  }
  return hit
}

export function replayGame(board: Board, seed: number, inputs: GameInput[]) {
  if (inputs.length > MAX_INPUTS) throw new Error('Invalid inputs')
  const game = createGame(board, seed)
  let previous = -MIN_INPUT_GAP
  for (const input of inputs) {
    if (!Number.isInteger(input.t) || input.t < 0 || input.t >= ROUND_MS || input.t - previous < MIN_INPUT_GAP
      || !Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x < 0 || input.x > board.width || input.y < 0 || input.y > board.height) throw new Error('Invalid inputs')
    applyInput(game, input)
    previous = input.t
  }
  return game
}
