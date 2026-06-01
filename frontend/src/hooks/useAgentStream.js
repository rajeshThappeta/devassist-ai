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

    es.addEventListener('error', () => {
      es.close();
      esRef.current = null;
      dispatch({ type: 'SET_ERROR', payload: 'Analysis failed. Check the repository URL and try again.' });
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
