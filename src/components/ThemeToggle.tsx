'use client'

import { MoonIcon } from './icons'

/** Flips `<html data-theme>` and persists the choice (design/README.md "Тёмная тема"). */
export default function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark'
    html.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // localStorage unavailable (private mode) — theme just won't persist.
    }
  }

  return (
    <button className="icon-btn" type="button" aria-label="Темна тема" onClick={toggle}>
      <MoonIcon />
      <span className="icon-btn__label" aria-hidden="true">Тема</span>
    </button>
  )
}
