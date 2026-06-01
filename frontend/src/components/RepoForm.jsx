import { useState } from 'react';
import { useAgent } from '../context/AgentContext.jsx';
import { useAgentStream } from '../hooks/useAgentStream.js';

const QUICK_GOALS = [
  { label: 'Review auth flow',         value: 'Review my authentication flow' },
  { label: 'Write PR description',     value: 'Write a PR description for this repo' },
  { label: 'Analyze tech stack',       value: 'Analyze the tech stack and architecture' },
  { label: 'Find performance issues',  value: 'Find performance issues' },
];

const DEFAULT_REPO = 'https://github.com/expressjs/express';
const DEFAULT_GOAL = 'Analyze the tech stack and architecture';

export default function RepoForm() {
  const { state } = useAgent();
  const { startAnalysis, reset } = useAgentStream();

  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO);
  const [goal, setGoal]       = useState(DEFAULT_GOAL);
  const [urlError, setUrlError] = useState('');

  const isIdle = state.status === 'idle';
  const isDone = state.status === 'complete' || state.status === 'error';
  const isActive = !isIdle && !isDone;

  function handleUrlChange(e) {
    setRepoUrl(e.target.value);
    if (urlError) setUrlError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!repoUrl.startsWith('https://github.com/')) {
      setUrlError('Must be a valid GitHub URL — https://github.com/owner/repo');
      return;
    }
    startAnalysis(repoUrl, goal);
  }

  /* ── minimised strip shown while agent is running ── */
  if (isActive) {
    return (
      <div className="animate-fade-in bg-white border border-zinc-200 rounded-xl shadow-sm px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-mono font-medium text-zinc-800 truncate">{state.repoUrl}</p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{state.goal}</p>
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs bg-pink-100 text-pink-700 px-3 py-1.5 rounded-full font-semibold">
          <span className="h-1.5 w-1.5 bg-pink-500 rounded-full animate-pulse" />
          {state.status === 'connecting' ? 'Connecting' : 'Analyzing'}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6 mb-8 animate-fade-in"
    >
      {/* URL input */}
      <div className="mb-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
          GitHub Repository URL
        </label>
        <input
          type="text"
          value={repoUrl}
          onChange={handleUrlChange}
          placeholder="https://github.com/owner/repo"
          className={`w-full px-4 py-3 rounded-lg border text-sm font-mono bg-zinc-50 text-zinc-900
            placeholder-zinc-400 transition-all focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent
            ${urlError ? 'border-red-400 bg-red-50' : 'border-zinc-200 hover:border-zinc-300'}`}
        />
        {urlError && (
          <p className="mt-1.5 text-xs text-red-600 font-medium">{urlError}</p>
        )}
      </div>

      {/* Goal quick-select */}
      <div className="mb-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Analysis Goal
        </label>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_GOALS.map(({ label, value }) => {
            const active = goal === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setGoal(value)}
                className={`px-3 py-2.5 rounded-lg text-sm text-left leading-snug transition-all border font-medium
                  ${active
                    ? 'bg-amber-400 border-amber-400 text-zinc-900 shadow-sm'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      {isDone ? (
        <button
          type="button"
          onClick={reset}
          className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold py-3 px-4 rounded-lg text-sm transition-colors"
        >
          Analyze Another Repo
        </button>
      ) : (
        <button
          type="submit"
          disabled={!repoUrl || !goal}
          className="w-full bg-pink-600 hover:bg-pink-700 active:bg-pink-800
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-semibold py-3 px-4 rounded-lg text-sm transition-colors
            flex items-center justify-center gap-2 shadow-sm"
        >
          Analyze Repo
          <span className="text-base leading-none">→</span>
        </button>
      )}
    </form>
  );
}
