import { getPayloadClient } from '@/lib/payload'

/**
 * The `payload migrate` CLI binary hangs indefinitely in this project's
 * Docker runtime image (tsx-based config/tsconfig resolution inside
 * node_modules/payload/bin.js never returns here, even though loading the
 * same config and calling `payload.db.migrate()` directly completes in
 * seconds) — see docs/deploy.md. This script does the same two calls the
 * CLI does, without going through that binary.
 */
async function main() {
  const payload = await getPayloadClient()
  await payload.db.migrate()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
