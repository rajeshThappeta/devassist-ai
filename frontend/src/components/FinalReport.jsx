import { useState } from 'react';
import { useAgent } from '../context/AgentContext.jsx';

const SEVERITY = {
  high:   'bg-pink-100 text-pink-700 border border-pink-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  low:    'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

const FINDING_TYPE = {
  issue:       'text-red-600 bg-red-50',
  suggestion:  'text-blue-600 bg-blue-50',
  observation: 'text-zinc-500 bg-zinc-50',
};

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-0.5 bg-pink-500 rounded-full" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">{title}</h3>
      </div>
      {count != null && (
        <span className="text-xs text-zinc-400 font-medium">{count} item{count !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

export default function FinalReport() {
  const { state } = useAgent();
  const [copied, setCopied] = useState(false);

  if (state.status !== 'complete' || !state.finalReport) return null;

  const { summary, techStack = [], findings = [], recommendations = [], prDescription } = state.finalReport;

  function copyPr() {
    navigator.clipboard.writeText(prDescription).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4 animate-slide-in">
      {/* Report title bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Analysis Report</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* Summary + Tech Stack */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
        <SectionHeader title="Summary" />
        <p className="text-sm text-zinc-700 leading-relaxed mb-4">{summary}</p>
        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {techStack.map(tech => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 bg-amber-400 text-zinc-900 px-3 py-0.5 rounded-full text-xs font-bold"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <SectionHeader title="Findings" count={findings.length} />
          <div className="space-y-4">
            {findings.map((f, i) => (
              <div
                key={i}
                className="flex gap-3 pb-4 border-b border-zinc-100 last:border-0 last:pb-0"
              >
                <div className="flex flex-col gap-1.5 pt-0.5 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${SEVERITY[f.severity] ?? SEVERITY.low}`}>
                    {f.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${FINDING_TYPE[f.type] ?? FINDING_TYPE.observation}`}>
                    {f.type}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {f.file && (
                    <p className="font-mono text-xs text-zinc-400 mb-1.5 truncate">{f.file}</p>
                  )}
                  <p className="text-sm text-zinc-700 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <SectionHeader title="Recommendations" count={recommendations.length} />
          <ol className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-700 leading-relaxed pt-0.5">{rec}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* PR Description */}
      {prDescription && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 bg-pink-500 rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">PR Description</h3>
            </div>
            <button
              onClick={copyPr}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all
                ${copied
                  ? 'bg-amber-400 text-zinc-900'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed font-mono bg-zinc-50 border border-zinc-100 rounded-lg p-4 overflow-x-auto">
            {prDescription}
          </pre>
        </div>
      )}
    </div>
  );
}
