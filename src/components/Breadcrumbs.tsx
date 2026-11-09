import Link from 'next/link'
import { breadcrumbListJsonLd, type Breadcrumb } from '@/lib/jsonld'

/** Head: "Головна → Рубрика → Стаття" (structure.md). Last item isn't a link. */
export default function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbListJsonLd(items)) }}
      />
      <ol className="breadcrumbs" aria-label="Хлібні крихти">
        {items.map((item, i) => (
          <li key={item.url}>
            {i === items.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link href={new URL(item.url).pathname}>{item.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
