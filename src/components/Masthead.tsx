import Link from 'next/link'
import { RUBRICS_CONFIG } from '@/lib/rubricsConfig'
import { rubricPath } from '@/lib/urls'
import ThemeToggle from './ThemeToggle'
import { SearchIcon, MenuIcon } from './icons'

/** Шапка + рядок рубрик (design/README.md "Полоса «чернила»"). `activeRubric`
 * sets `aria-current="page"` on the matching nav item. */
export default function Masthead({ activeRubric }: { activeRubric?: string }) {
  return (
    <>
      <header className="masthead">
        <div className="container masthead__bar">
          <Link className="masthead__logo" href="/" aria-label="Новини України — головна">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wordmark" src="/logo/wordmark-inverse.svg" alt="" width={213} height={25} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wordtype" src="/logo/wordtype.svg" alt="Новини України" width={171} height={21} />
          </Link>
          <Link className="icon-btn" href="/search" aria-label="Пошук">
            <SearchIcon />
            <span className="icon-btn__label" aria-hidden="true">Пошук</span>
          </Link>
          <ThemeToggle />
          <button className="icon-btn icon-btn--menu" type="button" aria-label="Меню">
            <MenuIcon />
          </button>
        </div>
      </header>
      <nav className="rubric-nav" aria-label="Рубрики">
        <div className="container">
          <ul className="rubric-nav__list">
            {RUBRICS_CONFIG.map((r) => (
              <li key={r.slug}>
                <Link href={rubricPath(r.slug)} data-r={r.slug} aria-current={r.slug === activeRubric ? 'page' : undefined}>
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  )
}
