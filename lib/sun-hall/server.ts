import 'server-only'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdminConfig } from '@/lib/supabase/env'
import { replayGame, RULES_VERSION, type Board, type GameInput, type HallEntry } from './game'

function client() {
  const { url, serviceRoleKey } = requireSupabaseAdminConfig()
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } })
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export class HallError extends Error {
  constructor(public code: 'expired' | 'invalid' | 'limited', public status: number) { super(code) }
}

export async function getHall(): Promise<HallEntry[]> {
  const { data, error } = await client().from('sun_game_scores').select('id,alias,points,hits,misses,best_streak,accuracy')
    .order('points', { ascending: false }).order('accuracy', { ascending: false }).order('best_streak', { ascending: false })
    .order('created_at').order('id').limit(10)
  if (error) throw error
  return data ?? []
}

export async function issueChallenge(board: Board, request: Request) {
  const token = randomBytes(32).toString('hex')
  const seed = randomInt(0, 2_147_483_647)
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { error } = await client().rpc('create_sun_game_run', {
    p_token_hash: hash(token), p_seed: seed, p_width: board.width, p_height: board.height, p_client_hash: hash(ip),
  })
  if (error?.message.includes('rate_limited')) throw new HallError('limited', 429)
  if (error) throw error
  return { ...board, token, seed, rulesVersion: RULES_VERSION }
}

export async function publishScore(token: string, alias: string, inputs: GameInput[]) {
  const db = client()
  const tokenHash = hash(token)
  const { data: run, error } = await db.from('sun_game_runs').select('id,seed,width,height,created_at,expires_at,used_at').eq('token_hash', tokenHash).maybeSingle()
  if (error) throw error
  if (!run) throw new HallError('expired', 410)
  if (run.used_at) {
    const { data: saved, error: savedError } = await db.from('sun_game_scores').select('id').eq('run_id', run.id).single()
    if (savedError) throw savedError
    return { id: String(saved.id), entries: await getHall() }
  }
  if (Date.now() >= Date.parse(run.expires_at)) throw new HallError('expired', 410)
  if (Date.now() - Date.parse(run.created_at) < 30_000) throw new HallError('invalid', 422)
  let game
  try { game = replayGame({ width: run.width, height: run.height }, run.seed, inputs) } catch { throw new HallError('invalid', 422) }
  const { data, error: publishError } = await db.rpc('publish_sun_game_score', {
    p_token_hash: tokenHash, p_alias: alias, p_points: game.points, p_hits: game.hits, p_misses: game.misses, p_best_streak: game.bestStreak,
  })
  if (publishError?.message.includes('run_unavailable')) throw new HallError('expired', 410)
  if (publishError) throw publishError
  return { id: String(data), entries: await getHall() }
}
