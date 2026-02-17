import { Agent } from '@mastra/core/agent';
import { ENV } from '@/utils/env';
import { slugify } from '@/utils/strings';

export class AgentService {
  static createAgent({
    name,
    instructions,
    model = ENV.LLM_FAST_MODEL,
  }: {
    name: string;
    instructions: string;
    model?: string;
  }) {
    const agent = new Agent({ id: slugify(name), name, instructions, model });
    return agent;
  }
}
