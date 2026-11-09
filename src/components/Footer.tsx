import Link from 'next/link'
import { RUBRICS_CONFIG } from '@/lib/rubricsConfig'
import { rubricPath } from '@/lib/urls'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__cols">
          <div className="stack-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wordmark" src="/logo/wordmark-inverse.svg" alt="Новини України" width={213} height={25} />
            <p>Незалежний новинний ресурс. Кожен матеріал має перелік джерел і дати публікації та оновлення.</p>
          </div>
          <div className="footer__rubrics">
            <h2>Рубрики</h2>
            <ul>
              {RUBRICS_CONFIG.map((r) => (
                <li key={r.slug}>
                  <Link href={rubricPath(r.slug)}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Редакція</h2>
            <ul>
              <li><Link href="/corrections">Виправлення</Link></li>
              <li><Link href="/search">Пошук</Link></li>
            </ul>
          </div>
          <div>
            <h2>Підписка</h2>
            <ul>
              <li><a href="/feed.xml">RSS — усі новини</a></li>
              <li><Link href="/search">Пошук</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__note">
          <p>Частину матеріалів підготовлено з допомогою ШІ: це позначено в кожному з них, а редакція перевіряє факти перед публікацією.</p>
          <p>Демонстраційний sandbox-ресурс. Не є джерелом реальних новин. © 2026</p>
        </div>
      </div>
    </footer>
  )
}
