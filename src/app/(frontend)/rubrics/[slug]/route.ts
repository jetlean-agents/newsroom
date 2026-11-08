import { NextResponse, type NextRequest } from 'next/server'
import { rubricPath } from '@/lib/urls'

/** Legacy stage-1 URL. Permanent redirect — tech-spec.md §1 / this issue's URL scheme. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return NextResponse.redirect(new URL(rubricPath(slug), req.url), 301)
}
