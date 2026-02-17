import { Agent } from '@mastra/core/agent';
import { slugify } from '@/utils/strings';

export class AgentService {
  static createAgent({ name, instructions }: { name: string; instructions: string }) {
    const agent = new Agent({
      id: slugify(name),
      name,
      instructions,
      model: 'google/gemini-3-flash-preview',
    });
    return agent;
  }
}
