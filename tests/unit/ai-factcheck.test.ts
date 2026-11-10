import { describe, it, expect } from 'vitest'
import { factCheckFlags } from '@/lib/ai/factCheck'

describe('fact-check assist (FACT-236)', () => {
  const sources = ['Пожежа сталася в Києві 5 листопада, постраждало 3 людини, повідомляє ДСНС.']

  it('does not flag a number that appears in the sources', () => {
    const draft = 'Унаслідок пожежі постраждало 3 людини.'
    expect(factCheckFlags(draft, sources)).toEqual([])
  })

  it('flags a number that does not appear in any source', () => {
    const draft = 'Унаслідок пожежі постраждало 12 людей.'
    const flags = factCheckFlags(draft, sources)
    expect(flags).toContainEqual({ value: '12', kind: 'number' })
  })

  it('flags an invented name not present in any source', () => {
    const draft = 'Про це повідомив Петро Коваленко, речник ДСНС.'
    const flags = factCheckFlags(draft, sources)
    expect(flags.some((f) => f.kind === 'name' && f.value === 'Петро Коваленко')).toBe(true)
  })

  it('does not flag a name that is present in a source', () => {
    const draft = 'На місці подій працювала ДСНС Києва.'
    const flags = factCheckFlags(draft, ['Пожежа сталася в Києві, працювала ДСНС Києва.'])
    expect(flags.some((f) => f.value === 'ДСНС Києва')).toBe(false)
  })

  it('flags a date not present in any source', () => {
    const draft = 'Подія сталася 01.01.2026.'
    const flags = factCheckFlags(draft, sources)
    expect(flags.some((f) => f.kind === 'date')).toBe(true)
  })

  describe('thousands-separator formatting (FACT-362)', () => {
    it('does not flag the same sum re-formatted with a space separator', () => {
      const draft = 'Комунальне підприємство оголосило тендер на суму 500 000 грн для закупівлі обладнання.'
      const procurementSources = ['Оголошено тендер на суму 500000 грн для закупівлі обладнання, повідомляє Prozorro.']
      expect(factCheckFlags(draft, procurementSources)).toEqual([])
    })

    it('does not flag the same sum when the source has the space separator and the draft does not', () => {
      const draft = 'Тендер на суму 500000 грн.'
      const procurementSources = ['Оголошено тендер на суму 500 000 грн, повідомляє Prozorro.']
      expect(factCheckFlags(draft, procurementSources)).toEqual([])
    })

    it('still flags a genuinely different sum, not just a differently-formatted one', () => {
      const draft = 'Тендер на суму 700 000 грн.'
      const procurementSources = ['Оголошено тендер на суму 500000 грн, повідомляє Prozorro.']
      const flags = factCheckFlags(draft, procurementSources)
      expect(flags).toContainEqual({ value: '700 000', kind: 'number' })
    })
  })

  // FACT-379: sandbox measurement (FACT-341, 10.11 01:22 UTC) found fact_flags
  // blocking 27 of 53 /review items, most of them formatting-only differences
  // rather than invented facts — number magnitude words, written-vs-digit
  // dates, and Ukrainian case endings on names/toponyms. Each group below is
  // "було" (flagged before this fix) / "стало" (clean now); the last group
  // re-confirms genuinely fabricated numbers/dates/names still flag.
  describe('number magnitude words + decimal comma (FACT-379)', () => {
    it('does not flag "1,5 тисячі" against a source spelling the figure out in full', () => {
      const draft = 'Загалом на місце виїхали 1,5 тисячі рятувальників.'
      const sources = ['У заході були залучені 1500 рятувальників.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag "500 мільйонів" against a bare-digit source figure', () => {
      const draft = 'Бюджет програми складає 500 мільйонів гривень.'
      const sources = ['Бюджет програми - 500000000 гривень, повідомляє Мінфін.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag a bare-digit draft figure against a source using "мільйона"', () => {
      const draft = 'Сума контракту становить 1500000 грн.'
      const sources = ['Оголошено тендер на суму 1,5 мільйона грн, повідомляє Prozorro.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag the abbreviated "млрд" form against a bare-digit source figure', () => {
      const draft = 'Збитки оцінюють у 2 млрд грн.'
      const sources = ['Попередні збитки склали 2000000000 грн.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag the abbreviated "тис." form against a bare-digit source figure', () => {
      const draft = 'На ремонт дороги витратили 3 тис. грн.'
      const sources = ['На ремонт дороги виділено 3000 грн з бюджету.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag a decimal magnitude figure against a bare-digit source figure', () => {
      const draft = 'Населення міста - 10,2 тисячі осіб.'
      const sources = ['За даними перепису, в місті проживає 10200 осіб.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('does not flag a magnitude figure against a source using the opposite separator+magnitude combination', () => {
      const draft = 'Тендер оголошено на суму 500 000 грн.'
      const sources = ['Оголошено тендер на суму 500 тисяч гривень, повідомляє Prozorro.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
    })

    it('still flags a genuinely different magnitude figure, not just a differently-formatted one', () => {
      const draft = 'Загалом залучили 2,5 тисячі волонтерів.'
      const sources = ['У заході взяли участь 1500 волонтерів.']
      expect(factCheckFlags(draft, sources)).toContainEqual({ value: '2,5', kind: 'number' })
    })
  })

  describe('digit vs. written-out Ukrainian dates (FACT-379)', () => {
    it('does not flag a bare digit date (no year) against a written-form source date', () => {
      const draft = 'Подія сталася 09.11.'
      const sources = ['Подія сталася 9 листопада, повідомляє очевидець.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'date')).toBe(false)
    })

    it('does not flag a written-form date against a source digit date that also carries a year', () => {
      const draft = 'Подія сталася 9 листопада.'
      const sources = ['Подія сталася 09.11.2026, повідомляє поліція.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'date')).toBe(false)
    })

    it('does not flag a written-form date with a year against a bare digit source date', () => {
      const draft = 'Подія сталася 9 листопада 2026 року.'
      const sources = ['Подія сталася 09.11, повідомляє поліція.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'date')).toBe(false)
    })

    it('does not flag a single-digit-day digit date against a written-form source date', () => {
      const draft = 'Подія сталася 5.11.'
      const sources = ['Подія сталася 5 листопада, повідомляє очевидець.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'date')).toBe(false)
    })

    it('does not flag a bare digit date against a written-form source date with "року"', () => {
      const draft = 'Подія сталася 09.11.'
      const sources = ['Подія сталася 9 листопада 2026 року, повідомляє поліція.']
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'date')).toBe(false)
    })

    it('still flags a genuinely different date, not just a differently-formatted one', () => {
      const draft = 'Подія сталася 15 листопада.'
      const sources = ['Подія сталася 9 листопада, повідомляє очевидець.']
      expect(factCheckFlags(draft, sources)).toContainEqual({ value: '15 листопада', kind: 'date' })
    })
  })

  describe('Ukrainian case endings on names/toponyms (FACT-379)', () => {
    const sources = ['Про це повідомив Петро Коваленко, речник ДСНС Запорізької області.']

    it('does not flag a genitive-case inflection of a name present in the sources', () => {
      const draft = 'За словами Петра Коваленка, ситуація під контролем.'
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'name')).toBe(false)
    })

    it('does not flag a dative-case inflection of a name present in the sources', () => {
      const draft = 'Журналісти подякували Петру Коваленку за коментар.'
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'name')).toBe(false)
    })

    it('does not flag an instrumental-case inflection of a name present in the sources', () => {
      const draft = 'Інтерв’ю було записано Петром Коваленком особисто.'
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'name')).toBe(false)
    })

    it('does not flag a locative-case inflection of a toponym present in the sources', () => {
      const draft = 'У Запорізькій області оголосили повітряну тривогу.'
      expect(factCheckFlags(draft, sources).some((f) => f.kind === 'name')).toBe(false)
    })

    it('still flags a genuinely different (fabricated) name, even in an inflected case', () => {
      const draft = 'За словами Олега Петренка, ситуація під контролем.'
      const flags = factCheckFlags(draft, sources)
      expect(flags.some((f) => f.kind === 'name' && f.value === 'Олега Петренка')).toBe(true)
    })
  })

  it('supports a number that only appears in the source title/URL text passed in (not the summary)', () => {
    // draftFromEvent.ts/Articles.ts build each source text from title+summary+url
    // (FACT-379) — factCheckFlags itself is agnostic to where in that string the
    // figure came from, so a figure the model carried over from a source's title
    // or URL slug (never restated in the summary prose) is still recognized.
    const draft = 'Пожежу вдалося загасити, постраждало 500 людей.'
    const sources = ['Коротка новина https://example.test/news/2026/11/09/fire-500-injured']
    expect(factCheckFlags(draft, sources).some((f) => f.kind === 'number')).toBe(false)
  })
})
