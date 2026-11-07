// Payload's postgres adapter only runs its schema "push" outside NODE_ENV=production,
// so this is a dedicated one-off step (run before seed/start) rather than relying on
// push happening implicitly during `next build`/`next start`.
Object.assign(process.env, { NODE_ENV: 'development' })

import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  await getPayload({ config })
  console.log('Schema push complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
