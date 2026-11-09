import * as migration_20261107_114746_initial from './20261107_114746_initial';
import * as migration_20261107_120000_search_vector from './20261107_120000_search_vector';
import * as migration_20261107_220653_ingest_pipeline from './20261107_220653_ingest_pipeline';
import * as migration_20261108_114909_add_article_content_type_featured from './20261108_114909_add_article_content_type_featured';
import * as migration_20261108_161318_fact236_ai_draft_fields from './20261108_161318_fact236_ai_draft_fields';
import * as migration_20261109_170000_fact337_autoreg_sensitivity_spend from './20261109_170000_fact337_autoreg_sensitivity_spend';
import * as migration_20261109_190000_fact355_fix_sensitive_categories_columns from './20261109_190000_fact355_fix_sensitive_categories_columns';
import * as migration_20261109_200000_fact345_sources_status from './20261109_200000_fact345_sources_status';
import * as migration_20261109_200000_fact340_breaking from './20261109_200000_fact340_breaking';

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
    name: '20261108_114909_add_article_content_type_featured',
  },
  {
    up: migration_20261108_161318_fact236_ai_draft_fields.up,
    down: migration_20261108_161318_fact236_ai_draft_fields.down,
    name: '20261108_161318_fact236_ai_draft_fields',
  },
  {
    up: migration_20261109_170000_fact337_autoreg_sensitivity_spend.up,
    down: migration_20261109_170000_fact337_autoreg_sensitivity_spend.down,
    name: '20261109_170000_fact337_autoreg_sensitivity_spend',
  },
  {
    up: migration_20261109_190000_fact355_fix_sensitive_categories_columns.up,
    down: migration_20261109_190000_fact355_fix_sensitive_categories_columns.down,
    name: '20261109_190000_fact355_fix_sensitive_categories_columns'
  },
  {
    up: migration_20261109_200000_fact345_sources_status.up,
    down: migration_20261109_200000_fact345_sources_status.down,
    name: '20261109_200000_fact345_sources_status',
  },
  {
    up: migration_20261109_200000_fact340_breaking.up,
    down: migration_20261109_200000_fact340_breaking.down,
    name: '20261109_200000_fact340_breaking',
  },
];
