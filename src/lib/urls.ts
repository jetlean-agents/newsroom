import { SITE_URL } from './env'

export function rubricPath(rubricSlug: string): string {
  return `/${rubricSlug}/`
}

export function rubricPageNPath(rubricSlug: string, page: number): string {
  return `/${rubricSlug}/page/${page}/`
}

export function articlePath(rubricSlug: string, articleSlug: string): string {
  return `/${rubricSlug}/${articleSlug}/`
}

export function tagPath(tagSlug: string): string {
  return `/tag/${tagSlug}/`
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`
}
