import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [{ hostname: '**' }],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
