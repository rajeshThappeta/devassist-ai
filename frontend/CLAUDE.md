# DevAssist AI — CLAUDE.md (Frontend)
## React + Vite + Tailwind + SSE Consumer

---

## ROLE OF THIS LAYER

The frontend has one job: provide a clean input form and render the agent's live reasoning chain as it streams in. The visual "wow factor" of this app is watching the agent think in real time — Thought → Action → Observation → Final Answer appearing step by step.

**This is not a complex frontend.** Resist the urge to over-engineer. The agent is the product. The UI is a window into it.

---

## FOLDER STRUCTURE

```
frontend/
├── CLAUDE.md                  ← this file
├── package.json
├── vite.config.js
├── tailwind.config.js
├── .env
└── src/
    ├── components/
    │   ├── RepoForm.jsx        — URL input + goal selector + submit
    │   ├── AgentStream.jsx     — renders live step cards as they arrive
    │   ├── StepCard.jsx        — single thought/action/observation block
    │   └── FinalReport.jsx     — renders the structured final answer
    ├── context/
    │   └── AgentContext.jsx    — global state: status, steps[], finalReport
    ├── hooks/
    │   └── useAgentStream.js   — SSE connection + event parsing + dispatch
    ├── services/
    │   └── api.js              — Axios instance (only for non-SSE calls if any)
    ├── App.jsx
    └── main.jsx
```

---

## DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^18.x.x",
    "react-dom": "^18.x.x",
    "axios": "^1.x.x",
    "tailwindcss": "^3.x.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x.x",
    "vite": "^5.x.x",
    "autoprefixer": "^10.x.x",
    "postcss": "^8.x.x"
  }
}
```

No React Router needed — this is a single-page, single-view app.
No Recharts needed — no charts in this project.
No auth library — no login flow.

---

## STATE ARCHITECTURE

### AgentContext shape
```javascript
{
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error',
  repoUrl: '',
  goal: '',
  steps: [
    // Each SSE step event becomes one entry here
    { type: 'thought', content: '...', iteration: 1 },
    { type: 'action', tool: 'fetch_repo_structure', input: {} },
    { type: 'observation', content: '...' },
    { type: 'thought', content: '...', iteration: 2 },
    ...
  ],
  finalReport: null | {
    summary: '...',
    techStack: [],
    findings: [],
    recommendations: [],
    prDescription: null
  },
  error: null
}
```

### Actions (useReducer)
```javascript
{ type: 'START_ANALYSIS', payload: { repoUrl, goal } }
{ type: 'ADD_STEP', payload: step }
{ type: 'SET_FINAL_REPORT', payload: report }
{ type: 'SET_ERROR', payload: message }
{ type: 'RESET' }
```

---

## SSE CONSUMPTION — THE KEY PATTERN

**Use native `EventSource` via `useAgentStream.js` hook — not Axios, not fetch.**

The backend sends named SSE events (`event: step`, `event: done`, `event: error`). `EventSource` handles reconnection automatically, but for this app we close the connection manually on `done` or `error`.

```javascript
// useAgentStream.js — full pattern
function useAgentStream() {
  const { dispatch } = useContext(AgentContext);

  const startAnalysis = async (repoUrl, goal) => {
    dispatch({ type: 'START_ANALYSIS', payload: { repoUrl, goal } });

    // SSE doesn't support POST body — we first POST to get a session token
    // OR we encode params in URL — for POC, use GET with query params
    // OR we switch backend to GET /api/analyze?repoUrl=...&goal=...
    
    // For POC simplicity: use query params on GET
    const url = `${import.meta.env.VITE_API_URL}/analyze?repoUrl=${encodeURIComponent(repoUrl)}&goal=${encodeURIComponent(goal)}`;
    
    const es = new EventSource(url);

    es.addEventListener('step', (e) => {
      const step = JSON.parse(e.data);
      dispatch({ type: 'ADD_STEP', payload: step });
      
      if (step.type === 'final_answer') {
        dispatch({ type: 'SET_FINAL_REPORT', payload: step.content });
      }
    });

    es.addEventListener('done', () => {
      es.close();
      dispatch({ type: 'SET_STATUS', payload: 'complete' });
    });

    es.addEventListener('error', (e) => {
      es.close();
      dispatch({ type: 'SET_ERROR', payload: 'Analysis failed. Please try again.' });
    });
  };

  return { startAnalysis };
}
```

**Important:** Because `EventSource` only supports GET, the backend route should be `GET /api/analyze?repoUrl=...&goal=...` not POST. Update backend `analyze.routes.js` accordingly.

Alternatively (cleaner for demo): POST first to `/api/analyze/start` → get back a `sessionId` → then `EventSource` to `GET /api/analyze/stream/:sessionId`. But for POC, query params on GET is fine.

---

## COMPONENT SPECIFICATIONS

### `RepoForm.jsx`

```
State: repoUrl (string), selectedGoal (string)

UI:
  - Text input: "Paste a public GitHub repo URL"
    placeholder: "https://github.com/owner/repo"
  - Goal selector: 4 buttons (quick-select) + optional free text input
    Quick goals:
      [ Review auth flow ]  [ Write PR description ]
      [ Analyze tech stack ]  [ Find performance issues ]
  - Submit button: "Analyze Repo →"
    Disabled when: repoUrl empty OR no goal selected OR status !== 'idle'
  - Reset button (shown when status === 'complete' or 'error'): "Analyze Another"
    onClick: dispatch RESET

Validation:
  - repoUrl must start with "https://github.com/" — show inline error otherwise
  - goal must be non-empty

On submit:
  - Call startAnalysis(repoUrl, goal) from useAgentStream hook
```

---

### `AgentStream.jsx`

```
Renders: context.steps array as a vertical timeline
Each step → <StepCard step={step} />
Auto-scrolls to bottom as new steps arrive (useEffect with ref on container div)

Show when status === 'streaming' or 'complete'
Show a pulsing "Agent is thinking..." indicator when status === 'streaming' and last step was 'action' (waiting for observation)

Do NOT render FinalReport here — render it as a sibling below AgentStream in App.jsx
```

---

### `StepCard.jsx`

Different visual treatment per step type:

```
type: 'thought'
  Icon: 🧠 or brain icon
  Label: "Thought"  (subtle, gray)
  Background: subtle blue tint
  Content: thought text

type: 'action'
  Icon: ⚡ or zap icon
  Label: "Action"  (subtle, gray)
  Background: subtle yellow tint
  Content: tool name (bold) + formatted input params
  e.g.: "fetch_repo_structure" with no params
        "read_file" → path: src/middleware/auth.js

type: 'observation'
  Icon: 👁 or eye icon
  Label: "Observation"  (subtle, gray)
  Background: subtle green tint
  Content: truncated observation (first 200 chars + "..." expand button)
  Long observations should be collapsible — default collapsed

type: 'error'
  Icon: ❌
  Background: red tint
  Content: error message
```

Animate each card in with a simple fade-in + slide-up (Tailwind `animate-` or CSS transition). This makes the streaming feel alive.

---

### `FinalReport.jsx`

Renders `context.finalReport` as structured cards. Only shown when `status === 'complete'`.

```
Sections:

1. Summary card
   - Large text, prominent placement
   - Tech stack badges (pill chips): React, Node.js, MongoDB...

2. Findings list
   Each finding:
   - Severity badge: HIGH (red) / MEDIUM (amber) / LOW (blue)
   - Type badge: issue / suggestion / observation
   - File path (monospace, if present)
   - Description text

3. Recommendations list
   Numbered list, each item is an actionable string
   Clean typography, readable

4. PR Description (if present)
   Code block / textarea style
   "Copy to clipboard" button

Visual hierarchy:
  Summary → Tech Stack → Findings → Recommendations → PR Description
```

---

## UI/UX PRINCIPLES

### The streaming IS the product
The live reasoning chain is what differentiates this demo from a static analysis tool. Design the streaming view to be the most prominent element — not tucked away.

### Dark theme preferred
Developer tool → dark theme is natural. `bg-gray-950` base, `gray-800` cards, syntax highlight colors for code snippets.

### Minimal chrome
No navbar. No sidebar. No footer with links. Just: logo/title at top → form → output. The tool should feel focused.

### Demo-ready defaults
Pre-fill the URL input with a popular public repo for instant demo:
- Default URL: `https://github.com/expressjs/express`
- Default goal: "Analyze the tech stack and architecture"

This means a recruiter/CTO can click the demo link and hit Analyze immediately without typing anything.

### Responsive but not mobile-first
This is a developer tool. Desktop layout is primary. Ensure it doesn't break on tablet. Mobile is not a requirement for portfolio demo.

---

## TAILWIND CONVENTIONS FOR THIS PROJECT

```javascript
// Color tokens to use consistently
bg-gray-950    // page background
bg-gray-900    // card background
bg-gray-800    // input background
border-gray-700 // borders

// Step card accent colors
bg-blue-950 border-blue-800   // thought
bg-yellow-950 border-yellow-800 // action
bg-green-950 border-green-800  // observation
bg-red-950 border-red-800     // error

// Severity badges
bg-red-500/20 text-red-400 border border-red-500/30     // HIGH
bg-amber-500/20 text-amber-400 border border-amber-500/30 // MEDIUM
bg-blue-500/20 text-blue-400 border border-blue-500/30   // LOW

// Tech stack pills
bg-gray-700 text-gray-300 rounded-full px-3 py-1 text-sm
```

---

## LOADING & TRANSITION STATES

| Status | What to show |
|---|---|
| `idle` | Form only |
| `connecting` | Form (disabled) + subtle "Connecting..." text |
| `streaming` | Form (hidden or minimized) + AgentStream with pulsing indicator |
| `complete` | AgentStream (full, no pulse) + FinalReport + "Analyze Another" button |
| `error` | Error message card + "Try Again" button |

Never show a blank screen during any transition.

---

## `src/services/api.js`

Minimal — only needed if any non-SSE endpoints exist:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

export default api;
```

No auth interceptor needed — no JWT in this project.

---

## VITE CONFIG

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // SSE proxy needs these:
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'text/event-stream');
          });
        }
      }
    }
  }
});
```

The proxy config for SSE is important in dev — without the Accept header, some proxy setups buffer SSE incorrectly.

---

## COMMON MISTAKES TO AVOID

| Mistake | Correct approach |
|---|---|
| Using `fetch` with streaming for SSE | Use native `EventSource` — it's built for SSE |
| Not closing `EventSource` on done/error | Memory leak — always `es.close()` |
| Showing full observation text by default | Truncate + collapse — long file content destroys readability |
| Forgetting auto-scroll on step add | `useEffect([steps])` → scroll container ref to bottom |
| Treating `EventSource` like a POST request | EventSource is GET only — adjust backend route |
| Complex state management | Context + useReducer is sufficient — no Redux/Zustand needed |
| Rendering FinalReport before stream completes | Gate on `status === 'complete'` not on `finalReport !== null` |

---

## KEY DEMO TALKING POINTS (for interviews/consulting pitches)

When demoing this app, these are the technical points to highlight:

1. **"The agent is deciding what to read"** — it's not pre-scripted. It uses the file tree to reason about which files are relevant to the goal.

2. **"Each Thought/Action/Observation is a Groq LLM call"** — you can see the token-level reasoning.

3. **"The ReAct loop is 50 lines of Node.js"** — no framework. I understand what LangChain abstracts because I built it from scratch.

4. **"SSE streams each step in real time"** — the UI updates as the agent reasons, not after it's done.

5. **"Tools are just GitHub API calls"** — the "intelligence" is in the reasoning loop, not the tools themselves. This is the core insight of agentic AI.
