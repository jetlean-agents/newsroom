import { getPayload } from 'payload'
import config from '@/payload.config'

let cached: ReturnType<typeof getPayload> | null = null

export function getPayloadClient() {
  if (!cached) cached = getPayload({ config })
  return cached
}
