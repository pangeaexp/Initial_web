export function returnTableBall(motion: { vx: number; vy: number }, offset = 0) {
  motion.vy = -Math.abs(motion.vy)
  motion.vx = Math.max(-220, Math.min(220, motion.vx + Math.max(-1, Math.min(1, offset)) * 35))
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

export function paddleHitsBall(contact: { x: number; y: number }, ball: { x: number; y: number }, size: number, tolerance = 4) {
  // Rubber ellipse (20.25×21) touching the visible ball (radius 12).
  const dx = (contact.x - ball.x - size / 2) / (20.25 + 12 + tolerance)
  const dy = (contact.y - ball.y - size / 2) / (21 + 12 + tolerance)
  return dx * dx + dy * dy <= 1
}
