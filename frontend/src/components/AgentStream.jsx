import { useEffect, useRef } from 'react';
import { useAgent } from '../context/AgentContext.jsx';
import StepCard from './StepCard.jsx';

function ThinkingPlaceholder({ label, color }) {
  return (
    <div className={`mt-2 flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed ${color}`}>
      <div className="flex gap-1">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full animate-bounce bg-current opacity-40"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

export default function AgentStream() {
  const { state } = useAgent();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.steps.length]);

  if (state.status === 'idle') return null;

  const isStreaming = state.status === 'streaming' || state.status === 'connecting';
  const visibleSteps = state.steps.filter(s => s.type !== 'final_answer');
  const lastStep = visibleSteps[visibleSteps.length - 1];

  /* gap 1 — after observation, waiting for next Groq call */
  const waitingForThought = isStreaming && lastStep?.type === 'observation';
  /* gap 2 — after action, waiting for GitHub API */
  const waitingForObs     = isStreaming && lastStep?.type === 'action';

  return (
    <div className="mb-8 animate-fade-in">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-zinc-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Agent Reasoning Chain
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-xs text-pink-600 font-semibold">
              <span className="h-1.5 w-1.5 bg-pink-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* Step cards */}
      <div className="space-y-2">
        {visibleSteps.map((step, i) => (
          <StepCard key={i} step={step} />
        ))}
      </div>

      {/* Gap 1 — waiting for Groq to reason */}
      {waitingForThought && (
        <ThinkingPlaceholder
          label="Agent is reasoning…"
          color="border-pink-200 text-pink-500 bg-pink-50"
        />
      )}

      {/* Gap 2 — waiting for GitHub fetch */}
      {waitingForObs && (
        <ThinkingPlaceholder
          label="Fetching from GitHub…"
          color="border-zinc-200 text-zinc-400 bg-zinc-50"
        />
      )}

      {/* Initial connecting state */}
      {state.status === 'connecting' && visibleSteps.length === 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-50 border border-dashed border-zinc-300 rounded-lg">
          <span className="h-2 w-2 bg-pink-500 rounded-full animate-pulse" />
          <span className="text-xs text-zinc-500">Connecting to agent…</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
