import { boardSchema } from '@/lib/sun-hall/contracts'
import { issueChallenge } from '@/lib/sun-hall/server'
import { hallResponseError, sameOrigin } from '@/lib/sun-hall/http'
import { readJsonLimited } from '@/lib/read-json-limited'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'origin' }, { status: 403 })
  try {
    const board = boardSchema.parse(await readJsonLimited(request, 1000))
    return Response.json(await issueChallenge(board, request), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return hallResponseError(error) }
}
