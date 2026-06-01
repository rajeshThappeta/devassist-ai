import { useState, useEffect } from 'react';

const OBS_PREVIEW = 220;

const CONFIGS = {
  thought: {
    text:  'Thought',
    icon:  '🧠',
    wrap:  'bg-pink-50 border-l-[3px] border-pink-400',
    badge: 'bg-pink-100 text-pink-700',
  },
  action: {
    text:  'Action',
    icon:  '⚡',
    wrap:  'bg-amber-50 border-l-[3px] border-amber-400',
    badge: 'bg-amber-100 text-amber-700',
  },
  observation: {
    text:  'Observation',
    icon:  '👁',
    wrap:  'bg-zinc-50 border-l-[3px] border-zinc-300',
    badge: 'bg-zinc-100 text-zinc-600',
  },
  error: {
    text:  'Error',
    icon:  '✕',
    wrap:  'bg-red-50 border-l-[3px] border-red-400',
    badge: 'bg-red-100 text-red-700',
  },
};

/* Typewriter — animates text in character by character */
function TypewriterText({ text, speed = 16 }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  const done = displayed.length >= (text?.length ?? 0);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-[13px] bg-pink-500 ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}

function ActionContent({ step }) {
  const hasParams = step.input && Object.keys(step.input).length > 0;
  return (
    <div>
      <span className="font-mono text-sm font-semibold text-zinc-800">{step.tool}</span>
      {hasParams && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {Object.entries(step.input).map(([k, v]) => (
            <span key={k} className="text-xs">
              <span className="text-zinc-400">{k}:</span>{' '}
              <span className="font-mono text-zinc-600">{String(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ObservationContent({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > OBS_PREVIEW;
  return (
    <div>
      <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">
        {isLong && !expanded ? text.slice(0, OBS_PREVIEW) + '…' : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs font-semibold text-pink-600 hover:text-pink-700 transition-colors"
        >
          {expanded ? '↑ Show less' : '↓ Show more'}
        </button>
      )}
    </div>
  );
}

export default function StepCard({ step }) {
  const cfg = CONFIGS[step.type] ?? CONFIGS.observation;

  const body = step.type === 'action'
    ? <ActionContent step={step} />
    : step.type === 'observation'
      ? <ObservationContent text={step.content ?? ''} />
      : <p className="text-sm text-zinc-700 leading-relaxed">
          <TypewriterText text={step.content ?? ''} />
        </p>;

  /* Action cards stagger 150ms after the thought that preceded them */
  const delay = step.type === 'action' ? '150ms' : '0ms';

  return (
    <div
      className={`animate-slide-in rounded-lg px-4 py-3 border border-transparent ${cfg.wrap}`}
      style={{ animationDelay: delay, opacity: 0 }}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-sm mt-0.5 select-none">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.badge}`}>
              {cfg.text}
            </span>
            {step.iteration && (
              <span className="text-[10px] text-zinc-400 font-medium">#{step.iteration}</span>
            )}
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}
