import { advanceTableBall, aimTableBall, BASELINE_FLIGHT, createTableBall, returnTableBall, type TableBall } from './table-tennis'

export const MATCH_TARGETS = [11, 21] as const
export type MatchTarget = (typeof MATCH_TARGETS)[number]
export const MATCH_END_DEPTH = BASELINE_FLIGHT.endDepth
export const MATCH_DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export type MatchDifficulty = (typeof MATCH_DIFFICULTIES)[number]
export const MATCH_SHOTS = ['flat', 'topspin', 'backspin'] as const
export type MatchShot = (typeof MATCH_SHOTS)[number]

const SERVE_DELAY = 0.9
const AI_REACH = 0.34
const DIFFICULTY_SETTINGS = {
  easy: { pace: 0.75, reactionTime: 0.63, paddleSpeed: 0.9, liftSpeed: 1.6 },
  normal: { pace: 1, reactionTime: 0.46, paddleSpeed: 1.25, liftSpeed: 2.2 },
  hard: { pace: 1.2, reactionTime: 0.29, paddleSpeed: 1.7, liftSpeed: 3 },
}
const SHOT_FLIGHTS = {
  flat: BASELINE_FLIGHT,
  topspin: { ...BASELINE_FLIGHT, speed: 4.05, bounceProgress: 0.63, rebound: { factor: 0.91, maximumSpeed: 4.25 } },
  backspin: { ...BASELINE_FLIGHT, speed: 3.15, rebound: { factor: 0.49, maximumSpeed: 2.2 } },
}

type Side = 'player' | 'opponent'
export type MatchStatus = 'rally' | 'return' | Side
export type TableMatch = {
  difficulty: MatchDifficulty
  target: MatchTarget
  ball: TableBall
  shot: MatchShot
  score: Record<Side, number>
  lastPoint: Side | null
  winner: Side | null
  serveDelay: number
  opponentX: number
  opponentY: number
  reaction: number
  returns: number
  serveAngle: number
}

export function createTableMatch(serveAngle: number, difficulty: MatchDifficulty = 'normal', target: MatchTarget = MATCH_TARGETS[0]): TableMatch {
  return {
    difficulty, target,
    ball: createTableBall(serveAngle, -1, BASELINE_FLIGHT),
    shot: 'flat',
    score: { player: 0, opponent: 0 },
    lastPoint: null, winner: null, serveDelay: 0,
    opponentX: 0, opponentY: 0.42, reaction: 0, returns: 0, serveAngle,
  }
}

export function tableMatchStatus(match: TableMatch): MatchStatus {
  if (match.lastPoint) return match.lastPoint
  return match.ball.vz < 0 && match.ball.z <= 0 ? 'return' : 'rally'
}

export function returnMatchBall(match: TableMatch, offset: number, shot: MatchShot = 'flat') {
  if (tableMatchStatus(match) !== 'return') return false
  returnTableBall(match.ball, offset, SHOT_FLIGHTS[shot])
  match.shot = shot
  match.reaction = DIFFICULTY_SETTINGS[match.difficulty].reactionTime
  return true
}

function awardPoint(match: TableMatch, side: Side) {
  match.score[side]++
  match.lastPoint = side
  match.serveDelay = SERVE_DELAY
  if (match.score[side] >= match.target && Math.abs(match.score.player - match.score.opponent) >= 2) {
    match.winner = side
  }
}

function moveTowards(current: number, target: number, distance: number) {
  return current + Math.max(-distance, Math.min(distance, target - current))
}

export function advanceTableMatch(match: TableMatch, dt: number) {
  if (match.winner) return
  const settings = DIFFICULTY_SETTINGS[match.difficulty]
  if (match.lastPoint) {
    match.serveDelay -= dt
    if (match.serveDelay > 0) return
    const points = match.score.player + match.score.opponent
    const deuce = Math.min(match.score.player, match.score.opponent) >= match.target - 1
    const servingTurn = deuce ? points : Math.floor(points / 2)
    const direction = servingTurn % 2 === 0 ? -1 : 1
    match.ball = createTableBall(match.serveAngle + points * 1.41, direction, BASELINE_FLIGHT)
    match.shot = 'flat'
    match.reaction = direction === 1 ? settings.reactionTime : 0
    match.returns = 0
    match.lastPoint = null
    return
  }

  const ball = match.ball
  const outgoing = ball.vz > 0
  if (outgoing) {
    const flightTimeToArrival = (MATCH_END_DEPTH - ball.z) / ball.vz
    const trackingTime = Math.max(0, Math.min(dt, flightTimeToArrival / settings.pace) - match.reaction)
    match.reaction = Math.max(0, match.reaction - dt)
    const arrivalX = ball.x + ball.vx * flightTimeToArrival
    match.opponentX = moveTowards(match.opponentX, arrivalX, settings.paddleSpeed * trackingTime)
    match.opponentY = moveTowards(match.opponentY, ball.y, settings.liftSpeed * trackingTime)
  } else {
    match.opponentX = moveTowards(match.opponentX, 0, dt * 0.85)
    match.opponentY = moveTowards(match.opponentY, 0.42, dt)
  }

  // Scale simulation time uniformly so difficulty changes pace while preserving the 3D arc.
  const end = advanceTableBall(ball, dt * settings.pace, SHOT_FLIGHTS[match.shot], true)
  if (end === -1) awardPoint(match, 'opponent')
  if (end === 1) {
    const offsetX = (ball.x - match.opponentX) / AI_REACH
    const offsetY = (ball.y - match.opponentY) / 0.4
    if (offsetX * offsetX + offsetY * offsetY > 1) {
      awardPoint(match, 'player')
      return
    }
    match.returns++
    match.shot = 'flat'
    const targetX = 1.03 * Math.sin(match.serveAngle + match.returns * 2.1)
    aimTableBall(ball, -1, targetX, BASELINE_FLIGHT)
  }
}
