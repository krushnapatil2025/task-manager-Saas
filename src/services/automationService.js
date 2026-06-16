import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Automation Service — Phase 15
// Client-side rule evaluation engine + DB CRUD
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const getAutomationRules = async (workspaceId) => {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createRule = async (rule) => {
  const { data, error } = await supabase
    .from('automation_rules')
    .insert(rule)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateRule = async (ruleId, updates) => {
  const { data, error } = await supabase
    .from('automation_rules')
    .update(updates)
    .eq('id', ruleId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const toggleRule = async (ruleId, enabled) => {
  return updateRule(ruleId, { enabled });
};

export const deleteRule = async (ruleId) => {
  const { error } = await supabase.from('automation_rules').delete().eq('id', ruleId);
  if (error) throw error;
};

export const getAutomationLogs = async (workspaceId, limit = 50) => {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*, automation_rules(name), tasks(title)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

// ── Rule Evaluation Engine ────────────────────────────────────────────────────
// Called from useAutomation hook whenever a task event occurs.

/**
 * Evaluate rules for a given trigger and optionally execute matching actions.
 *
 * @param {string} workspaceId
 * @param {string} triggerType   — one of the trigger_type enum values
 * @param {object} context       — { taskId, task, oldTask, userId }
 */
export const evaluateRules = async (workspaceId, triggerType, context) => {
  const { data: rules, error } = await supabase.rpc('get_matching_rules', {
    p_workspace_id: workspaceId,
    p_trigger_type: triggerType,
  });
  if (error || !rules?.length) return [];

  const results = [];

  for (const rule of rules) {
    try {
      const conditionMet = checkCondition(rule.trigger_condition, context);
      if (!conditionMet) continue;

      const actionResult = await executeAction(rule, context);
      results.push({ ruleId: rule.id, name: rule.name, status: 'success', actionResult });

      // Log the run
      await supabase.rpc('log_automation_run', {
        p_rule_id:      rule.id,
        p_workspace_id: workspaceId,
        p_task_id:      context.taskId || null,
        p_user_id:      context.userId || null,
        p_status:       'success',
        p_detail:       `Triggered by ${triggerType}`,
      });
    } catch (err) {
      results.push({ ruleId: rule.id, name: rule.name, status: 'failed', error: err.message });
      await supabase.rpc('log_automation_run', {
        p_rule_id:      rule.id,
        p_workspace_id: workspaceId,
        p_task_id:      context.taskId || null,
        p_user_id:      context.userId || null,
        p_status:       'failed',
        p_detail:       err.message,
      }).catch(() => {});
    }
  }

  return results;
};

// ── Condition checker ─────────────────────────────────────────────────────────

const checkCondition = (condition = {}, context = {}) => {
  const { task, oldTask } = context;
  if (!condition || Object.keys(condition).length === 0) return true; // no condition = always match

  // e.g. { to_status: 'Completed' }
  if (condition.to_status && task?.status !== condition.to_status) return false;

  // e.g. { from_status: 'Pending' }
  if (condition.from_status && oldTask?.status !== condition.from_status) return false;

  // e.g. { priority: 'high' }
  if (condition.priority && task?.priority !== condition.priority) return false;

  // e.g. { to_priority: 'high' }
  if (condition.to_priority && task?.priority !== condition.to_priority) return false;

  return true;
};

// ── Action executors ──────────────────────────────────────────────────────────

const executeAction = async (rule, context) => {
  const { action_type, action_config } = rule;
  const { taskId, task, userId } = context;

  switch (action_type) {
    case 'send_notification':
      return await actionSendNotification(action_config, taskId, task, userId);

    case 'change_status':
      return await actionChangeStatus(action_config, taskId);

    case 'change_priority':
      return await actionChangePriority(action_config, taskId);

    case 'assign_to_member':
      return await actionAssign(action_config, taskId);

    case 'post_chat_message':
      return await actionPostChat(action_config, context);

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }
};

const actionSendNotification = async (config, taskId, task, triggeredBy) => {
  // Insert into notifications table if it exists
  const { error } = await supabase.from('notifications').insert({
    workspace_id: config.workspace_id,
    user_id:      config.notify_user_id || triggeredBy,
    type:         'automation',
    title:        config.title || '🤖 Automation triggered',
    message:      config.message || `Rule triggered on task: ${task?.title || taskId}`,
    task_id:      taskId,
    is_read:      false,
  }).select();
  // Notifications table may not exist — ignore gracefully
  return { sent: !error };
};

const actionChangeStatus = async (config, taskId) => {
  if (!config.status || !taskId) return;
  const { error } = await supabase
    .from('tasks')
    .update({ status: config.status })
    .eq('id', taskId);
  if (error) throw error;
  return { status: config.status };
};

const actionChangePriority = async (config, taskId) => {
  if (!config.priority || !taskId) return;
  const { error } = await supabase
    .from('tasks')
    .update({ priority: config.priority })
    .eq('id', taskId);
  if (error) throw error;
  return { priority: config.priority };
};

const actionAssign = async (config, taskId) => {
  if (!config.user_id || !taskId) return;
  const { error } = await supabase
    .from('task_assignments')
    .upsert({ task_id: taskId, user_id: config.user_id }, { onConflict: 'task_id,user_id' });
  if (error) throw error;
  return { assignedTo: config.user_id };
};

const actionPostChat = async (config, context) => {
  if (!config.room_id || !config.message) return;
  const { error } = await supabase.from('chat_messages').insert({
    room_id:   config.room_id,
    sender_id: null, // system message
    content:   config.message,
    type:      'system',
  });
  if (error) throw error;
  return { posted: true };
};

// ── Trigger type labels ────────────────────────────────────────────────────────
export const TRIGGER_LABELS = {
  task_status_changed:   'Task Status Changed',
  task_overdue:          'Task Becomes Overdue',
  task_priority_changed: 'Task Priority Changed',
  task_assigned:         'Task Assigned to Member',
  task_created:          'Task Created',
  task_completed:        'Task Completed',
};

export const ACTION_LABELS = {
  send_notification: 'Send Notification',
  change_status:     'Change Task Status',
  change_priority:   'Change Task Priority',
  assign_to_member:  'Assign to Member',
  post_chat_message: 'Post Chat Message',
};
