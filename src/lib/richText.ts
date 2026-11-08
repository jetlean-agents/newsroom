import type { Article } from '@/payload-types'

/** Flattens a Lexical richText doc to plain text — used anywhere we need to run
 * text analysis (originality overlap, fact-check) or a plain preview over `body`. */
export function plainTextFromBody(body: Article['body'] | null | undefined): string {
  const lines: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (n.type === 'text' && n.text) lines.push(n.text)
    n.children?.forEach(walk)
  }
  walk(body?.root)
  return lines.join('\n\n')
}
