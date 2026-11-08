import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tech-spec.md §1 URL scheme uses a trailing slash (`/{rubric}/{slug}/`) — without this,
  // Next's default trailing-slash normalization 308s `/{rubric}/{slug}/` back to the
  // no-slash form, which would make the "self-canonical" URL redirect away from itself.
  trailingSlash: true,
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
