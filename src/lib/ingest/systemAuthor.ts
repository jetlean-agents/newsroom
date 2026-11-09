/**
 * The placeholder author draftFromEvent() assigns to every AI draft. Articles.ts
 * swaps this out for the real editor on publish (FACT-236 AC item 7: "author =
 * real editor who verified the material") — never a real byline on its own.
 */
export const SYSTEM_AUTHOR_EMAIL = 'ingest-system@sandbox.local'

/**
 * The byline on an article AUTO_PUBLISH published with no human in the
 * loop (FACT-337 scope item 4: "Автор публикации — системная редакція
 * «Редакція (автоматично)» с честним AI-disclosure"). Distinct from
 * SYSTEM_AUTHOR_EMAIL above: that one is a placeholder swapped out for a
 * real editor on manual publish; this one IS the real, disclosed byline for
 * a fully automated publish — never a stand-in for a person who doesn't
 * exist.
 */
export const AUTO_EDITOR_EMAIL = 'auto-editorial@sandbox.local'
export const AUTO_EDITOR_NAME = 'Редакція (автоматично)'
