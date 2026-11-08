import { SITE_URL, SITE_NAME } from './env'
import type { Article, Media } from '@/payload-types'

/** Real published logo asset, not a placeholder — tech-spec.md §3/§4. */
export const PUBLISHER_LOGO_URL = `${SITE_URL}/logo.png`
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}/og-default.png`

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO_URL },
  }
}

export type Breadcrumb = { name: string; url: string }

export function breadcrumbListJsonLd(items: Breadcrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

function resolveImageUrl(cover: Article['cover']): string {
  if (cover && typeof cover === 'object') {
    const media = cover as Media
    if (media.url) return media.url.startsWith('http') ? media.url : `${SITE_URL}${media.url}`
  }
  return DEFAULT_OG_IMAGE_URL
}

/**
 * tech-spec.md §3: `NewsArticle` only for materials tied to a real dated event;
 * `Article` for evergreen explainers. Driven by `Article.content_type`, never guessed.
 */
export function articleJsonLd(article: Article, canonicalUrl: string) {
  const authorName = typeof article.author === 'object' ? article.author?.name : undefined
  return {
    '@context': 'https://schema.org',
    '@type': article.content_type === 'evergreen' ? 'Article' : 'NewsArticle',
    headline: article.title,
    description: article.lead,
    inLanguage: 'uk',
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: authorName
      ? { '@type': 'Person', name: authorName }
      : { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO_URL },
    },
    image: [resolveImageUrl(article.cover)],
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
  }
}
