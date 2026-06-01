import * as groqService from '../services/groq.service.js';
import { TOOL_DEFINITIONS, executeTool } from './tools.js';
import { buildSystemPrompt, parseReActResponse } from './prompt.js';

const MAX_ITERATIONS = 8; // never remove this

function serializeHistory(history) {
  return history
    .map(step => [
      `Thought: ${step.thought}`,
      `Action: ${step.action}`,
      `Action Input: ${JSON.stringify(step.actionInput)}`,
      `Observation: ${step.observation}`,
    ].join('\n'))
    .join('\n\n');
}

async function runReActAgent({ goal, owner, repo, onStep }) {
  const context = { owner, repo, repoTree: null };
  const history = [];

  const systemPrompt = buildSystemPrompt(goal, owner, repo, TOOL_DEFINITIONS);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const userMessage = history.length === 0
      ? `Begin analysis. Goal: ${goal}`
      : serializeHistory(history);

    const rawResponse = await groqService.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);

    const parsed = parseReActResponse(rawResponse);

    onStep({ type: 'thought', content: parsed.thought, iteration: i + 1 });

    if (parsed.finalAnswer) {
      onStep({ type: 'final_answer', content: parsed.finalAnswer });
      return parsed.finalAnswer;
    }

    if (!parsed.action) {
      onStep({
        type: 'observation',
        content: 'Error: LLM did not return a valid Action. Expected "Thought/Action/Action Input" format.',
      });
      continue;
    }

    onStep({ type: 'action', tool: parsed.action, input: parsed.actionInput });
    const observation = await executeTool(parsed.action, parsed.actionInput, context);

    onStep({ type: 'observation', content: observation });

    history.push({
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.actionInput,
      observation,
    });
  }

  onStep({ type: 'error', content: 'Agent reached maximum iterations without a final answer.' });
  return null;
}

export { runReActAgent };
