import * as migration_20261107_114746_initial from './20261107_114746_initial';
import * as migration_20261107_120000_search_vector from './20261107_120000_search_vector';

export const migrations = [
  {
    up: migration_20261107_114746_initial.up,
    down: migration_20261107_114746_initial.down,
    name: '20261107_114746_initial'
  },
  {
    up: migration_20261107_120000_search_vector.up,
    down: migration_20261107_120000_search_vector.down,
    name: '20261107_120000_search_vector'
  },
];
