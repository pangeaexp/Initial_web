import { getHall } from '@/lib/sun-hall/server'

export const runtime = 'nodejs'
export async function GET() {
  try { return Response.json({ entries: await getHall() }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return Response.json({ error: 'unavailable' }, { status: 503 }) }
}
