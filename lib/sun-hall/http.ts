import { ZodError } from 'zod'
import { HallError } from './server'

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}
export function hallResponseError(error: unknown) {
  if (error instanceof HallError) return Response.json({ error: error.code }, { status: error.status })
  if (error instanceof RangeError) return Response.json({ error: 'too_large' }, { status: 413 })
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: 'invalid' }, { status: 400 })
  return Response.json({ error: 'unavailable' }, { status: 503 })
}
