// Shared deterministic simulation: the server replays inputs rather than trusting a score.
export const ROUND_MS = 30_000
export const BALL_SIZE = 56
export const MIN_INPUT_GAP = 80
export const MAX_INPUTS = 300
const TICK_MS = 1000 / 60
const HIT_TOLERANCE = 10 // A rendered frame can lag the input by one frame.

export type Board = { width: number; height: number }
export type Challenge = Board & { token: string; seed: number }
export type GameInput = { t: number; x: number; y: number }
export type Game = Board & {
  tick: number; x: number; y: number; vx: number; vy: number
  hits: number; misses: number; points: number; streak: number; bestStreak: number
}
export type HallEntry = { id: string; alias: string; points: number; hits: number; misses: number; best_streak: number; accuracy: number }

export function createGame(board: Board, seed: number): Game {
  const angle = Math.PI / 4 + (seed % 10_000) / 10_000 * Math.PI / 2
  return { width: board.width, height: board.height, tick: 0, x: (board.width - BALL_SIZE) / 2, y: (board.height - BALL_SIZE) / 2,
    vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220, hits: 0, misses: 0, points: 0, streak: 0, bestStreak: 0 }
}

export function advanceGame(game: Game, ms: number) {
  const target = Math.floor(Math.min(ms, ROUND_MS) / TICK_MS)
  while (game.tick < target) {
    const speed = 1 + Math.min(4, Math.floor(game.hits / 5)) * 0.15
    game.x += game.vx * speed / 60
    game.y += game.vy * speed / 60
    if (game.x < 0 || game.x > game.width - BALL_SIZE) {
      game.x = Math.max(0, Math.min(game.x, game.width - BALL_SIZE)); game.vx *= -1
    }
    if (game.y < 0 || game.y > game.height - BALL_SIZE) {
      game.y = Math.max(0, Math.min(game.y, game.height - BALL_SIZE)); game.vy *= -1
    }
    game.tick++
  }
}

export function applyInput(game: Game, input: GameInput) {
  advanceGame(game, input.t)
  const hit = input.x >= game.x - HIT_TOLERANCE && input.x <= game.x + BALL_SIZE + HIT_TOLERANCE
    && input.y >= game.y - HIT_TOLERANCE && input.y <= game.y + BALL_SIZE + HIT_TOLERANCE
  if (hit) {
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
