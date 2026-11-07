-- Postgres full-text search for Articles.
-- Ukrainian is not available as a built-in tsearch configuration in stock Postgres
-- (no "ukrainian" dictionary ships in the default image), so this uses the
-- language-neutral "simple" configuration plus the "unaccent" extension, which
-- gets diacritic-insensitive matching without a real Ukrainian stemmer. Honest
-- limitation: no stemming, so "новина"/"новини" are not matched as the same root.

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', unaccent(coalesce(NEW.title, '') || ' ' || coalesce(NEW.lead, '')));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_search_vector_trigger ON articles;
CREATE TRIGGER articles_search_vector_trigger
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();

CREATE INDEX IF NOT EXISTS articles_search_vector_idx ON articles USING GIN (search_vector);

UPDATE articles SET title = title; -- backfill existing rows through the trigger
