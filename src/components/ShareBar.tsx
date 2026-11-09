'use client'

import { useState } from 'react'

export default function ShareBar() {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — no-op, the URL bar already has the link.
    }
  }

  return (
    <div className="share">
      <button className="btn btn--secondary" type="button" onClick={copyLink}>
        {copied ? 'Посилання скопійовано' : 'Копіювати посилання'}
      </button>
    </div>
  )
}
