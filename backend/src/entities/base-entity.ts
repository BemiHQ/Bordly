import { PrimaryKey, Property } from '@mikro-orm/postgresql';

export abstract class BaseEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuid_generate_v4()' })
  id!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  toJson() {
    return {
      id: this.id,
    };
  }
}
