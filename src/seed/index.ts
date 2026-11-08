import type { Payload } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { RUBRICS_CONFIG } from '@/lib/rubricsConfig'

/**
 * Demo content only — three rubrics and three clearly-labeled "Демо-матеріал"
 * articles with fabricated-and-labeled test users and example.com sources.
 * None of this represents a real event, person, or publisher.
 *
 * disableTransaction: true everywhere — this script issues many sequential
 * Local API calls on one connection and Payload 3.37's pg transaction handling
 * can leave a connection idle-in-transaction across calls, deadlocking the
 * next statement. Each call here is already a single all-or-nothing write.
 */

/**
 * Every demo account rotates its password on every seed run rather than only
 * setting it once — FACT-170 PO review: `editor`/`author` can publish/unpublish
 * articles and edit rubrics/tags/pages just like `admin` (`src/collections/
 * Articles.ts`'s publish-transition check allows `editor` too), so a known
 * hardcoded password on any of them is the same public-sandbox-with-a-known-
 * password risk the first review flagged for `admin` alone. In production
 * (always true inside the Docker image — see Dockerfile) this throws instead
 * of falling back to a known default if the required env var isn't set, so a
 * misconfigured deploy fails loud rather than shipping a guessable password.
 */
async function upsertRotatingUser(
  payload: Payload,
  { email, password, name, role, envVarName }: { email: string; password: string | undefined; name: string; role: string; envVarName: string },
) {
  if (process.env.NODE_ENV === 'production' && !password) {
    throw new Error(`${envVarName} must be set to seed/rotate the ${role} account (${email}) in production.`)
  }
  const finalPassword = password || 'password123'

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { password: finalPassword },
      disableTransaction: true,
    })
    return existing.docs[0]
  }
  return payload.create({
    collection: 'users',
    data: { email, password: finalPassword, name, role },
    disableTransaction: true,
  })
}

/**
 * All demo content below is keyed by `title`, which is unique enough for
 * this fixed seed data set and maps onto each collection's unique `slug` —
 * so a second seed run must look up by title before creating, or it dies on
 * a slug unique-constraint violation and exits 1 (the Dokploy "seed" service
 * ends up `exited(1)` after every deploy — FACT-204).
 */
async function findByTitle(payload: Payload, collection: 'rubrics' | 'tags' | 'pages' | 'articles', title: string) {
  const existing = await payload.find({ collection, where: { title: { equals: title } }, limit: 1 })
  return existing.docs[0] ?? null
}

async function main() {
  const payload = await getPayloadClient()

  const editor = await upsertRotatingUser(payload, {
    email: 'editor@newsroom.test',
    password: process.env.SEED_DEMO_PASSWORD,
    name: 'Тест Редактор (demo user)',
    role: 'editor',
    envVarName: 'SEED_DEMO_PASSWORD',
  })
  const author = await upsertRotatingUser(payload, {
    email: 'author@newsroom.test',
    password: process.env.SEED_DEMO_PASSWORD,
    name: 'Тест Автор (demo user)',
    role: 'author',
    envVarName: 'SEED_DEMO_PASSWORD',
  })
  await upsertRotatingUser(payload, {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@newsroom.test',
    password: process.env.SEED_ADMIN_PASSWORD,
    name: 'Тест Адмін (demo user)',
    role: 'admin',
    envVarName: 'SEED_ADMIN_PASSWORD',
  })

  // 12 rubrics per Roman's 08.11 focus decision (epic FACT-164 / this issue) — replaces
  // the stage-1 demo three-rubric set. Slugs come from the single config, never hardcoded
  // here, so a re-run also repairs a rubric whose slug drifted from the config.
  const rubrics = []
  for (const { title, slug, description } of RUBRICS_CONFIG) {
    const existing = await findByTitle(payload, 'rubrics', title)
    if (existing) {
      rubrics.push(
        existing.slug === slug
          ? existing
          : await payload.update({
              collection: 'rubrics',
              id: existing.id,
              data: { slug },
              disableTransaction: true,
            }),
      )
    } else {
      rubrics.push(
        await payload.create({
          collection: 'rubrics',
          data: { title, slug, description },
          disableTransaction: true,
        }),
      )
    }
  }

  const tag =
    (await findByTitle(payload, 'tags', 'демо')) ||
    (await payload.create({ collection: 'tags', data: { title: 'демо' }, disableTransaction: true }))

  const demoBodyRichText = (text: string) => ({
    root: {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text }], version: 1 },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  })

  // rubricSlug picks the rubric by this issue's config slug, not array position — stays
  // correct regardless of RUBRICS_CONFIG ordering.
  const rubricBySlug = (slug: string) => rubrics.find((r) => r.slug === slug)!

  const articles: Array<{
    title: string
    lead: string
    rubricSlug: string
    content_type: 'news' | 'evergreen'
    featured: boolean
    publish: boolean
  }> = [
    {
      title: 'Демо-матеріал: запуск тестової платформи новин',
      lead: '[Демо-матеріал] Цей текст створено виключно для перевірки каркасу CMS, це не реальна новина.',
      rubricSlug: 'podii',
      content_type: 'news',
      featured: false,
      publish: true,
    },
    {
      title: 'Демо-матеріал: приклад статті про економіку',
      lead: '[Демо-матеріал] Приклад статті в рубриці «Економіка» для перевірки стрічки та пошуку.',
      rubricSlug: 'ekonomika',
      content_type: 'news',
      featured: false,
      publish: true,
    },
    {
      title: 'Демо-матеріал: приклад статті про технології',
      lead: '[Демо-матеріал] Приклад статті в рубриці «Технології» для перевірки картки статті.',
      rubricSlug: 'tekhnolohii',
      content_type: 'news',
      featured: false,
      publish: false,
    },
    {
      title: 'Демо-матеріал: пояснялка — як працює каркас рубрик',
      lead: '[Демо-матеріал] Evergreen-пояснялка для перевірки блоку «Поясняльні матеріали рубрики» і JSON-LD Article.',
      rubricSlug: 'tekhnolohii',
      content_type: 'evergreen',
      featured: true,
      publish: true,
    },
  ]

  for (const a of articles) {
    if (await findByTitle(payload, 'articles', a.title)) continue
    await payload.create({
      collection: 'articles',
      data: {
        title: a.title,
        lead: a.lead,
        body: demoBodyRichText(`${a.lead} Повний текст цього демо-матеріалу є тестовим наповненням і не описує реальні події.`),
        rubric: rubricBySlug(a.rubricSlug).id,
        tags: [tag.id],
        content_type: a.content_type,
        sources: [
          {
            title: 'Приклад джерела (demo)',
            url: 'https://example.com/demo-source',
            publisher: 'Example Publisher (demo)',
            accessed_at: new Date().toISOString(),
          },
        ],
        event_date: new Date().toISOString(),
        status: 'in_review',
        author: author.id,
      },
      disableTransaction: true,
    })
  }

  // Walk the "publish: true" demo articles through the real workflow so the hub/home
  // pages have something real to render, while at least one stays in the in_review
  // queue (admin review-queue AC). Looked up by the fixed demo titles (not a blind
  // "first N"), so a second run republishes the same demo articles instead of drifting.
  for (const a of articles.filter((a) => a.publish)) {
    const doc = await findByTitle(payload, 'articles', a.title)
    if (!doc) continue
    // An unpublished doc (e.g. retracted in an earlier manual test) must stay unpublished —
    // the Articles state machine has no unpublished -> published transition (by design).
    if (doc.status === 'unpublished') continue
    await payload.update({
      collection: 'articles',
      id: doc.id,
      // Already-published docs only need `featured` kept in sync; in_review ones also
      // transition (nextStatus === prevStatus is a no-op for the transition check either way).
      data: { status: 'published', editor: editor.id, featured: a.featured },
      user: editor,
      disableTransaction: true,
    })
  }

  const pages = [
    { title: 'Редакційна політика', body: '[Чернетка-шаблон] Редакційна політика ресурсу буде заповнена пізніше. Контактні дані: [TBD].' },
    { title: 'Розкриття використання ШІ', body: '[Чернетка-шаблон] Опис підходу до використання ШІ. Деталі: [TBD].' },
    { title: 'Контакти', body: '[Чернетка-шаблон] Контактна інформація буде додана після вибору бренду. Email: [TBD].' },
  ]
  for (const p of pages) {
    if (await findByTitle(payload, 'pages', p.title)) continue
    await payload.create({
      collection: 'pages',
      data: { title: p.title, body: demoBodyRichText(p.body) },
      disableTransaction: true,
    })
  }

  console.log('Seed complete: 12 rubrics, 1 tag, 3 users, 4 demo articles (3 published incl. 1 featured + 1 evergreen, 1 in_review), 3 page templates.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
