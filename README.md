# DevAssist AI — Agentic Code Review & PR Intelligence

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)
![Groq](https://img.shields.io/badge/Groq-llama--3.3--70b-F55036?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)

**Live Demo →** https://devassist-ai-ashen.vercel.app

An agentic AI application that takes any public GitHub repository URL and a goal, then autonomously decides which files to read, reasons through them, and produces a structured code review — all streamed live to the browser.

Built to demonstrate the **ReAct (Reasoning + Acting)** pattern from scratch — no LangChain, no agent frameworks. Every line of the agent loop is written by hand.

---

## What It Does

Paste a public GitHub URL. Pick a goal:

| Goal | What the agent does |
|---|---|
| **Analyze tech stack** | Reads `package.json`, scans folder structure, identifies frameworks |
| **Review auth flow** | Searches for auth-related files, reads middleware and route handlers |
| **Write PR description** | Reads changed files, summarizes purpose, writes a formatted description |
| **Find performance issues** | Identifies N+1 patterns, unindexed queries, blocking operations |

The agent doesn't follow a pre-scripted path. It decides the sequence of actions itself — which files to open, in what order, and when it has enough information to answer. The full reasoning chain streams to the UI in real time.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                         │
│  ┌─────────────────┐        ┌──────────────────────────────┐   │
│  │   RepoForm.jsx  │        │       AgentStream.jsx        │   │
│  │  URL + Goal     │        │  🧠 Thought → ⚡ Action →    │   │
│  │  input form     │        │  👁 Observation (live cards) │   │
│  └────────┬────────┘        └──────────────┬───────────────┘   │
│           │  GET /api/analyze?...           │ EventSource SSE   │
└───────────┼─────────────────────────────────┼───────────────────┘
            │                                 │
            ▼                                 │ stream steps
┌─────────────────────────────────────────────────────────────────┐
│  Express Backend (Node.js)                                      │
│                                                                 │
│  analyze.routes.js                                              │
│  └─► Sets SSE headers → res.flushHeaders()                      │
│      └─► runReActAgent({ goal, owner, repo, onStep })           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ReAct Loop  (MAX_ITERATIONS = 8)                        │   │
│  │                                                          │   │
│  │  ┌─────────┐    ┌─────────┐    ┌──────────┐             │   │
│  │  │  THINK  │───►│  PARSE  │───►│  EXECUTE │             │   │
│  │  │  Groq   │    │response │    │  tool    │             │   │
│  │  │  LLM    │    │         │    │          │             │   │
│  │  └─────────┘    └────┬────┘    └────┬─────┘             │   │
│  │       ▲              │ Final        │ Observation        │   │
│  │       │              │ Answer       ▼                    │   │
│  │       └──────────────┼──── history.push(step)           │   │
│  │                      │                                   │   │
│  │                      ▼                                   │   │
│  │              stream final answer                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tools (GitHub REST API)                                        │
│  ├─ fetch_repo_structure → GET /repos/{owner}/{repo}/git/trees  │
│  ├─ read_file            → GET /repos/{owner}/{repo}/contents   │
│  ├─ search_files         → in-memory filter on cached tree      │
│  └─ analyze_package_json → read_file with path=package.json     │
└─────────────────────────────────────────────────────────────────┘
```

---

## The ReAct Pattern — Explained

ReAct stands for **Reasoning + Acting**. It's a loop where an LLM alternates between thinking about what to do and taking an action based on that thought, then observing the result and thinking again.

### How a RAG pipeline differs

In a RAG pipeline, the flow is linear and predetermined:
```
user question → embed → retrieve chunks → LLM generates answer
```

The retrieval path is fixed. The system doesn't decide what to look for — it responds to a vector similarity search.

### How the ReAct agent works

```
goal → THINK → ACT → OBSERVE → THINK → ACT → OBSERVE → ... → FINAL ANSWER
```

Each iteration the LLM receives the full conversation history and decides what to do next. It can change strategy based on what it found. If searching for auth files returns nothing, it might try a different pattern. If `package.json` reveals a specific framework, it knows which files to look at next.

### The structured prompt contract

The system prompt instructs the LLM to respond in a strict format:

```
Thought: I need to understand the project structure before deciding which files are relevant.
Action: fetch_repo_structure
Action Input: {}
```

Or when done:

```
Thought: I have enough information about the authentication implementation.
Final Answer: {"summary": "...", "findings": [...], "recommendations": [...]}
```

The backend parses this format line by line — no regex, just string prefix matching — and routes the response to either tool execution or final answer delivery.

### The loop in full

```javascript
// backend/src/agent/react.loop.js

const MAX_ITERATIONS = 8; // hard cap — never configurable via request

async function runReActAgent({ goal, owner, repo, onStep }) {
  const context = { owner, repo, repoTree: null };
  const history = [];
  const systemPrompt = buildSystemPrompt(goal, owner, repo, TOOL_DEFINITIONS);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // LLM has no persistent memory — pass the full history each call
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

    onStep({ type: 'action', tool: parsed.action, input: parsed.actionInput });
    const observation = await executeTool(parsed.action, parsed.actionInput, context);
    onStep({ type: 'observation', content: observation });

    history.push({ thought: parsed.thought, action: parsed.action,
                   actionInput: parsed.actionInput, observation });
  }

  onStep({ type: 'error', content: 'Agent reached maximum iterations without a final answer.' });
  return null;
}
```

Three things to understand here:

**History serialization** — The LLM has no memory between API calls. `serializeHistory()` converts the accumulated steps into a plain text transcript and passes it as the user message on every call. This is how the agent "remembers" what it already tried.

**`onStep` callback** — This is the bridge between the agent loop and the HTTP response. Every step gets streamed to the frontend the moment it happens, not buffered until completion.

**Tools never throw** — `executeTool` catches all errors internally and returns them as plain strings. The agent observes the error message and can self-correct on the next iteration. This keeps the loop resilient without exception propagation.

---

## SSE Streaming

The frontend opens an `EventSource` connection which keeps the HTTP response alive for the duration of the analysis.

```javascript
// Backend — analyze.routes.js
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders(); // sends headers immediately — critical for SSE

const sendEvent = (eventType, data) => {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`); // double newline = SSE spec
};
```

```javascript
// Frontend — useAgentStream.js
const es = new EventSource(`/api/analyze?repoUrl=${...}&goal=${...}`);

es.addEventListener('step', (e) => {
  const step = JSON.parse(e.data);
  dispatch({ type: 'ADD_STEP', payload: step });
});

es.addEventListener('done', () => { es.close(); });
es.addEventListener('error', (e) => { /* parse error, show message */ });
```

Each step type renders as a different card in the UI with its own colour:

| Event `type` | Visual | Colour |
|---|---|---|
| `thought` | 🧠 Brain — typewriter animation | Pink tint |
| `action` | ⚡ Action — tool name + params | Amber tint |
| `observation` | 👁 Observation — collapsible | Gray tint |
| `final_answer` | — triggers `FinalReport.jsx` | — |
| `error` | ✕ Error card | Red tint |

`EventSource` is GET-only — no POST body. The route accepts `repoUrl` and `goal` as query parameters.

---

## Project Structure

```
devassist-ai/
├── render.yaml                      ← Render Blueprint (rootDir: backend)
├── backend/
│   ├── package.json
│   ├── jsconfig.json                ← NodeNext module resolution
│   ├── .env.example
│   └── src/
│       ├── server.js                ← http.createServer + listen on PORT
│       ├── app.js                   ← Express setup, CORS, routes, error handler
│       ├── agent/
│       │   ├── react.loop.js        ← The ReAct loop — the core of the project
│       │   ├── prompt.js            ← System prompt builder + response parser
│       │   └── tools.js             ← Tool definitions array + executor switch
│       ├── services/
│       │   ├── groq.service.js      ← Groq API wrapper (lazy client init)
│       │   └── github.service.js    ← GitHub REST API (tree, file, URL parser)
│       ├── routes/
│       │   └── analyze.routes.js    ← GET /api/analyze — SSE streaming route
│       └── middleware/
│           ├── asyncHandler.js      ← Promise.resolve().catch(next) wrapper
│           └── errorHandler.js      ← SSE-aware global error handler
└── frontend/
    ├── package.json
    ├── vite.config.js               ← Vite proxy → localhost:6000 in dev
    ├── tailwind.config.js           ← Custom pink/amber/zinc palette + animations
    ├── .env.example
    └── src/
        ├── main.jsx                 ← React 18 entry, wraps AgentProvider
        ├── App.jsx                  ← Layout: header → form → stream → report
        ├── context/
        │   └── AgentContext.jsx     ← useReducer: status, steps[], finalReport
        ├── hooks/
        │   └── useAgentStream.js    ← EventSource lifecycle + dispatch
        ├── services/
        │   └── api.js               ← Axios instance (for non-SSE calls)
        └── components/
            ├── RepoForm.jsx         ← URL input + 4 quick-goal buttons
            ├── AgentStream.jsx      ← Live step list, reasoning/fetching placeholders
            ├── StepCard.jsx         ← Per-type card with typewriter on thought
            └── FinalReport.jsx      ← Summary, tech stack, findings, recommendations
```

---

## Agent Tools

```javascript
// backend/src/agent/tools.js

const TOOL_DEFINITIONS = [
  {
    name: 'fetch_repo_structure',
    description: 'Fetches the complete file tree. Use this first.',
    parameters: { branch: 'string (optional, defaults to HEAD)' }
  },
  {
    name: 'read_file',
    description: 'Reads a specific file. Use the exact path from fetch_repo_structure.',
    parameters: { path: 'string (required)' }
  },
  {
    name: 'search_files',
    description: 'Filters the cached file tree by substring pattern. Does not call GitHub again.',
    parameters: { pattern: 'string (required)' }
  },
  {
    name: 'analyze_package_json',
    description: 'Reads package.json to identify the tech stack and dependencies.',
    parameters: {}
  }
];
```

`TOOL_DEFINITIONS` is a plain data array — it gets serialized into the system prompt so the LLM knows what tools exist and how to call them. The executor is a switch statement that maps tool names to service calls.

`search_files` is intentionally in-memory. After the first `fetch_repo_structure` call, the tree is cached in `context.repoTree`. Pattern matching is done locally — no second GitHub API call needed.

File content is truncated at **3000 characters** to prevent Groq context window overflow. A `[truncated]` notice is appended so the agent can ask for specific sections if needed.

---

## Response Parsing

```javascript
// backend/src/agent/prompt.js — parseReActResponse()

function parseReActResponse(rawText) {
  const lines = rawText.split('\n');
  const result = { thought: '' };

  while (i < lines.length) {
    if (line.startsWith('Thought:'))      result.thought = line.slice(8).trim();
    else if (line.startsWith('Action:'))  result.action = line.slice(7).trim();
    else if (line.startsWith('Action Input:')) {
      try { result.actionInput = JSON.parse(line.slice(13).trim()); }
      catch { result.actionInput = {}; }          // graceful — agent self-corrects
    }
    else if (line.startsWith('Final Answer:')) {
      try { result.finalAnswer = JSON.parse(remaining); }
      catch { result.finalAnswer = { summary: rawText, findings: [], recommendations: [] }; }
      break;
    }
  }
  return result;
}
```

Line-by-line prefix matching — not regex. Regex breaks on multi-line action inputs. JSON parse failures are handled gracefully: `actionInput` falls back to `{}` (the agent observes an empty input and adjusts), and `finalAnswer` falls back to wrapping the raw text in a valid shape.

---

## Local Setup

### Prerequisites

- Node.js 18+
- [Groq API key](https://console.groq.com) — free tier is sufficient
- GitHub token — optional, raises rate limit from 60 to 5000 req/hour

### Backend

```bash
cd backend
npm install

cp .env.example .env
# Fill in GROQ_API_KEY in .env
```

```env
PORT=6000
NODE_ENV=development
GROQ_API_KEY=gsk_...
GITHUB_TOKEN=ghp_...          # optional
FRONTEND_URL=http://localhost:5173
```

```bash
npm run dev
# → DevAssist AI backend running on port 6000
```

Verify: `curl http://localhost:6000/health` → `{"status":"ok"}`

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:6000` — no CORS issues in development.

### Test the agent directly

```bash
curl "http://localhost:6000/api/analyze?\
repoUrl=https://github.com/expressjs/express\
&goal=Analyze+the+tech+stack+and+architecture"
```

You should see SSE events streaming:
```
event: start
data: {"owner":"expressjs","repo":"express","goal":"..."}

event: step
data: {"type":"thought","content":"I need to fetch the repo structure first...","iteration":1}

event: step
data: {"type":"action","tool":"fetch_repo_structure","input":{}}
...
```

---

## Deployment

### Backend → Render

`render.yaml` at the repo root configures the service:

```yaml
services:
  - type: web
    name: devassist-ai-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: node src/server.js
```

**Environment variables to set in Render dashboard:**

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |
| `GITHUB_TOKEN` | Your GitHub token (optional) |
| `FRONTEND_URL` | Your Vercel deployment URL |
| `NODE_ENV` | `production` |

### Frontend → Vercel

`vercel.json` configures the build:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Environment variable to set in Vercel dashboard:**

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-render-app.onrender.com/api` |

**Deployment order:**
1. Deploy backend to Render first → get the Render URL
2. Deploy frontend to Vercel with Render URL as `VITE_API_URL`
3. Update `FRONTEND_URL` on Render to the Vercel URL
4. Render auto-redeploys

---

## Design Decisions

**No LangChain or agent framework**

The ReAct loop in `react.loop.js` is ~50 lines. Building it manually makes the pattern explicit — you see exactly how history accumulates, how tool results feed back into the LLM context, and where the safety boundaries are. Frameworks abstract this away. For a portfolio project demonstrating the pattern, that abstraction defeats the purpose.

**No embeddings, no vector database**

This project intentionally uses a different AI pattern from RAG-based projects. The "knowledge source" is GitHub's REST API, fetched on demand by the agent during runtime. There is no pre-built index, no similarity search, no persistent storage. The agent decides what to retrieve based on reasoning, not vector proximity.

**SSE over WebSockets**

SSE is unidirectional (server → client), stateless, and works over plain HTTP. For streaming agent steps to a browser, it's the right tool. WebSockets add bidirectional complexity that this use case doesn't need.

**`asyncHandler` middleware pattern**

All route handlers are wrapped in `asyncHandler` — a one-liner that catches rejected promises and forwards them to the error handler. No try/catch blocks in routes.

**SSE-aware error handler**

The global error handler checks `res.headersSent` before deciding the response format. Once SSE headers are flushed, you can't send JSON — the handler falls back to writing an `event: error` SSE message instead.

**Lazy Groq client initialization**

```javascript
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
```

With ES modules, top-level code runs before `dotenv/config` has time to populate `process.env`. Initializing the client lazily on first call ensures the API key is available when it's actually needed.

---

## Rate Limits

| Service | Free Tier Limit | Impact |
|---|---|---|
| Groq | 30 req/min, 100k tokens/day | Each analysis uses up to 8 LLM calls |
| GitHub (no token) | 60 req/hour per IP | Each analysis uses 1–5 GitHub calls |
| GitHub (with token) | 5000 req/hour | Comfortable for demo use |
| Render (free tier) | Spins down after 15 min idle | First request after idle takes ~30–60s |

If analysis fails with no visible error, wait 60 seconds and retry — the Groq per-minute limit resets.

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Groq — `llama-3.3-70b-versatile` |
| Backend runtime | Node.js 18+ with ES Modules |
| Backend framework | Express 4.19 |
| GitHub integration | GitHub REST API v3 via Axios |
| Streaming | Server-Sent Events (SSE) |
| Frontend framework | React 18.3 + Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| Backend deployment | Render |
| Frontend deployment | Vercel |

---

## Part of a Portfolio Series

This project is the third in a deliberate series of AI application patterns — each using a different architecture:

| Project | Pattern | AI Stack |
|---|---|---|
| [HireIQ](https://hireiq-frontend-sigma.vercel.app) | RAG + semantic search | Cohere embeddings + MongoDB Atlas Vector |
| [AI Writing Assistant](https://ai-blogapp-frontend.vercel.app) | RAG + generation pipeline | Groq + MongoDB Atlas |
| **DevAssist AI** | **Agentic loop + tool use** | **Groq only — no embeddings, no vector DB** |

The contrast is intentional. RAG retrieves from a pre-built index. Agents reason about what to retrieve at runtime. Different problems, different architectures.

---

## License

MIT
