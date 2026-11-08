'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type QueueItem = {
  id: number
  title: string
  lead: string
  bodyText: string
  rubricTitle: string
  sourceCount: number
  eventDate: string | null
  sources: Array<{ title: string; url: string; publisher: string | null }>
  originalityOverlap: number | null
  originalityBlocked: boolean
  aiAssisted: boolean
  factFlags: Array<{ value: string; kind: string }>
}

type Action = 'published' | 'draft' | 'unpublished'

async function patchStatus(id: number, status: Action): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/articles/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (res.ok) return { ok: true }
  const body = await res.json().catch(() => ({}))
  return { ok: false, error: body?.errors?.[0]?.message || `HTTP ${res.status}` }
}

/**
 * Опублікувати (1) / Повернути автору (2) / Відхилити (3) + ←/→ навігація —
 * мета: <3 хв на матеріал (FACT-236 AC item 5).
 */
export default function ReviewQueueClient({ initialQueue }: { initialQueue: QueueItem[] }) {
  const [queue, setQueue] = useState(initialQueue)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const current = queue[index]

  const advance = useCallback(() => {
    setQueue((q) => q.filter((_, i) => i !== index))
    setIndex((i) => Math.min(i, Math.max(0, queue.length - 2)))
  }, [index, queue.length])

  const act = useCallback(
    async (status: Action, label: string) => {
      if (!current || busy) return
      setBusy(true)
      setMessage(null)
      const result = await patchStatus(current.id, status)
      setBusy(false)
      if (result.ok) {
        setMessage(`✓ ${label}: «${current.title}»`)
        advance()
      } else {
        setMessage(`✗ Помилка: ${result.error}`)
      }
    },
    [current, busy, advance],
  )

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(0, queue.length - 1))), [queue.length])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') act('published', 'Опубліковано')
      else if (e.key === '2') act('draft', 'Повернуто автору')
      else if (e.key === '3') act('unpublished', 'Відхилено')
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, next, prev])

  const overlapPct = useMemo(
    () => (current?.originalityOverlap != null ? Math.round(current.originalityOverlap * 100) : null),
    [current],
  )

  if (!current) {
    return (
      <div className="review-queue">
        <h1>Черга рев&apos;ю</h1>
        <p>{message ?? 'Черга порожня — усі матеріали перевірено.'}</p>
      </div>
    )
  }

  return (
    <div className="review-queue">
      <h1>Черга рев&apos;ю ({queue.length})</h1>
      {message && <p className="review-queue-message">{message}</p>}

      <div className="review-queue-grid">
        <section className="review-queue-draft">
          <h2>{current.title}</h2>
          <p className="review-queue-meta">
            {current.rubricTitle} · {current.sourceCount} джерел
            {current.aiAssisted ? ' · AI-чернетка' : ''}
          </p>
          <p><strong>{current.lead}</strong></p>
          <pre className="review-queue-body">{current.bodyText}</pre>

          {overlapPct !== null && (
            <p className={current.originalityBlocked ? 'review-queue-overlap-blocked' : 'review-queue-overlap'}>
              Збіг з джерелом: {overlapPct}%
              {current.originalityBlocked ? ' — ЗАБЛОКОВАНО для публікації, потрібен переписаний текст' : ''}
            </p>
          )}

          {current.factFlags.length > 0 && (
            <div className="review-queue-flags">
              <strong>Перевірити:</strong>
              <ul>
                {current.factFlags.map((f, i) => (
                  <li key={i}>
                    {f.value} <em>({f.kind})</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="review-queue-sources">
          <h3>Джерела</h3>
          <ul>
            {current.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
                {s.publisher ? ` — ${s.publisher}` : ''}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="review-queue-actions">
        <button disabled={busy || current.originalityBlocked} onClick={() => act('published', 'Опубліковано')}>
          Опублікувати (1)
        </button>
        <button disabled={busy} onClick={() => act('draft', 'Повернуто автору')}>
          Повернути (2)
        </button>
        <button disabled={busy} onClick={() => act('unpublished', 'Відхилено')}>
          Відхилити (3)
        </button>
        <span className="review-queue-nav">
          <button disabled={index === 0} onClick={prev}>← Попередній</button>
          <button disabled={index >= queue.length - 1} onClick={next}>Наступний →</button>
        </span>
      </div>
    </div>
  )
}
