import type { Payload } from 'payload'
import { getPayloadClient } from '@/lib/payload'

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

  const rubricTitles = ['Суспільство', 'Економіка', 'Технології']
  const rubrics = []
  for (const title of rubricTitles) {
    rubrics.push(
      await payload.create({
        collection: 'rubrics',
        data: { title, description: `Демо-рубрика: ${title}` },
        disableTransaction: true,
      }),
    )
  }

  const tag = await payload.create({ collection: 'tags', data: { title: 'демо' }, disableTransaction: true })

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

  const articles = [
    {
      title: 'Демо-матеріал: запуск тестової платформи новин',
      lead: '[Демо-матеріал] Цей текст створено виключно для перевірки каркасу CMS, це не реальна новина.',
    },
    {
      title: 'Демо-матеріал: приклад статті про економіку',
      lead: '[Демо-матеріал] Приклад статті в рубриці «Економіка» для перевірки стрічки та пошуку.',
    },
    {
      title: 'Демо-матеріал: приклад статті про технології',
      lead: '[Демо-матеріал] Приклад статті в рубриці «Технології» для перевірки картки статті.',
    },
  ]

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const rubric = rubrics[i % rubrics.length]
    await payload.create({
      collection: 'articles',
      data: {
        title: a.title,
        lead: a.lead,
        body: demoBodyRichText(`${a.lead} Повний текст цього демо-матеріалу є тестовим наповненням і не описує реальні події.`),
        rubric: rubric.id,
        tags: [tag.id],
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

  // Walk one article through the real workflow so there's something in the
  // in_review queue AND something published, matching the admin review-queue AC.
  const all = await payload.find({ collection: 'articles', limit: 10 })
  const [first, second] = all.docs
  if (first) {
    await payload.update({
      collection: 'articles',
      id: first.id,
      data: { status: 'published', editor: editor.id },
      user: editor,
      disableTransaction: true,
    })
  }
  if (second) {
    await payload.update({
      collection: 'articles',
      id: second.id,
      data: { status: 'published', editor: editor.id },
      user: editor,
      disableTransaction: true,
    })
  }

  await payload.create({
    collection: 'pages',
    data: {
      title: 'Редакційна політика',
      body: demoBodyRichText('[Чернетка-шаблон] Редакційна політика ресурсу буде заповнена пізніше. Контактні дані: [TBD].'),
    },
    disableTransaction: true,
  })
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Розкриття використання ШІ',
      body: demoBodyRichText('[Чернетка-шаблон] Опис підходу до використання ШІ. Деталі: [TBD].'),
    },
    disableTransaction: true,
  })
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Контакти',
      body: demoBodyRichText('[Чернетка-шаблон] Контактна інформація буде додана після вибору бренду. Email: [TBD].'),
    },
    disableTransaction: true,
  })

  console.log('Seed complete: 3 rubrics, 1 tag, 3 users, 3 demo articles (2 published, 1 in_review), 3 page templates.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
