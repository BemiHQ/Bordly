import { Entity, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';

@Entity({ tableName: 'domains' })
@Unique({ properties: ['name'] })
export class Domain extends BaseEntity {
  @Property()
  name: string;
  @Property()
  iconUrl?: string;

  constructor({ name, iconUrl }: { name: string; iconUrl?: string }) {
    super();
    this.name = name;
    this.iconUrl = iconUrl;
    this.validate();
  }

  setIconUrl(iconUrl?: string) {
    if (iconUrl) {
      this.iconUrl = iconUrl;
    }
  }

  toJson() {
    return {
      id: this.id,
      iconUrl: this.iconUrl,
    };
  }

  private validate() {
    if (!this.name) throw new Error('Name is required');
  }
}
