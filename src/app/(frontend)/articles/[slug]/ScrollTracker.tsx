'use client'

import { useEffect, useRef } from 'react'

const THRESHOLDS = [25, 50, 75, 100] as const

export default function ScrollTracker({
  articleId,
  nextArticleSlug,
}: {
  articleId: string
  nextArticleSlug?: string
}) {
  const fired = useRef(new Set<number>())

  useEffect(() => {
    function send(kind: string) {
      fetch('/api/analytics/scroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ articleId, kind }),
      }).catch(() => {})
    }

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight
      const total = document.documentElement.scrollHeight
      const pct = total > 0 ? (scrolled / total) * 100 : 0
      for (const t of THRESHOLDS) {
        if (pct >= t && !fired.current.has(t)) {
          fired.current.add(t)
          send(`scroll_${t}`)
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [articleId])

  useEffect(() => {
    if (!nextArticleSlug) return
    const link = document.getElementById('next-article-link')
    if (!link) return
    const onClick = () => {
      fetch('/api/analytics/scroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ articleId, kind: 'next_article_click' }),
      }).catch(() => {})
    }
    link.addEventListener('click', onClick)
    return () => link.removeEventListener('click', onClick)
  }, [articleId, nextArticleSlug])

  return null
}
