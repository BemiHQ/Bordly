import repl from 'node:repl';
import { orm } from '@/utils/orm';

const replServer = repl.start({
  prompt: 'bordly> ',
  useGlobal: true,
});

replServer.context.orm = orm;

console.log(`Example:

const { DomainService } = await import("@/services/domain.service.ts");
const { User } = await import("@/entities/user.ts");
await orm.em.find(User, {})
`);
