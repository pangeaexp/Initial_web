import { publishSchema } from '@/lib/sun-hall/contracts'
import { publishScore } from '@/lib/sun-hall/server'
import { hallResponseError, sameOrigin } from '@/lib/sun-hall/http'
import { readJsonLimited } from '@/lib/read-json-limited'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'origin' }, { status: 403 })
  try {
    const data = publishSchema.parse(await readJsonLimited(request, 25_000))
    return Response.json(await publishScore(data.token, data.alias, data.inputs), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return hallResponseError(error) }
}
