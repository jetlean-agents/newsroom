import type { Metadata } from 'next'
import { Literata, Golos_Text } from 'next/font/google'
import { SITE_NAME, robotsMeta } from '@/lib/env'
import Masthead from '@/components/Masthead'
import Footer from '@/components/Footer'
import './globals.css'

const serif = Literata({ subsets: ['cyrillic', 'latin'], axes: ['opsz'], variable: '--font-serif', display: 'swap' })
const sans = Golos_Text({ subsets: ['cyrillic', 'latin'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  robots: robotsMeta(),
  openGraph: { locale: 'uk_UA', siteName: SITE_NAME },
  icons: { icon: '/favicon.ico' },
}

// Applies the saved/system theme before first paint — avoids a flash of the
// wrong theme (design/README.md "Тёмная тема").
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${serif.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Перейти до основного вмісту</a>
        <Masthead />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
