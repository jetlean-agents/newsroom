import Link from 'next/link'
import { rubricPath } from '@/lib/urls'

export default function RubricLabel({
  slug,
  title,
  href = true,
}: {
  slug: string
  title: string
  href?: boolean
}) {
  if (!href) {
    return (
      <span className="rlabel" data-r={slug}>
        {title}
      </span>
    )
  }
  return (
    <Link className="rlabel" data-r={slug} href={rubricPath(slug)}>
      {title}
    </Link>
  )
}
