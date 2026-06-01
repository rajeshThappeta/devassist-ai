# DevAssist AI — CLAUDE.md (Backend)
## Node.js + Express + Groq + GitHub API + Custom ReAct Agent

---

## ROLE OF THIS LAYER

The backend is a **stateless Express API** with a single primary responsibility: run the ReAct agent loop and stream each step to the frontend via SSE. No database. No auth. No file system. Pure agentic orchestration.

---

## FOLDER STRUCTURE

```
backend/
├── CLAUDE.md                  ← this file
├── package.json
├── .env
└── src/
    ├── agent/
    │   ├── prompt.js          — system prompt builder + ReAct response parser
    │   ├── tools.js           — tool definitions (data) + tool executor (switch)
    │   └── react.loop.js      — the ReAct loop + SSE emitter
    ├── services/
    │   ├── groq.service.js    — all Groq API calls (completion only, no embeddings)
    │   └── github.service.js  — all GitHub REST API calls
    ├── routes/
    │   └── analyze.routes.js  — POST /api/analyze → SSE stream
    ├── middleware/
    │   ├── asyncHandler.js    — wraps async route handlers
    │   └── errorHandler.js    — global error middleware
    ├── app.js                 — Express setup, middleware, routes
    └── server.js              — http.createServer + listen
```

---

## DEPENDENCIES

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "groq-sdk": "^0.x.x",
    "axios": "^1.x.x",
    "cors": "^2.x.x",
    "dotenv": "^16.x.x"
  },
  "devDependencies": {
    "nodemon": "^3.x.x"
  }
}
```

No LangChain. No mongoose. No passport. No bull. No redis. No cohere.

---

## LAYER RESPONSIBILITIES — STRICT

```
analyze.routes.js
    ↓  calls
react.loop.js          (orchestrates the agent, owns the loop, emits SSE)
    ↓  calls
prompt.js              (builds system prompt, parses LLM response)
tools.js               (defines available tools, executes tool calls)
    ↓  calls
groq.service.js        (raw Groq API — completion only)
github.service.js      (raw GitHub API — fetch tree, read file)
```

**No layer skips.** Routes never call services. Services never call other services. The agent layer is the only orchestrator.

---

## FILE-BY-FILE SPECIFICATION

### `src/services/github.service.js`

Responsibilities:
- `fetchRepoTree(owner, repo, branch?)` → returns flat file tree array
- `readFile(owner, repo, path)` → returns decoded file content as string
- `parseRepoUrl(url)` → extracts `{ owner, repo }` from any GitHub URL format

Key rules:
- Use `axios` with `Accept: application/vnd.github.v3+json` header
- If `GITHUB_TOKEN` is set in env, attach as Bearer — otherwise omit (still works for public repos, just lower rate limit)
- `readFile` response is base64 encoded — always `Buffer.from(content, 'base64').toString('utf-8')`
- Throw descriptive errors: "Repository not found", "File not found at path", "GitHub API rate limit exceeded"
- Never return raw GitHub API response shape — always normalize to clean objects

```javascript
// Return shapes
fetchRepoTree()  → [{ path: 'src/app.js', type: 'blob', size: 1234 }, ...]
readFile()       → "raw file content as string"
parseRepoUrl()   → { owner: 'vercel', repo: 'next.js' }
```

---

### `src/services/groq.service.js`

Responsibilities:
- `complete(messages, options?)` → non-streaming Groq completion → returns string
- No streaming method needed here — streaming is handled inside the agent loop via SSE

Key rules:
- Model is always `llama-3.3-70b-versatile` — never make it configurable via request
- `temperature: 0.1` for all agent calls — low randomness = consistent ReAct format
- `max_tokens: 1024` default — agent steps should be concise
- Always return `response.choices[0].message.content` as a plain string
- Wrap in try/catch, throw normalized error with Groq error message

```javascript
// Usage pattern in agent
const rawResponse = await groqService.complete([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: buildHistoryString(history) }
]);
```

---

### `src/agent/tools.js`

Two exports:
1. `TOOL_DEFINITIONS` — array of tool descriptors (used to build system prompt)
2. `executeTool(name, input, context)` — dispatcher that calls the right service

```javascript
// TOOL_DEFINITIONS shape — this gets serialized into the LLM system prompt
const TOOL_DEFINITIONS = [
  {
    name: 'fetch_repo_structure',
    description: 'Fetches the complete file tree of the repository. Use this first to understand what files exist before deciding which to read.',
    parameters: {
      branch: 'string (optional, defaults to main/master)'
    }
  },
  {
    name: 'read_file',
    description: 'Reads the raw content of a specific file. Use the path exactly as returned by fetch_repo_structure.',
    parameters: {
      path: 'string (required) — exact file path from the repo tree'
    }
  },
  {
    name: 'search_files',
    description: 'Filters the file tree to find files matching a pattern. Use when looking for specific file types or names without fetching entire tree again.',
    parameters: {
      pattern: 'string (required) — substring to match against file paths'
    }
  },
  {
    name: 'analyze_package_json',
    description: 'Reads and parses package.json to identify the tech stack, dependencies, and scripts. Use early when the goal involves stack analysis.',
    parameters: {}
  }
];

// executeTool context = { owner, repo, repoTree } — passed through the loop
async function executeTool(name, input, context) {
  switch (name) {
    case 'fetch_repo_structure': ...
    case 'read_file': ...
    case 'search_files': ...
    case 'analyze_package_json': ...
    default: return `Unknown tool: ${name}. Available tools: ${TOOL_DEFINITIONS.map(t => t.name).join(', ')}`;
  }
}
```

Key rules:
- `executeTool` never throws — always returns a string (observation). On error, return the error message as the observation so the agent can reason about it.
- `search_files` operates on `context.repoTree` (cached after first `fetch_repo_structure` call) — does not call GitHub API again
- File content returned by `read_file` should be truncated to 3000 chars max to avoid context window overflow. Append `\n[truncated — file is larger, ask for specific sections if needed]` when truncated.

---

### `src/agent/prompt.js`

Two exports:
1. `buildSystemPrompt(goal, owner, repo, toolDefinitions)` → string
2. `parseReActResponse(rawLLMText)` → `{ thought, action, actionInput }` OR `{ thought, finalAnswer }`

**System prompt structure:**
```
You are DevAssist, an expert code review agent analyzing the GitHub repository {owner}/{repo}.

Goal: {goal}

You have access to these tools:
{serialized tool definitions}

IMPORTANT RULES:
- Always start by fetching the repo structure to understand what exists
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
  "prDescription": "only if goal was PR description, otherwise null"
}
```

**parseReActResponse rules:**
- Split raw text by newlines, look for lines starting with `Thought:`, `Action:`, `Action Input:`, `Final Answer:`
- `Action Input` value → JSON.parse with try/catch → if parse fails, return `{}` (agent will get empty input observation and self-correct)
- `Final Answer` value → JSON.parse with try/catch → if parse fails, wrap raw text in `{ summary: rawText, findings: [], recommendations: [] }`
- Return shape always has `thought` field. Either has `action + actionInput` OR `finalAnswer`. Never both.

---

### `src/agent/react.loop.js`

The core of the entire project. This is what you explain in every interview and consulting conversation.

```javascript
const MAX_ITERATIONS = 8;

async function runReActAgent({ goal, owner, repo, onStep }) {
  const context = { owner, repo, repoTree: null };
  const history = [];
  
  const systemPrompt = buildSystemPrompt(goal, owner, repo, TOOL_DEFINITIONS);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. Build message history for LLM
    const userMessage = history.length === 0
      ? `Begin analysis. Goal: ${goal}`
      : serializeHistory(history);

    // 2. Call Groq
    const rawResponse = await groqService.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);

    // 3. Parse ReAct format
    const parsed = parseReActResponse(rawResponse);

    // 4. Stream this step to frontend
    onStep({ type: 'thought', content: parsed.thought, iteration: i + 1 });

    // 5. Final answer — done
    if (parsed.finalAnswer) {
      onStep({ type: 'final_answer', content: parsed.finalAnswer });
      return parsed.finalAnswer;
    }

    // 6. Execute tool
    onStep({ type: 'action', tool: parsed.action, input: parsed.actionInput });
    const observation = await executeTool(parsed.action, parsed.actionInput, context);
    
    // Cache tree for search_files reuse
    if (parsed.action === 'fetch_repo_structure') {
      context.repoTree = observation;
    }

    onStep({ type: 'observation', content: observation });

    // 7. Append to history
    history.push({
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.actionInput,
      observation
    });
  }

  // Safety exit — MAX_ITERATIONS hit
  onStep({ type: 'error', content: 'Agent reached maximum iterations without a final answer.' });
  return null;
}
```

**`onStep` callback** is how the loop communicates with the route handler. The route handler translates each `onStep` call into an SSE `data:` event.

**`serializeHistory`** converts history array into the continuation string the LLM expects:
```
Thought: [first thought]
Action: fetch_repo_structure
Action Input: {}
Observation: [result]

Thought: [second thought]
Action: read_file
Action Input: {"path": "src/auth.js"}
Observation: [file content]
```

---

### `src/routes/analyze.routes.js`

SSE setup is the only non-trivial part here:

```javascript
router.post('/analyze', asyncHandler(async (req, res) => {
  const { repoUrl, goal } = req.body;
  // validate both fields present
  
  const { owner, repo } = githubService.parseRepoUrl(repoUrl);

  // SSE headers — must be set before any write
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
  res.flushHeaders(); // critical — sends headers immediately

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('start', { owner, repo, goal });

  await runReActAgent({
    goal,
    owner,
    repo,
    onStep: (step) => sendEvent('step', step)
  });

  sendEvent('done', { message: 'Analysis complete' });
  res.end();
}));
```

Key rules:
- `res.flushHeaders()` is mandatory — without it, SSE doesn't start streaming
- Each SSE message needs `\n\n` at the end (double newline) — this is the SSE spec
- `event:` line before `data:` line — frontend uses this to distinguish step types
- `res.end()` on completion — don't leave connections hanging

---

### `src/middleware/asyncHandler.js`

```javascript
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
```

### `src/middleware/errorHandler.js`

```javascript
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // If SSE headers already sent, we can't send JSON error
  if (res.headersSent) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
    return;
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;
```

The SSE header check in errorHandler is critical — Express's default error handler will crash if headers are already sent.

---

### `src/app.js`

```javascript
const express = require('express');
const cors = require('cors');
const analyzeRoutes = require('./routes/analyze.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/analyze', analyzeRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

module.exports = app;
```

---

## GROQ PROMPT ENGINEERING RULES

- `temperature: 0.1` — agent needs deterministic format, not creativity
- Always include format instructions in the system prompt, not the user message
- The system prompt never changes mid-session — only history grows
- If the LLM stops following the ReAct format (no `Thought:` prefix), the parser should return a graceful error observation, not crash
- For the Final Answer JSON, instruct the model to omit the `prDescription` field entirely (not null) when goal is not PR-related

---

## RATE LIMITING AWARENESS

- GitHub API: 60 req/hour unauthenticated, 5000/hour with token
- Groq free tier: ~30 req/min on llama-3.3-70b
- Each agent run = 1 Groq call per iteration (max 8) + up to 4 GitHub calls
- For demo purposes this is fine — no concurrent users expected
- Document these limits clearly in README

---

## TESTING APPROACH

No unit test framework required for POC. Use these manual checkpoints:

1. `github.service.js` — test `fetchRepoTree` and `readFile` with a known public repo (e.g., `expressjs/express`) using a standalone script before integrating
2. `groq.service.js` — test `complete` with a simple prompt before plugging into the agent
3. `react.loop.js` — test with `console.log` as `onStep` before wiring to SSE
4. Full integration — test with Postman using a public GitHub URL + one of the 4 demo goals

---

## COMMON MISTAKES TO AVOID

| Mistake | Correct approach |
|---|---|
| Calling `res.json()` after SSE headers are set | Check `res.headersSent` in error handler |
| Forgetting `res.flushHeaders()` | SSE will buffer instead of stream — add it right after setHeader calls |
| Putting file read logic inside the loop file | Keep it in `github.service.js`, called via `tools.js` |
| Parsing LLM response with fragile regex | Line-by-line string parsing is more robust |
| Not truncating file content | Large files will overflow Groq context window |
| Making MAX_ITERATIONS configurable via request | Hard-code it — this is a security boundary |
