import { z } from 'zod'
import { RULES_VERSION } from './game'

export const boardSchema = z.object({
  width: z.number().int().min(240).max(960),
  height: z.number().int().min(160).max(600),
}).strict()
export const publishSchema = z.object({
  rulesVersion: z.literal(RULES_VERSION),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  alias: z.string().trim().transform((value) => value.normalize('NFC')).pipe(z.string().min(3).max(20).regex(/^[\p{L}\p{N} _-]+$/u)),
  consent: z.literal(true),
  inputs: z.array(z.object({ t: z.number().int().min(0).max(29_999), x: z.number().finite(), y: z.number().finite() }).strict()).max(300),
}).strict()
