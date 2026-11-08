import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tech-spec.md §1 URL scheme uses a trailing slash (`/{rubric}/{slug}/`) — without this,
  // Next's default trailing-slash normalization 308s `/{rubric}/{slug}/` back to the
  // no-slash form, which would make the "self-canonical" URL redirect away from itself.
  trailingSlash: true,
  // Next's own trailing-slash redirect is baked into the build's internal redirect table and
  // is checked *before* Middleware ever runs (resolve-routes.js: headers → redirects →
  // middleware) — and it's hardcoded to 308. That makes it impossible for middleware.ts to
  // turn the legacy `/articles/{slug}` and `/rubrics/{slug}` redirects into a 301 (FACT-261 /
  // QA FACT-259): the client sees Next's 308 first and middleware.ts's response never reaches
  // it. Turning this off hands all trailing-slash normalization to middleware.ts instead,
  // which replicates it (still 308 for every other path) and special-cases those two.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [{ hostname: '**' }],
  },
  // `npm run lint` is its own CI step; don't let a pre-existing lint backlog
  // (see docs/deploy.md) block `next build`/the Docker image build.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
