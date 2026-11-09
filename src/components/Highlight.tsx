import { Fragment } from 'react'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Wraps case-insensitive matches of any `q` word in `<mark>` — safe (no
 * dangerouslySetInnerHTML), used for search result highlighting. */
export default function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2).map(escapeRegex)
  if (!words.length) return <>{text}</>

  const re = new RegExp(`(${words.join('|')})`, 'gi')
  const parts = text.split(re)

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}
