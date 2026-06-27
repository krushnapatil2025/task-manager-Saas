import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Goal & OKR Service — all Supabase queries for goals and key results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all goals for a workspace.
 * Uses the RPC get_workspace_goals for complete metrics and owner details.
 * @param {string} workspaceId
 */
export const getGoals = async (workspaceId) => {
  const { data, error } = await supabase.rpc("get_workspace_goals", {
    p_workspace_id: workspaceId,
  });

  if (error) throw error;
  return data || [];
};

/**
 * Fetch detailed view of a single goal, including its key results and uploader details.
 * @param {string} goalId
 */
export const getGoalDetails = async (goalId) => {
  const { data, error } = await supabase
    .from("goals")
    .select(`
      id, title, description, status, progress, start_date, due_date, created_at, owner_id,
      owner:profiles(id, name, profile_image_url)
    `)
    .eq("id", goalId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a new goal (Objective) in a workspace.
 * @param {string} workspaceId
 * @param {object} goalDetails
 */
export const createGoal = async (workspaceId, { title, description, ownerId, startDate, dueDate }) => {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      workspace_id: workspaceId,
      title: title.trim(),
      description: description?.trim() || null,
      owner_id: ownerId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      status: "active",
      progress: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update an existing goal (Objective).
 * @param {string} goalId
 * @param {object} updates
 */
export const updateGoal = async (goalId, updates) => {
  const { data, error } = await supabase
    .from("goals")
    .update({
      title: updates.title?.trim(),
      description: updates.description?.trim(),
      owner_id: updates.ownerId || null,
      status: updates.status,
      start_date: updates.startDate || null,
      due_date: updates.dueDate || null,
    })
    .eq("id", goalId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a goal (will cascade delete its key results).
 * @param {string} goalId
 */
export const deleteGoal = async (goalId) => {
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId);

  if (error) throw error;
};

/**
 * Fetch all key results for a goal.
 * @param {string} goalId
 */
export const getKeyResults = async (goalId) => {
  const { data, error } = await supabase
    .from("key_results")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Create a Key Result for an objective.
 * @param {string} goalId
 * @param {object} krDetails
 */
export const createKeyResult = async (goalId, { title, targetValue, currentValue, unit }) => {
  const { data, error } = await supabase
    .from("key_results")
    .insert({
      goal_id: goalId,
      title: title.trim(),
      target_value: parseFloat(targetValue) || 100,
      current_value: parseFloat(currentValue) || 0,
      unit: unit?.trim() || "%"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update Key Result values (e.g., progress update).
 * @param {string} krId
 * @param {object} updates
 */
export const updateKeyResult = async (krId, updates) => {
  const { data, error } = await supabase
    .from("key_results")
    .update({
      title: updates.title?.trim(),
      target_value: updates.targetValue !== undefined ? parseFloat(updates.targetValue) : undefined,
      current_value: updates.currentValue !== undefined ? parseFloat(updates.currentValue) : undefined,
      unit: updates.unit?.trim()
    })
    .eq("id", krId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a Key Result.
 * @param {string} krId
 */
export const deleteKeyResult = async (krId) => {
  const { error } = await supabase
    .from("key_results")
    .delete()
    .eq("id", krId);

  if (error) throw error;
};

/**
 * Link a task to a Key Result.
 * @param {string} taskId
 * @param {string} krId
 */
export const linkTaskToKeyResult = async (taskId, krId) => {
  const { error } = await supabase
    .from("task_key_results")
    .insert({
      task_id: taskId,
      key_result_id: krId
    });

  if (error) throw error;
};

/**
 * Unlink a task from a Key Result.
 * @param {string} taskId
 * @param {string} krId
 */
export const unlinkTaskFromKeyResult = async (taskId, krId) => {
  const { error } = await supabase
    .from("task_key_results")
    .delete()
    .eq("task_id", taskId)
    .eq("key_result_id", krId);

  if (error) throw error;
};

/**
 * Fetch all tasks linked to a Key Result.
 * @param {string} krId
 */
export const getLinkedTasks = async (krId) => {
  const { data, error } = await supabase
    .from("task_key_results")
    .select(`
      task:tasks(id, title, status, priority, due_date)
    `)
    .eq("key_result_id", krId);

  if (error) throw error;
  return (data || []).map(d => d.task);
};

/**
 * Fetch key results linked to a task.
 * @param {string} taskId
 */
export const getTaskLinkedKeyResults = async (taskId) => {
  const { data, error } = await supabase
    .from("task_key_results")
    .select(`
      key_result:key_results(
        id, title, target_value, current_value, unit,
        goal:goals(id, title)
      )
    `)
    .eq("task_id", taskId);

  if (error) throw error;
  return (data || []).map(d => d.key_result);
};
