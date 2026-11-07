import { getPayloadClient } from '@/lib/payload'

/**
 * Demo content only — three rubrics and three clearly-labeled "Демо-матеріал"
 * articles with fabricated-and-labeled test users and example.com sources.
 * None of this represents a real event, person, or publisher.
 */
async function main() {
  const payload = await getPayloadClient()

  const editor = await payload.create({
    collection: 'users',
    data: { email: 'editor@newsroom.test', password: 'password123', name: 'Тест Редактор (demo user)', role: 'editor' },
  })
  const author = await payload.create({
    collection: 'users',
    data: { email: 'author@newsroom.test', password: 'password123', name: 'Тест Автор (demo user)', role: 'author' },
  })
  await payload.create({
    collection: 'users',
    data: { email: 'admin@newsroom.test', password: 'password123', name: 'Тест Адмін (demo user)', role: 'admin' },
  })

  const rubricTitles = ['Суспільство', 'Економіка', 'Технології']
  const rubrics = []
  for (const title of rubricTitles) {
    rubrics.push(await payload.create({ collection: 'rubrics', data: { title, description: `Демо-рубрика: ${title}` } }))
  }

  const tag = await payload.create({ collection: 'tags', data: { title: 'демо' } })

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
    })
  }
  if (second) {
    await payload.update({
      collection: 'articles',
      id: second.id,
      data: { status: 'published', editor: editor.id },
      user: editor,
    })
  }

  await payload.create({
    collection: 'pages',
    data: {
      title: 'Редакційна політика',
      body: demoBodyRichText('[Чернетка-шаблон] Редакційна політика ресурсу буде заповнена пізніше. Контактні дані: [TBD].'),
    },
  })
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Розкриття використання ШІ',
      body: demoBodyRichText('[Чернетка-шаблон] Опис підходу до використання ШІ. Деталі: [TBD].'),
    },
  })
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Контакти',
      body: demoBodyRichText('[Чернетка-шаблон] Контактна інформація буде додана після вибору бренду. Email: [TBD].'),
    },
  })

  console.log('Seed complete: 3 rubrics, 1 tag, 3 users, 3 demo articles (2 published, 1 in_review), 3 page templates.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
