import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Intern Log Service — Database API for Daily Work Logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch today's log for the given user in a workspace.
 * @param {string} userId 
 * @param {string} workspaceId 
 * @param {string} dateString - Optional date in YYYY-MM-DD format (defaults to today in local time)
 */
export const getTodayLog = async (userId, workspaceId, dateString) => {
  const targetDate = dateString || new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
  
  const { data, error } = await supabase
    .from("intern_daily_logs")
    .select(`
      *,
      reviewer:profiles!reviewed_by(id, name, profile_image_url)
    `)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("log_date", targetDate)
    .maybeSingle();

  if (error) {
    console.error("getTodayLog error:", error);
    throw error;
  }
  return data;
};

/**
 * Save log as a draft or submit it.
 * @param {object} logData - Contains workspace_id, user_id, log_date, tasks_done, learnings, blockers, tomorrow_plan, tags, status
 */
export const saveLog = async (logData) => {
  const { data, error } = await supabase
    .from("intern_daily_logs")
    .upsert({
      ...logData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "workspace_id,user_id,log_date"
    })
    .select()
    .single();

  if (error) {
    console.error("saveLog error:", error);
    throw error;
  }
  return data;
};

/**
 * Fetch past logs for a specific intern.
 * @param {string} userId 
 * @param {string} workspaceId 
 */
export const getInternLogHistory = async (userId, workspaceId) => {
  const { data, error } = await supabase
    .from("intern_daily_logs")
    .select(`
      *,
      reviewer:profiles!reviewed_by(id, name, profile_image_url),
      intern_log_messages(count)
    `)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("log_date", { ascending: false });

  if (error) {
    console.error("getInternLogHistory error:", error);
    throw error;
  }
  return data || [];
};

/**
 * Fetch all logs in a workspace with optional filters (for manager dashboard).
 * @param {string} workspaceId 
 * @param {object} filters - { userId, startDate, endDate, status, hasBlockers, tag }
 */
export const getAllWorkspaceLogs = async (workspaceId, filters = {}) => {
  let query = supabase
    .from("intern_daily_logs")
    .select(`
      *,
      user:profiles!user_id(id, name, profile_image_url),
      reviewer:profiles!reviewed_by(id, name, profile_image_url),
      intern_log_messages(count)
    `)
    .eq("workspace_id", workspaceId);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }
  if (filters.startDate) {
    query = query.gte("log_date", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte("log_date", filters.endDate);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.hasBlockers) {
    query = query.neq("blockers", "").not("blockers", "is", null);
  }
  if (filters.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  // Sort logs by date descending, then created_at descending
  const { data, error } = await query
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllWorkspaceLogs error:", error);
    throw error;
  }
  return data || [];
};

/**
 * Review/acknowledge/flag an intern log.
 * @param {string} logId 
 * @param {object} reviewData - { status, managerNote, reviewedBy }
 */
export const reviewLog = async (logId, { status, managerNote, reviewedBy }) => {
  const { data, error } = await supabase
    .from("intern_daily_logs")
    .update({
      status,
      manager_note: managerNote,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    console.error("reviewLog error:", error);
    throw error;
  }
  return data;
};

/**
 * Trigger the automatic missed log generator for a workspace.
 * @param {string} workspaceId 
 */
export const triggerBackfillMissedLogs = async (workspaceId) => {
  const { error } = await supabase.rpc("backfill_missed_intern_logs", {
    p_workspace_id: workspaceId,
    p_days_limit: 15
  });

  if (error) {
    console.warn("triggerBackfillMissedLogs failed or not implemented:", error);
    // Silent fail or return status so frontend can handle gracefully
    return false;
  }
  return true;
};

/**
 * Get summary compliance stats for a date in a workspace.
 * @param {string} workspaceId 
 * @param {string} dateString - Date in YYYY-MM-DD
 */
export const getWorkspaceDailyStats = async (workspaceId, dateString) => {
  const targetDate = dateString || new Date().toLocaleDateString('en-CA');

  // Trigger backfill first to ensure 'missed' counts are correct
  await triggerBackfillMissedLogs(workspaceId);

  const { data, error } = await supabase
    .from("intern_daily_logs")
    .select("status, user_id, tasks_done")
    .eq("workspace_id", workspaceId)
    .eq("log_date", targetDate);

  if (error) {
    console.error("getWorkspaceDailyStats error:", error);
    throw error;
  }

  const stats = {
    total: 0,
    submitted: 0,
    acknowledged: 0,
    flagged: 0,
    missed: 0,
    draft: 0,
    totalHours: 0
  };

  (data || []).forEach(log => {
    stats.total++;
    if (log.status === "submitted") stats.submitted++;
    else if (log.status === "acknowledged") stats.acknowledged++;
    else if (log.status === "flagged") stats.flagged++;
    else if (log.status === "missed") stats.missed++;
    else if (log.status === "draft") stats.draft++;

    // Calculate logged hours
    try {
      const tasks = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
      if (Array.isArray(tasks)) {
        tasks.forEach(t => {
          const hr = parseFloat(t.hours);
          if (!isNaN(hr)) stats.totalHours += hr;
        });
      }
    } catch (e) {
      console.warn("Failed to parse tasks_done JSON:", e);
    }
  });

  return stats;
};

/**
 * Update specific fields of an existing daily work log (for edit/resubmission).
 * This uses UPDATE rather than UPSERT so RLS policies can check correctly,
 * and leaves manager review fields completely untouched.
 * @param {string} logId
 * @param {object} updateData - { tasks_done, learnings, blockers, tomorrow_plan, tags, status }
 */
export const updateInternLog = async (logId, updateData) => {
  const { data, error } = await supabase
    .from("intern_daily_logs")
    .update({
      tasks_done:    updateData.tasks_done,
      learnings:     updateData.learnings,
      blockers:      updateData.blockers,
      tomorrow_plan: updateData.tomorrow_plan,
      tags:          updateData.tags,
      status:        updateData.status,
      updated_at:    new Date().toISOString()
    })
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    console.error("updateInternLog error:", error);
    throw error;
  }
  return data;
};

