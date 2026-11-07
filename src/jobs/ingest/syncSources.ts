import { getPayloadClient } from '@/lib/payload'
import { loadSourcesConfig } from '@/lib/ingest/sourcesConfig'

/**
 * Upserts config/sources.yaml (the FACT-167 registry) into the `sources`
 * collection. Safe to re-run: existing rows keep their enabled/etag/error
 * state, only the registry-owned fields (name, url, status, interval) sync.
 */
export async function syncSources() {
  const payload = await getPayloadClient()
  const entries = loadSourcesConfig()
  let created = 0
  let updated = 0

  for (const entry of entries) {
    const existing = await payload.find({
      collection: 'sources',
      where: { source_key: { equals: entry.id } },
      limit: 1,
    })

    const data = {
      source_key: entry.id,
      name: entry.name,
      type: entry.type,
      registry_status: entry.status,
      url: entry.url,
      poll_interval: entry.poll_interval,
    }

    if (existing.docs[0]) {
      await payload.update({ collection: 'sources', id: existing.docs[0].id, data })
      updated++
    } else {
      await payload.create({ collection: 'sources', data: { ...data, enabled: entry.status === 'verified' } })
      created++
    }
  }

  return { created, updated, total: entries.length }
}
