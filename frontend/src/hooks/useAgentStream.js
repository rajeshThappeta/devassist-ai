import { useRef } from 'react';
import { useAgent } from '../context/AgentContext.jsx';

export function useAgentStream() {
  const { dispatch } = useAgent();
  const esRef = useRef(null);

  function startAnalysis(repoUrl, goal) {
    if (esRef.current) {
      esRef.current.close();
    }

    dispatch({ type: 'START_ANALYSIS', payload: { repoUrl, goal } });

    const params = new URLSearchParams({ repoUrl, goal });
    const url = `${import.meta.env.VITE_API_URL}/analyze?${params}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('step', (e) => {
      const step = JSON.parse(e.data);
      dispatch({ type: 'ADD_STEP', payload: step });
      if (step.type === 'final_answer') {
        dispatch({ type: 'SET_FINAL_REPORT', payload: step.content });
      }
    });

    es.addEventListener('done', () => {
      es.close();
      esRef.current = null;
      dispatch({ type: 'SET_STATUS', payload: 'complete' });
    });

    es.addEventListener('error', (e) => {
      es.close();
      esRef.current = null;

      let message = 'Analysis failed. Check the repository URL and try again.';

      if (e.data) {
        try {
          const { message: serverMsg = '' } = JSON.parse(e.data);
          if (serverMsg.includes('Rate limit') || serverMsg.includes('429') || serverMsg.includes('rate_limit')) {
            message = 'Groq rate limit reached — please wait a minute and try again.';
          } else if (serverMsg.includes('not found') || serverMsg.includes('404')) {
            message = 'Repository not found. Make sure the URL is correct and the repo is public.';
          } else if (serverMsg.includes('maximum iterations')) {
            message = 'Agent could not complete the analysis within the step limit. Try a more specific goal.';
          } else if (serverMsg) {
            message = serverMsg;
          }
        } catch {}
      }

      dispatch({ type: 'SET_ERROR', payload: message });
    });
  }

  function reset() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    dispatch({ type: 'RESET' });
  }

  return { startAnalysis, reset };
}
