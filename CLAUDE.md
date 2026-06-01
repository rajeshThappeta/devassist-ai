# DevAssist AI — CLAUDE.md (Root)
## Agentic Code Review & PR Intelligence Agent

---

## WHAT THIS PROJECT IS

DevAssist AI is a **portfolio-grade agentic AI application** demonstrating the ReAct (Reasoning + Acting) pattern from scratch — no LangChain, no abstractions. A developer pastes a public GitHub repo URL + describes a goal. The agent autonomously decides which files to fetch, reads them, reasons about what it found, and produces a structured code review / PR description / architecture analysis.

**Core AI pattern being demonstrated:** Custom ReAct agent loop with tool use, multi-step planning, and real-time streaming of agent reasoning to the frontend.

**Portfolio positioning:** This is the third project in a deliberate trilogy:
- HireIQ → RAG + semantic search + Cohere embeddings
- AI Writing Assistant → RAG + content generation pipeline
- DevAssist AI → Agentic loop + tool use + streaming reasoning (NO embeddings, NO vectors — intentionally different)

---

## TECH STACK

### Backend
- **Runtime:** Node.js + Express.js
- **LLM:** Groq API — `llama-3.3-70b-versatile`
- **External Tool:** GitHub REST API v3 (no auth token needed for public repos, optional token for rate limit headroom)
- **Streaming:** Server-Sent Events (SSE) — native Node.js, no socket.io
- **Agent Pattern:** Custom ReAct loop — built from scratch in ~50 lines
- **Error Handling:** Centralized asyncHandler middleware pattern
- **No embeddings, no vector DB** — intentionally does not use Cohere or MongoDB Atlas

### Frontend
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **HTTP:** Axios (REST) + native EventSource API (SSE)
- **State:** React Context + useReducer
- **Real-time UI:** Live agent step rendering (Thought → Action → Observation → Final Answer)

### Deployment
- **Backend:** Render (free tier)
- **Frontend:** Vercel

---

## PROJECT STRUCTURE

```
devassist-ai/
├── CLAUDE.md                  ← this file
├── README.md
├── .gitignore
├── backend/
│   ├── CLAUDE.md
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── agent/
│       │   ├── prompt.js          — system prompt builder + ReAct response parser
│       │   ├── tools.js           — tool definitions array + tool executor
│       │   └── react.loop.js      — the ReAct loop itself
│       ├── services/
│       │   ├── groq.service.js    — all Groq LLM calls
│       │   └── github.service.js  — all GitHub API calls
│       ├── routes/
│       │   └── analyze.routes.js  — POST /api/analyze (SSE streaming)
│       ├── middleware/
│       │   ├── asyncHandler.js
│       │   └── errorHandler.js
│       ├── app.js
│       └── server.js
└── frontend/
    ├── CLAUDE.md
    ├── package.json
    ├── .env
    ├── vite.config.js
    └── src/
        ├── components/
        │   ├── RepoForm.jsx
        │   ├── AgentStream.jsx
        │   ├── StepCard.jsx
        │   └── FinalReport.jsx
        ├── context/
        │   └── AgentContext.jsx
        ├── hooks/
        │   └── useAgentStream.js
        ├── services/
        │   └── api.js
        ├── App.jsx
        └── main.jsx
```

---

## ARCHITECTURAL PRINCIPLES — ENFORCE ALWAYS

### 1. Agent loop is hand-rolled — never suggest a framework
The ReAct loop lives in `backend/src/agent/react.loop.js`. Built manually. This is a deliberate portfolio decision.

### 2. asyncHandler everywhere on the backend
No scattered try/catch in route handlers:
```javascript
router.post('/analyze', asyncHandler(async (req, res) => { ... }));
```

### 3. Strict service layer separation
- Routes call agents
- Agents call services
- Services call external APIs (Groq, GitHub)
- No layer skips. Ever.

### 4. Streaming is SSE, not WebSocket
SSE is simpler, stateless, and sufficient. Agent pushes each step as an SSE event. Frontend consumes with `EventSource`.

### 5. Structured JSON output from Groq
All Groq calls needing parsed output explicitly instruct JSON response. Always parse inside try/catch.

### 6. Tool definitions are data, not hardcoded strings
```javascript
// tools.js — tool list is a plain array
const TOOLS = [
  { name: 'fetch_repo_structure', description: '...', parameters: {...} },
  ...
];
// This array gets serialized into the system prompt dynamically
```

### 7. Hard safety limit on agent loop
```javascript
const MAX_ITERATIONS = 8; // never remove this
```

---

## THE REACT PATTERN — REFERENCE

```
SYSTEM PROMPT tells the LLM:
  "Respond ONLY in this format:
   Thought: [reasoning]
   Action: [tool name]
   Action Input: {"key": "value"}
   
   OR when complete:
   Thought: [reasoning]
   Final Answer: [structured response]"

LOOP:
  history = []
  while (iterations < MAX_ITERATIONS):
    response = groq.call(systemPrompt + serialize(history))
    parsed   = parseReActResponse(response)
    
    if parsed.finalAnswer → stream final event → break
    
    observation = executeTool(parsed.action, parsed.actionInput)
    history.push({ thought, action, actionInput, observation })
    stream SSE event → frontend renders this step live
```

---

## AGENT TOOLS (4 total)

| Tool | GitHub API Endpoint |
|---|---|
| `fetch_repo_structure` | `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` |
| `read_file` | `GET /repos/{owner}/{repo}/contents/{path}` |
| `search_files` | In-memory filter on tree result |
| `analyze_package_json` | Calls `read_file` with `path=package.json` |

---

## DEMO GOALS (4 supported, shown as quick-select in UI)

1. **"Review my authentication flow"**
2. **"Write a PR description for this repo"**
3. **"Analyze the tech stack and architecture"**
4. **"Find performance issues"**

---

## ENVIRONMENT VARIABLES

### Backend `.env`
```
PORT=5000
GROQ_API_KEY=your_groq_key
GITHUB_TOKEN=optional_for_higher_rate_limits
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api
```

---

## WHAT THIS PROJECT MUST NOT HAVE

| Banned | Reason |
|---|---|
| File uploads | Demo reliability — URL input never fails |
| MongoDB / any DB | Stateless by design — no persistence needed |
| JWT / OAuth / Auth | Public demo tool, friction-free |
| Cohere / embeddings | Different AI pattern from HireIQ — intentional |
| LangChain / any agent framework | Hand-rolled loop is the portfolio statement |
| WebSockets / socket.io | SSE is sufficient and simpler |

---

## BUILD ORDER

1. `github.service.js` — test with curl before wiring
2. `groq.service.js` — raw completion + streaming
3. `agent/tools.js` — definitions array + executor switch
4. `agent/prompt.js` — system prompt builder + response parser
5. `agent/react.loop.js` — loop without streaming first, get it working
6. Add SSE streaming into loop
7. `analyze.routes.js` → wires everything together
8. React frontend: form → SSE consumer → live step renderer
9. Final answer renderer — structured report cards
10. Tailwind polish + demo presets (prefill popular OSS repos)

