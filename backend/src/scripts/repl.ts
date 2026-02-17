import repl from 'node:repl';
import { RequestContext } from '@mikro-orm/core';
import { orm } from '@/utils/orm';

await RequestContext.create(orm.em, async () => {
  const replServer = repl.start({
    prompt: 'bordly> ',
    useGlobal: true,
  });

  replServer.context.orm = orm;

  console.log(`Example:

const { DomainService } = await import("@/services/domain.service.ts");
const { EmailMessage } = await import("@/entities/email-message.ts");
emailMessage = await orm.em.findOne(EmailMessage, { id: { $ne: null } });
`);
});
