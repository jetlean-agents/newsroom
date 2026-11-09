const KYIV_TZ = 'Europe/Kyiv'

function kyivParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(date) // YYYY-MM-DD in Kyiv local time
}

/** `HH:mm` in Kyiv time, for `<time>` display in the feed. */
export function formatFeedTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: KYIV_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const MONTHS_UK = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
]

/** `Вчора, 8 листопада` / `12 жовтня 2026` — day separator in "Останні новини". */
export function formatDayLabel(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  const today = kyivParts(now)
  const target = kyivParts(date)
  const yesterday = kyivParts(new Date(now.getTime() - 24 * 60 * 60 * 1000))

  const [y, m, d] = target.split('-').map(Number)
  const dayMonth = `${d} ${MONTHS_UK[m - 1]}`
  const [ty] = today.split('-').map(Number)

  if (target === yesterday) return `Вчора, ${dayMonth}`
  if (y !== ty) return `${dayMonth} ${y}`
  return dayMonth
}

/** Whether `iso` falls on the same Kyiv calendar day as `now`. */
export function isSameKyivDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false
  return kyivParts(new Date(iso)) === kyivParts(now)
}

/** `9 листопада 2026, 14:32` — full date+time for the article byline. */
export function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const [y, m, d] = kyivParts(date).split('-').map(Number)
  const time = formatFeedTime(iso)
  return `${d} ${MONTHS_UK[m - 1]} ${y}, ${time}`
}

/** `9 листопада 2026` — date only, for source "accessed_at" and corrections. */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const [y, m, d] = kyivParts(date).split('-').map(Number)
  return `${d} ${MONTHS_UK[m - 1]} ${y}`
}

/** FACT-340 PO decision (09.11): breaking is active only while `breaking` is set
 * AND `now < breaking_until`. The pipeline never sets `breaking` itself. */
export function isBreakingActive(
  breaking: boolean | null | undefined,
  breakingUntil: string | null | undefined,
  now = new Date(),
): boolean {
  if (!breaking || !breakingUntil) return false
  return now.getTime() < new Date(breakingUntil).getTime()
}
