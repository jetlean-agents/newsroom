import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
