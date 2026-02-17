import { MikroORM } from '@mikro-orm/postgresql';

import mikroOrmConfig from '@/mikro-orm.config';

export const orm = await MikroORM.init(mikroOrmConfig);
