function buildSystemPrompt(goal, owner, repo, toolDefinitions) {
  const toolsText = toolDefinitions
    .map(t => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n');
      return `Tool: ${t.name}\nDescription: ${t.description}${params ? '\nParameters:\n' + params : ''}`;
    })
    .join('\n\n');

  return `You are DevAssist, an expert code review agent analyzing the GitHub repository ${owner}/${repo}.

Goal: ${goal}

You have access to these tools:

${toolsText}

IMPORTANT RULES:
- Always start by fetching the repo structure to understand what files exist
- Read files strategically — only files relevant to the goal
- Never read more than 5 files in a single session
- Keep thoughts concise — one clear reasoning sentence
- Action Input must always be valid JSON

Respond in EXACTLY this format (no deviation):

Thought: [your reasoning about what to do next]
Action: [exact tool name]
Action Input: [valid JSON object]

When you have enough information to answer the goal completely:

Thought: [your final reasoning]
Final Answer: [your complete structured response as valid JSON]

Final Answer JSON shape:
{
  "summary": "2-3 sentence overall assessment",
  "techStack": ["identified technologies"],
  "findings": [{ "type": "issue|suggestion|observation", "severity": "high|medium|low", "file": "path or null", "description": "..." }],
  "recommendations": ["actionable recommendation strings"],
  "prDescription": "only if goal was PR description, otherwise omit this field"
}`;
}

function parseReActResponse(rawText) {
  const lines = rawText.split('\n');
  const result = { thought: '' };

  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('Thought:')) {
      result.thought = line.slice('Thought:'.length).trim();
    } else if (line.startsWith('Action:')) {
      result.action = line.slice('Action:'.length).trim();
    } else if (line.startsWith('Action Input:')) {
      const rawInput = line.slice('Action Input:'.length).trim();
      try {
        result.actionInput = JSON.parse(rawInput);
      } catch {
        result.actionInput = {};
      }
    } else if (line.startsWith('Final Answer:')) {
      const rawAnswer = lines.slice(i).join('\n').slice('Final Answer:'.length).trim();
      try {
        result.finalAnswer = JSON.parse(rawAnswer);
      } catch {
        result.finalAnswer = { summary: rawAnswer, findings: [], recommendations: [], techStack: [] };
      }
      break;
    }

    i++;
  }

  if (!result.thought) {
    result.thought = 'Continuing analysis...';
  }

  return result;
}

export { buildSystemPrompt, parseReActResponse };
