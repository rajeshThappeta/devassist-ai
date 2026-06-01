import { useAgent } from './context/AgentContext.jsx';
import RepoForm from './components/RepoForm.jsx';
import AgentStream from './components/AgentStream.jsx';
import FinalReport from './components/FinalReport.jsx';

export default function App() {
  const { state } = useAgent();

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 bg-pink-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 leading-none">DevAssist AI</h1>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                Agentic code analysis · Groq + llama-3.3-70b
              </p>
            </div>

            {/* Accent dash */}
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="h-2 w-2 rounded-full bg-pink-400" />
              <div className="h-2 w-2 rounded-full bg-zinc-300" />
            </div>
          </div>

          {/* Tagline bar */}
          <div className="h-px bg-gradient-to-r from-pink-400 via-amber-300 to-transparent mt-4" />
        </header>

        {/* Error banner */}
        {state.status === 'error' && state.error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium animate-fade-in">
            {state.error}
          </div>
        )}

        <RepoForm />
        <AgentStream />
        <FinalReport />

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-xs text-zinc-400">
            ReAct pattern · hand-rolled agent loop · no LangChain
          </p>
        </footer>

      </div>
    </div>
  );
}
