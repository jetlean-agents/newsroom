import Link from 'next/link'

/** Numbered pagination (design/prototype.css `.pagination`). `basePath(n)` returns
 * the URL for page `n`; `current`/`total` are 1-indexed. */
export default function Pagination({
  current,
  total,
  basePath,
}: {
  current: number
  total: number
  basePath: (page: number) => string
}) {
  if (total <= 1) return null
  const pages = new Set<number>([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)

  const items: React.ReactNode[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) items.push(<span key={`gap-${p}`}>…</span>)
    items.push(
      p === current ? (
        <span key={p} aria-current="page">
          {p}
        </span>
      ) : (
        <Link key={p} href={basePath(p)}>
          {p}
        </Link>
      ),
    )
    prev = p
  }

  return (
    <nav className="pagination" aria-label="Сторінки">
      {items}
      {current < total ? (
        <Link className="pagination__next" href={basePath(current + 1)}>
          Наступна сторінка
        </Link>
      ) : null}
    </nav>
  )
}
