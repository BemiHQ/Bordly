import { Entity, type Loaded, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';

@Entity({ tableName: 'domains' })
@Unique({ properties: ['name'] })
export class Domain extends BaseEntity {
  @Property()
  name: string;
  @Property()
  iconUrl?: string;
  @Property()
  fetchErrorStatus?: number;

  constructor({ name, iconUrl }: { name: string; iconUrl?: string }) {
    super();
    this.name = name;
    this.iconUrl = iconUrl;
    this.validate();
  }

  setIcon({ iconUrl, fetchErrorStatus }: { iconUrl?: string; fetchErrorStatus?: number }) {
    if (iconUrl) {
      this.iconUrl = iconUrl;
    } else if (fetchErrorStatus) {
      this.fetchErrorStatus = fetchErrorStatus;
    }
  }

  static toJson(domain: Loaded<Domain>) {
    return {
      id: domain.id,
      iconUrl: domain.iconUrl,
    };
  }

  private validate() {
    if (!this.name) throw new Error('Name is required');
  }
}
