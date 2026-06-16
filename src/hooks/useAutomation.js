import { useCallback, useContext } from 'react';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { evaluateRules }    from '../services/automationService';

// ─────────────────────────────────────────────────────────────────────────────
// useAutomation — fire automation rules on task events
//
// Usage:
//   const { trigger } = useAutomation();
//   await trigger('task_status_changed', { taskId, task, oldTask });
// ─────────────────────────────────────────────────────────────────────────────

export const useAutomation = () => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const trigger = useCallback(async (triggerType, context = {}) => {
    if (!workspace?.id) return [];
    try {
      return await evaluateRules(workspace.id, triggerType, {
        ...context,
        userId: user?.id,
      });
    } catch (err) {
      console.warn('Automation trigger failed:', err);
      return [];
    }
  }, [workspace?.id, user?.id]);

  return { trigger };
};

export default useAutomation;
