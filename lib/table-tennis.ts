export const TABLE_HALF_WIDTH = 1.53
export const TABLE_HALF_LENGTH = 2.75
export const TABLE_HEIGHT = 1.08
export const BALL_RADIUS = 0.11

export type TableBall = { x: number; y: number; z: number; vx: number; vy: number; vz: number }
type Rebound = { factor: number; maximumSpeed: number }
type Flight = { endDepth: number; playerEndDepth?: number; speed: number; bounceProgress: number; rebound?: Rebound }
type Point3 = readonly [x: number, y: number, z: number]

const DEFAULT_FLIGHT: Flight = { endDepth: TABLE_HALF_LENGTH - 0.34, speed: 4.65, bounceProgress: 0.78 }
export const BASELINE_FLIGHT = {
  endDepth: TABLE_HALF_LENGTH - 0.1,
  playerEndDepth: TABLE_HALF_LENGTH + 0.73,
  speed: 3.6,
  bounceProgress: 0.65,
} satisfies Flight
const GRAVITY = 8.8
const DEFAULT_REBOUND: Rebound = { factor: 0.73, maximumSpeed: 3.5 }
const CAMERA_SIN = Math.sin(0.38)
const CAMERA_COS = Math.cos(0.38)

export function projectTablePoint([x, y, z]: Point3, width: number, height: number) {
  const elevation = y - 3.75
  const distance = z + 6
  const depth = distance * CAMERA_COS - elevation * CAMERA_SIN
  const scale = Math.min(height * 1.04, width * 1.16) / depth
  return {
    x: width / 2 + x * scale,
    y: height * 0.44 - (elevation * CAMERA_COS + distance * CAMERA_SIN) * scale,
    scale,
  }
}

export function projectTableBall(ball: TableBall, width: number, height: number) {
  const centre = projectTablePoint([ball.x, TABLE_HEIGHT + ball.y, ball.z], width, height)
  return { x: centre.x, y: centre.y, radius: Math.max(6, BALL_RADIUS * centre.scale) }
}

export function baselineRallySpeed(ball: TableBall, speedBonus: number) {
  // Ease out the speed bonus before the ball reaches the player's half.
  const bonusFactor = ball.vz < 0 ? Math.max(0, Math.min(1, ball.z)) : 1
  return 1 + speedBonus * bonusFactor
}

export function aimTableBall(ball: TableBall, direction: -1 | 1, targetX: number, flight: Flight = DEFAULT_FLIGHT) {
  const crossing = Math.max(0, (direction * flight.endDepth - ball.z) * direction) / flight.speed
  // Aim for one bounce before the far end of the shot.
  const timeToBounce = Math.max(0.14, crossing * flight.bounceProgress)
  ball.vx = (targetX - ball.x) / Math.max(0.14, crossing)
  ball.vy = (BALL_RADIUS - ball.y + GRAVITY * timeToBounce * timeToBounce / 2) / timeToBounce
  ball.vz = direction * flight.speed
}

export function createTableBall(serveAngle: number, direction: -1 | 1 = -1, flight: Flight = DEFAULT_FLIGHT): TableBall {
  const ball = { x: 0, y: 0.47, z: -direction * flight.endDepth, vx: 0, vy: 0, vz: 0 }
  aimTableBall(ball, direction, 0.9 * Math.cos(serveAngle), flight)
  return ball
}

function advanceFlight(ball: TableBall, dt: number, rebound: Rebound) {
  if (dt <= 0) return
  ball.x += ball.vx * dt
  ball.z += ball.vz * dt
  const nextY = ball.y + ball.vy * dt - GRAVITY * dt * dt / 2
  if (nextY <= BALL_RADIUS && ball.y >= BALL_RADIUS) {
    // Find the point of impact to distinguish the tabletop from the space beyond its edge.
    const impactSpeed = Math.sqrt(ball.vy * ball.vy + 2 * GRAVITY * (ball.y - BALL_RADIUS))
    const impactTime = (ball.vy + impactSpeed) / GRAVITY
    const remaining = Math.max(0, dt - impactTime)
    const impactDepth = ball.z - ball.vz * remaining
    if (Math.abs(impactDepth) <= TABLE_HALF_LENGTH) {
      const reboundSpeed = Math.max(0.8, Math.min(rebound.maximumSpeed, impactSpeed * rebound.factor))
      ball.y = BALL_RADIUS + reboundSpeed * remaining - GRAVITY * remaining * remaining / 2
      ball.vy = reboundSpeed - GRAVITY * remaining
      return
    }
  }
  ball.y = nextY
  ball.vy -= GRAVITY * dt
}

export function advanceTableBall(ball: TableBall, dt: number, flight: Flight = DEFAULT_FLIGHT, stopAtEnd = false) {
  const direction = ball.vz < 0 ? -1 : 1
  const endDepth = direction === -1 ? flight.playerEndDepth ?? flight.endDepth : flight.endDepth
  const end = direction * endDepth
  const timeToEnd = Math.max(0, (end - ball.z) / ball.vz)
  const rebound = flight.rebound ?? DEFAULT_REBOUND
  if (dt < timeToEnd) {
    advanceFlight(ball, dt, rebound)
    return
  }

  advanceFlight(ball, timeToEnd, rebound)
  ball.z = end
  if (stopAtEnd) return direction
  aimTableBall(ball, direction === 1 ? -1 : 1, -ball.x * 0.72, flight)
  advanceFlight(ball, dt - timeToEnd, rebound)
}

export function returnTableBall(ball: TableBall, offset = 0, flight: Flight = DEFAULT_FLIGHT) {
  const targetX = Math.max(-1.14, Math.min(1.14, ball.x + Math.max(-1, Math.min(1, offset)) * 0.9))
  aimTableBall(ball, 1, targetX, flight)
}

// SVG 64×82 rendered at 48×62: rubber face centre, including vertical letterboxing.
const FACE_Y = 22.75
export function paddlePosition(x: number, y: number, width: number, height: number) {
  const left = Math.max(0, Math.min(x - 24, width - 48))
  const top = Math.max(0, Math.min(y - FACE_Y, height - 62))
  return { x: left + 24, y: top + FACE_Y, transform: `translate3d(${left}px, ${top}px, 0)` }
}

export function paddleTransform(x: number, y: number, width: number, height: number) {
  return paddlePosition(x, y, width, height).transform
}

export function paddleHitsBall(contact: { x: number; y: number }, ball: { x: number; y: number; radius: number }, tolerance = 4) {
  // Rubber ellipse (20.25×21) touching the projected ball.
  const dx = (contact.x - ball.x) / (20.25 + ball.radius + tolerance)
  const dy = (contact.y - ball.y) / (21 + ball.radius + tolerance)
  return dx * dx + dy * dy <= 1
}
