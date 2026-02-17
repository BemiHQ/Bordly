import { MikroORM } from '@mikro-orm/postgresql';
import type { BaseEntity } from '@/entities/base-entity';
import mikroOrmConfig from '@/mikro-orm.config';

export const orm = await MikroORM.init(mikroOrmConfig);

// add loaded[Relation] getters that throw an error if the relation is not loaded
const setupLoadedRelationGetters = (orm: MikroORM) => {
  const metadata = orm.getMetadata();
  const entities = metadata.getAll();

  for (const entityName of Object.keys(entities)) {
    const entityMetadata = entities[entityName]!;
    const relations = entityMetadata.relations.filter((r) => r.kind === 'm:1' || (r.kind === '1:1' && r.owner));
    if (relations.length === 0) continue;

    const EntityClass = entityMetadata.class;

    for (const relation of relations) {
      const propertyName = relation.name;
      const getterName = `loaded${propertyName.charAt(0).toUpperCase()}${propertyName.slice(1)}`;
      if (getterName in EntityClass.prototype) continue;

      Object.defineProperty(EntityClass.prototype, getterName, {
        get(this: BaseEntity) {
          const value = (this as unknown as Record<string, unknown>)[propertyName];

          // Just ID is loaded
          if (value && Object.values(value).filter(Boolean).length <= 1) {
            throw new Error(`${entityMetadata.className}.${propertyName} is not loaded for ${this.id}.`);
          }

          return value;
        },
        enumerable: false,
        configurable: true,
      });
    }
  }
};

setupLoadedRelationGetters(orm);
