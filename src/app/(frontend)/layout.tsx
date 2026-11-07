import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_NAME, robotsMeta } from '@/lib/env'
import './globals.css'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  robots: robotsMeta(),
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <header className="site-header">
          <Link href="/" className="logo">{SITE_NAME}</Link>
          <nav>
            <Link href="/search">Пошук</Link>
            <Link href="/corrections">Виправлення</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>Демонстраційний sandbox-ресурс. Не є джерелом реальних новин.</p>
        </footer>
      </body>
    </html>
  )
}
