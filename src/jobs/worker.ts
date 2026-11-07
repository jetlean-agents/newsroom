import PgBoss from 'pg-boss'
import { recomputePopular } from './recomputePopular'

const RECOMPUTE_POPULAR = 'recompute-popular'

async function main() {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'pgboss',
  })

  boss.on('error', (err) => console.error('[pg-boss]', err))
  await boss.start()

  await boss.work(RECOMPUTE_POPULAR, async () => {
    const result = await recomputePopular()
    console.log('[recompute-popular]', result)
  })

  // Every 10 minutes.
  await boss.schedule(RECOMPUTE_POPULAR, '*/10 * * * *')

  console.log('pg-boss worker started, watching:', RECOMPUTE_POPULAR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
