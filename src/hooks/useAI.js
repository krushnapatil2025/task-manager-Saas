import { useState, useCallback, useContext } from 'react';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import {
  suggestTaskPriority,
  summariseTaskComments,
  getSmartWarnings,
  parseNaturalLanguageTask,
  chatWithAssistant,
  generateTaskChecklist,
  expandTaskDescription,
} from '../services/aiService';

// ─────────────────────────────────────────────────────────────────────────────
// useAI — thin wrapper around aiService with loading + error state management
// ─────────────────────────────────────────────────────────────────────────────

export const useAI = () => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const wsId = workspace?.id;
  const uid  = user?.id;

  const run = useCallback(async (fn, ...args) => {
    setLoading(true);
    setError(null);
    try {
      return await fn(...args, wsId, uid);
    } catch (err) {
      const msg = err.message || 'AI request failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wsId, uid]);

  return {
    loading,
    error,
    setError,
    // Core tools
    suggestPriority:    (title, desc)              => run(suggestTaskPriority, title, desc),
    summariseComments:  (title, comments)          => run(summariseTaskComments, title, comments),
    getWarnings:        (tasks)                    => run(getSmartWarnings, tasks),
    parseNLTask:        (input)                    => run(parseNaturalLanguageTask, input),
    // New features
    chat:               (history, context)         => run(chatWithAssistant, history, context),
    generateChecklist:  (title, desc)              => run(generateTaskChecklist, title, desc),
    expandDescription:  (summary)                  => run(expandTaskDescription, summary),
  };
};

export default useAI;
