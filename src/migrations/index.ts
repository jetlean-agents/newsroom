import * as migration_20261107_114746_initial from './20261107_114746_initial';
import * as migration_20261107_120000_search_vector from './20261107_120000_search_vector';
import * as migration_20261107_220653_ingest_pipeline from './20261107_220653_ingest_pipeline';
import * as migration_20261108_114909_add_article_content_type_featured from './20261108_114909_add_article_content_type_featured';

export const migrations = [
  {
    up: migration_20261107_114746_initial.up,
    down: migration_20261107_114746_initial.down,
    name: '20261107_114746_initial',
  },
  {
    up: migration_20261107_120000_search_vector.up,
    down: migration_20261107_120000_search_vector.down,
    name: '20261107_120000_search_vector',
  },
  {
    up: migration_20261107_220653_ingest_pipeline.up,
    down: migration_20261107_220653_ingest_pipeline.down,
    name: '20261107_220653_ingest_pipeline',
  },
  {
    up: migration_20261108_114909_add_article_content_type_featured.up,
    down: migration_20261108_114909_add_article_content_type_featured.down,
    name: '20261108_114909_add_article_content_type_featured'
  },
];
