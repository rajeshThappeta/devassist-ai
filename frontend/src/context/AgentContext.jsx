import { createContext, useContext, useReducer } from 'react';

export const AgentContext = createContext(null);

const initialState = {
  status: 'idle',
  repoUrl: '',
  goal: '',
  steps: [],
  finalReport: null,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'START_ANALYSIS':
      return {
        ...initialState,
        status: 'connecting',
        repoUrl: action.payload.repoUrl,
        goal: action.payload.goal,
      };
    case 'ADD_STEP':
      return { ...state, status: 'streaming', steps: [...state.steps, action.payload] };
    case 'SET_FINAL_REPORT':
      return { ...state, finalReport: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function AgentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AgentContext.Provider value={{ state, dispatch }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  return useContext(AgentContext);
}
