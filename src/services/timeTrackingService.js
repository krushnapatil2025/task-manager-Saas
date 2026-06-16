import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Time Tracking Service — Phase 11
// ─────────────────────────────────────────────────────────────────────────────

/** Start a new timer session for a task */
export const startTimer = async (taskId, workspaceId, userId) => {
  const { data, error } = await supabase
    .from('time_logs')
    .insert({ task_id: taskId, workspace_id: workspaceId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Stop the active timer session */
export const stopTimer = async (logId) => {
  const { data, error } = await supabase
    .from('time_logs')
    .update({ stopped_at: new Date().toISOString() })
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Get the currently running timer for user+task (null if none) */
export const getActiveTimer = async (userId, taskId) => {
  const { data, error } = await supabase.rpc('get_active_timer', {
    p_user_id: userId,
    p_task_id: taskId,
  });
  if (error) throw error;
  return data?.[0] || null;
};

/** Get all completed time logs for a task */
export const getTaskTimeLogs = async (taskId) => {
  const { data, error } = await supabase
    .from('time_logs')
    .select('*, profiles(name, profile_image_url)')
    .eq('task_id', taskId)
    .not('stopped_at', 'is', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeLog);
};

/** Get total logged seconds for a task (RPC) */
export const getTaskTotalTime = async (taskId) => {
  const { data, error } = await supabase.rpc('get_task_total_time', {
    p_task_id: taskId,
  });
  if (error) throw error;
  return data || 0;
};

/** Get my time logs for a date range */
export const getMyTimeLogs = async (userId, workspaceId, from, to) => {
  const { data, error } = await supabase
    .from('time_logs')
    .select('*, tasks(title)')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .not('stopped_at', 'is', null)
    .gte('started_at', from)
    .lte('started_at', to)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeLog);
};

/** Admin — get workspace timesheet summary via RPC */
export const getWorkspaceTimesheet = async (workspaceId, from, to) => {
  const { data, error } = await supabase.rpc('get_workspace_timesheet', {
    p_workspace_id: workspaceId,
    p_from:         from,
    p_to:           to,
  });
  if (error) throw error;
  return data || [];
};

/** Delete a time log entry */
export const deleteTimeLog = async (logId) => {
  const { error } = await supabase.from('time_logs').delete().eq('id', logId);
  if (error) throw error;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeLog = (row) => ({
  id:          row.id,
  taskId:      row.task_id,
  taskTitle:   row.tasks?.title || '',
  userId:      row.user_id,
  userName:    row.profiles?.name || 'Unknown',
  avatarUrl:   row.profiles?.profile_image_url || null,
  startedAt:   row.started_at,
  stoppedAt:   row.stopped_at,
  durationSec: row.duration_sec || 0,
  note:        row.note || '',
});

/** Format seconds → "2h 14m" or "45m" or "30s" */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

/** Format live elapsed seconds from a Date → "01:23:45" */
export const formatElapsed = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};
