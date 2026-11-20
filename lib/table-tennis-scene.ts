import { projectTablePoint as project, TABLE_HALF_WIDTH as HALF_WIDTH, TABLE_HALF_LENGTH as HALF_LENGTH, TABLE_HEIGHT } from './table-tennis'

type Point3 = Parameters<typeof project>[0]

export function opponentPaddleTransform(x: number, width: number, height: number, elevation = 0.42, depth = HALF_LENGTH + 0.26) {
  const paddle = project([x, TABLE_HEIGHT + elevation, depth], width, height)
  return `translate3d(${paddle.x - 24}px, ${paddle.y - 25}px, 0) scale(0.68)`
}

export function drawTableTennisScene(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const polygon = (points: readonly Point3[], color: string | CanvasGradient) => {
    ctx.beginPath()
    points.forEach((point, index) => {
      const { x, y } = project(point, width, height)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  const line = (from: Point3, to: Point3, color: string, thickness: number) => {
    const start = project(from, width, height)
    const end = project(to, width, height)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = color
    ctx.lineWidth = thickness
    ctx.stroke()
  }
  const plane = (left: number, right: number, y: number, near: number, far: number): Point3[] =>
    [[left, y, near], [right, y, near], [right, y, far], [left, y, far]]

  const horizon = project([0, 0, 7.8], width, height).y
  const room = ctx.createLinearGradient(0, 0, 0, height)
  room.addColorStop(0, '#121b25')
  room.addColorStop(0.48, '#273b43')
  room.addColorStop(1, '#1d282e')
  ctx.fillStyle = room
  ctx.fillRect(0, 0, width, height)
  const floor = ctx.createLinearGradient(0, horizon, 0, height)
  floor.addColorStop(0, '#433238')
  floor.addColorStop(1, '#69454b')
  ctx.fillStyle = floor
  ctx.fillRect(0, horizon, width, height - horizon)
  for (const side of [-1, 1]) {
    const x = side * 6.2
    polygon([[x, 0, -4.1], [x, 0, 7.8], [x, 3.1, 7.8], [x, 3.1, -4.1]], '#23323c')
    polygon([[x, 0, -4.1], [x, 0, 7.8], [x, 0.75, 7.8], [x, 0.75, -4.1]], '#512430')
    line([x, 0.75, -4.1], [x, 0.75, 7.8], '#a54c5b', 1)
    line([side * 3.1, 0, -4.1], [side * 3.1, 0, 7.8], '#d9b7af42', 1)
  }
  polygon([[-6.2, 0, 7.8], [6.2, 0, 7.8], [6.2, 0.75, 7.8], [-6.2, 0.75, 7.8]], '#6d303d')
  line([-6.2, 0.75, 7.8], [6.2, 0.75, 7.8], '#ba6570', 1)
  const sign = project([0, 1.72, 7.8], width, height)
  ctx.fillStyle = '#f5ded0ad'
  ctx.font = `700 ${Math.max(9, Math.min(17, width * 0.028))}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('CE JOVENTUT TT', sign.x, sign.y)

  polygon(plane(-1.63, 1.87, 0, -2.95, 2.72), '#22171d75')
  for (const z of [2.08, -2.08]) {
    line([-1.1, 0.34, z], [1.1, 0.34, z], '#1b242c', 4)
    for (const x of [-1.1, 1.1]) {
      polygon([[x - 0.07, 0, z], [x + 0.07, 0, z], [x + 0.07, TABLE_HEIGHT, z], [x - 0.07, TABLE_HEIGHT, z]], '#202a32')
      polygon([[x + 0.07, 0, z], [x + 0.07, 0, z + 0.14], [x + 0.07, TABLE_HEIGHT, z + 0.14], [x + 0.07, TABLE_HEIGHT, z]], '#101a22')
    }
  }

  const near = -HALF_LENGTH
  const far = HALF_LENGTH
  const left = -HALF_WIDTH
  const right = HALF_WIDTH
  const top = TABLE_HEIGHT
  polygon([[left, top, near], [right, top, near], [right, top - 0.13, near], [left, top - 0.13, near]], '#123632')
  line([left, top - 0.13, near], [right, top - 0.13, near], '#438277', 1)
  const surface = ctx.createLinearGradient(0, project([0, top, far], width, height).y, 0, project([0, top, near], width, height).y)
  surface.addColorStop(0, '#22554f')
  surface.addColorStop(1, '#298176')
  polygon(plane(left, right, top, near, far), surface)
  for (const x of [left + 0.035, right - 0.035]) line([x, top, near + 0.035], [x, top, far - 0.035], '#f4f1df', 2)
  for (const z of [near + 0.035, far - 0.035]) line([left + 0.035, top, z], [right - 0.035, top, z], '#f4f1df', 2)
  line([0, top, near + 0.035], [0, top, far - 0.035], '#f4f1dfa6', 1)
  polygon(plane(left, right, top, -0.08, 0.09), '#12282376')

  const netEnd = right + 0.1
  const netTop = top + 0.28
  polygon([[-netEnd, top, 0], [netEnd, top, 0], [netEnd, netTop, 0], [-netEnd, netTop, 0]], '#162b36b8')
  for (let i = 1; i < 28; i++) {
    const x = -netEnd + 2 * netEnd * i / 28
    line([x, top, 0], [x, netTop, 0], '#d5efea46', 0.8)
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    const y = top + (netTop - top) * fraction
    line([-netEnd, y, 0], [netEnd, y, 0], '#d5efea46', 0.8)
  }
  for (const x of [-netEnd, netEnd]) line([x, top - 0.035, 0], [x, netTop + 0.015, 0], '#172530', 4)
  line([-netEnd, netTop, 0], [netEnd, netTop, 0], '#f2ebdd', 2)
}
