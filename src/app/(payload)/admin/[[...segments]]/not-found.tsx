import config from '@/payload.config'
import { NotFoundPage } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function NotFound({ params, searchParams }: Args) {
  return NotFoundPage({ config, params, searchParams, importMap })
}
