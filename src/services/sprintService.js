import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Service — Phase 13
// ─────────────────────────────────────────────────────────────────────────────

// ── Sprints ───────────────────────────────────────────────────────────────────

export const getSprints = async (workspaceId) => {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createSprint = async ({ workspaceId, name, goal, startDate, endDate, createdBy }) => {
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      workspace_id: workspaceId,
      name,
      goal:         goal     || null,
      start_date:   startDate || null,
      end_date:     endDate   || null,
      created_by:   createdBy || null,
      status:       'planning',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSprintStatus = async (sprintId, status) => {
  const { data, error } = await supabase
    .from('sprints')
    .update({ status })
    .eq('id', sprintId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSprintDetails = async (sprintId, { name, goal, startDate, endDate }) => {
  const { data, error } = await supabase
    .from('sprints')
    .update({
      name,
      goal:       goal      || null,
      start_date: startDate || null,
      end_date:   endDate   || null,
    })
    .eq('id', sprintId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSprint = async (sprintId) => {
  const { error } = await supabase.from('sprints').delete().eq('id', sprintId);
  if (error) throw error;
};

// ── Sprint ↔ Task management ──────────────────────────────────────────────────

export const getSprintTasks = async (sprintId) => {
  const { data, error } = await supabase.rpc('get_sprint_tasks', { p_sprint_id: sprintId });
  if (error) {
    // Fallback: plain join query
    const { data: fb, error: err2 } = await supabase
      .from('sprint_tasks')
      .select('task_id, tasks(id, title, status, priority, progress, due_date)')
      .eq('sprint_id', sprintId);
    if (err2) throw err2;
    return (fb || []).map(r => ({ ...r.tasks }));
  }
  return data || [];
};

export const addTaskToSprint = async (sprintId, taskId) => {
  const { error } = await supabase
    .from('sprint_tasks')
    .insert({ sprint_id: sprintId, task_id: taskId });
  if (error && error.code !== '23505') throw error; // ignore duplicate
};

export const removeTaskFromSprint = async (sprintId, taskId) => {
  const { error } = await supabase
    .from('sprint_tasks')
    .delete()
    .eq('sprint_id', sprintId)
    .eq('task_id',   taskId);
  if (error) throw error;
};

// ── Task dependencies ─────────────────────────────────────────────────────────

export const getTaskDependencies = async (taskId) => {
  const [{ data: blocking }, { data: blockedBy }] = await Promise.all([
    supabase
      .from('task_dependencies')
      .select('id, blocked_task_id, tasks!task_dependencies_blocked_task_id_fkey(id,title,status)')
      .eq('blocking_task_id', taskId),
    supabase
      .from('task_dependencies')
      .select('id, blocking_task_id, tasks!task_dependencies_blocking_task_id_fkey(id,title,status)')
      .eq('blocked_task_id', taskId),
  ]);
  return {
    blocking: (blocking || []).map(r => ({ depId: r.id, ...r.tasks })),
    blockedBy: (blockedBy || []).map(r => ({ depId: r.id, ...r.tasks })),
  };
};

export const addDependency = async (workspaceId, blockingTaskId, blockedTaskId) => {
  const { error } = await supabase
    .from('task_dependencies')
    .insert({ workspace_id: workspaceId, blocking_task_id: blockingTaskId, blocked_task_id: blockedTaskId });
  if (error && error.code !== '23505') throw error;
};

export const removeDependency = async (depId) => {
  const { error } = await supabase.from('task_dependencies').delete().eq('id', depId);
  if (error) throw error;
};
