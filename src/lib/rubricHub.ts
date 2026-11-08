import { getPayloadClient } from '@/lib/payload'

/** Shared between the hub page and its pagination route — a `page.tsx` can only export
 * the Next.js page contract (default/generateMetadata/...), so this can't live there. */
export const PAGE_SIZE = 20

export async function getRubric(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'rubrics', where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0] || null
}
