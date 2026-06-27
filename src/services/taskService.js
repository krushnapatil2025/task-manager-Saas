import { supabase } from "../utils/supabaseClient";

const triggerWebhookDelivery = () => {
  // Fire-and-forget: signal the Edge Function to flush pending webhook_deliveries.
  // mode:'no-cors' avoids the CORS preflight entirely so there are no console
  // errors even when the function hasn't been deployed yet.
  // The Edge Function must be deployed with --no-verify-jwt (no auth header sent).
  fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deliver-webhook`,
    { method: 'POST', mode: 'no-cors' }
  ).catch(() => {});
};

// ─────────────────────────────────────────────────────────────────────────────
// Task Service — all Supabase queries for tasks (workspace-scoped)
// ─────────────────────────────────────────────────────────────────────────────

const TASK_SELECT = `
  *,
  assignees:task_assignments(
    user:profiles(id, name, profile_image_url)
  ),
  checklist:todo_checklist(id, title, description, completed, sort_order)
`;

/**
 * Fetch all tasks in a workspace, optionally filtered by status.
 * @param {string} workspaceId
 * @param {string|null} statusFilter
 */
export const getAllTasks = async (workspaceId, statusFilter = null) => {
  // Trigger spawning of recurring tasks automatically
  try {
    await supabase.rpc("spawn_recurring_tasks");
  } catch (spawnErr) {
    console.warn("Could not auto-spawn tasks:", spawnErr);
  }

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "All") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Fetch tasks assigned to a specific user within a workspace.
 * @param {string} userId
 * @param {string} workspaceId
 * @param {string|null} statusFilter
 */
export const getMyTasks = async (userId, workspaceId, statusFilter = null) => {
  // Trigger spawning of recurring tasks automatically
  try {
    await supabase.rpc("spawn_recurring_tasks");
  } catch (spawnErr) {
    console.warn("Could not auto-spawn tasks:", spawnErr);
  }

  const { data: assignments, error: aErr } = await supabase
    .from("task_assignments")
    .select("task_id")
    .eq("user_id", userId);

  if (aErr) throw aErr;

  const taskIds = (assignments || []).map((a) => a.task_id);
  if (taskIds.length === 0) return [];

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .in("id", taskIds)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "All") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Fetch a single task by ID (workspace check is implicit via RLS).
 * @param {string} taskId
 */
export const getTaskById = async (taskId) => {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a new task in a workspace.
 * @param {object} taskData  { title, description, priority, dueDate, attachments, recurrenceRule, recurrenceInterval, recurrenceEndDate }
 * @param {string[]} assignedTo   Array of user UUIDs (workspace members)
 * @param {string[]} todoCheckList  Array of checklist titles
 * @param {string} createdBy   UUID of the creating user
 * @param {string} workspaceId
 */
export const createTask = async (
  taskData,
  assignedTo,
  todoCheckList,
  createdBy,
  workspaceId
) => {
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      due_date: taskData.dueDate,
      attachments: taskData.attachments || [],
      status: "Pending",
      progress: 0,
      created_by: createdBy,
      workspace_id: workspaceId,
      recurrence_rule: taskData.recurrenceRule || null,
      recurrence_interval: taskData.recurrenceInterval || 1,
      recurrence_end_date: taskData.recurrenceEndDate || null,
    })
    .select()
    .single();

  if (taskErr) throw taskErr;

  if (assignedTo.length > 0) {
    const { error: assignErr } = await supabase
      .from("task_assignments")
      .insert(assignedTo.map((uid) => ({ task_id: task.id, user_id: uid })));
    if (assignErr) throw assignErr;
  }

  if (todoCheckList.length > 0) {
    const { error: todoErr } = await supabase
      .from("todo_checklist")
      .insert(
        todoCheckList.map((item, i) => ({
          task_id: task.id,
          title: typeof item === 'string' ? item : item.title,
          description: typeof item === 'string' ? null : item.description || null,
          completed: typeof item === 'string' ? false : item.completed || false,
          sort_order: i,
        }))
      );
    if (todoErr) throw todoErr;
  }

  triggerWebhookDelivery();
  return task;
};

/**
 * Update an existing task's core fields, re-sync assignees and checklist.
 */
export const updateTask = async (taskId, taskData, assignedTo, todoCheckList) => {
  const { error: taskErr } = await supabase
    .from("tasks")
    .update({
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      due_date: taskData.dueDate,
      attachments: taskData.attachments || [],
      recurrence_rule: taskData.recurrenceRule || null,
      recurrence_interval: taskData.recurrenceInterval || 1,
      recurrence_end_date: taskData.recurrenceEndDate || null,
    })
    .eq("id", taskId);

  if (taskErr) throw taskErr;

  // Re-sync assignees
  await supabase.from("task_assignments").delete().eq("task_id", taskId);
  if (assignedTo.length > 0) {
    const { error } = await supabase
      .from("task_assignments")
      .insert(assignedTo.map((uid) => ({ task_id: taskId, user_id: uid })));
    if (error) throw error;
  }

  // Re-sync checklist
  await supabase.from("todo_checklist").delete().eq("task_id", taskId);
  if (todoCheckList.length > 0) {
    const { error } = await supabase
      .from("todo_checklist")
      .insert(
        todoCheckList.map((item, i) => ({
          task_id: taskId,
          title: typeof item === 'string' ? item : item.title,
          description: typeof item === 'string' ? null : item.description || null,
          completed: typeof item === 'string' ? false : item.completed || false,
          sort_order: i,
        }))
      );
    if (error) throw error;
  }

  triggerWebhookDelivery();
};

/** Update task status field only. */
export const updateTaskStatus = async (taskId, status) => {
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);
  if (error) throw error;

  triggerWebhookDelivery();
};

/** Toggle a single checklist item's completed state. */
export const updateChecklistItem = async (checklistItemId, completed) => {
  const { error } = await supabase
    .from("todo_checklist")
    .update({ completed })
    .eq("id", checklistItemId);
  if (error) throw error;
};

/** Delete a task (RLS cascades to assignments + checklist). */
export const deleteTask = async (taskId) => {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;

  triggerWebhookDelivery();
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard helpers — workspace-scoped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin dashboard data for a workspace.
 * @param {string} workspaceId
 */
export const getAdminDashboardData = async (workspaceId) => {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id, title, status, priority, due_date, created_at, progress,
      assignees:task_assignments(user:profiles(id, name, profile_image_url)),
      checklist:todo_checklist(id, completed)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return buildDashboardSummary(tasks || []);
};

/**
 * User dashboard data — only tasks assigned to this user in this workspace.
 * @param {string} userId
 * @param {string} workspaceId
 */
export const getUserDashboardData = async (userId, workspaceId) => {
  const { data: assignments } = await supabase
    .from("task_assignments")
    .select("task_id")
    .eq("user_id", userId);

  const taskIds = (assignments || []).map((a) => a.task_id);
  if (taskIds.length === 0) return buildDashboardSummary([]);

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id, title, status, priority, due_date, created_at, progress,
      assignees:task_assignments(user:profiles(id, name, profile_image_url)),
      checklist:todo_checklist(id, completed)
    `)
    .in("id", taskIds)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return buildDashboardSummary(tasks || []);
};

const buildDashboardSummary = (tasks) => {
  const total     = tasks.length;
  const pending   = tasks.filter((t) => t.status === "Pending").length;
  const inProg    = tasks.filter((t) => t.status === "In Progress").length;
  const completed = tasks.filter((t) => t.status === "Completed").length;

  return {
    charts: {
      taskDistribution: { All: total, Pending: pending, InProgress: inProg, Completed: completed },
      taskPriorityLevels: {
        low:    tasks.filter((t) => t.priority === "low").length,
        medium: tasks.filter((t) => t.priority === "medium").length,
        high:   tasks.filter((t) => t.priority === "high").length,
      },
    },
    recentTasks: tasks.slice(0, 10).map(normalizeTask),
    statusSummary: {
      all:              total,
      pendingTasks:     pending,
      inProgressTasks:  inProg,
      completedTasks:   completed,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer — Supabase snake_case → camelCase UI shape
// ─────────────────────────────────────────────────────────────────────────────
export const normalizeTask = (raw) => ({
  id:               raw.id,
  title:            raw.title,
  description:      raw.description,
  priority:         raw.priority,
  status:           raw.status,
  progress:         raw.progress ?? 0,
  dueDate:          raw.due_date,
  createdAt:        raw.created_at,
  workspaceId:      raw.workspace_id,
  attachments:      raw.attachments || [],
  assignedTo: (raw.assignees || []).map((a) => ({
    id:             a.user?.id,
    name:           a.user?.name,
    profileImageUrl: a.user?.profile_image_url,
  })),
  todoChecklist: (raw.checklist || []).map((c) => ({
    id:        c.id,
    title:     c.title,
    description: c.description || "",
    completed: c.completed,
  })),
  completedTodoCount: (raw.checklist || []).filter((c) => c.completed).length,
  recurrenceRule:     raw.recurrence_rule,
  recurrenceInterval: raw.recurrence_interval ?? 1,
  recurrenceEndDate:  raw.recurrence_end_date,
  parentTaskId:       raw.parent_task_id,
  nextOccurrenceAt:   raw.next_occurrence_at,
});
