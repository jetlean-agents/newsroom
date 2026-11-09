import Image from 'next/image'
import { isKnownRubricSlug } from '@/lib/rubricsConfig'
import type { Media } from '@/payload-types'

/**
 * Article/rubric cover. Real photo (Payload `Media`) → `next/image` (perf AC:
 * next/image everywhere, CLS <= 0.1 via the fixed `.media` aspect-ratio box).
 * No legal photo → rubric SVG fallback (design/README.md "Обкладинки рубрик") —
 * plain `<img>`, these are static vector files, not a next/image candidate.
 */
export default function Cover({
  rubricSlug,
  media,
  className = '',
  priority = false,
  sizes = '(min-width: 1200px) 800px, 100vw',
}: {
  rubricSlug: string
  media?: Media | number | null
  className?: string
  priority?: boolean
  sizes?: string
}) {
  const photo = media && typeof media === 'object' ? media : null

  return (
    <div className={`media ${className}`.trim()} data-r={rubricSlug}>
      {photo?.url ? (
        <Image
          src={photo.url}
          alt={photo.alt || ''}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
        />
      ) : isKnownRubricSlug(rubricSlug) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/covers/${rubricSlug}.svg`}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          width={1200}
          height={675}
        />
      ) : null /* non-canonical rubric (e.g. ingestion's "bez-rubryky" bucket) has no cover SVG — bare .media wash background, no 404 */}
    </div>
  )
}
