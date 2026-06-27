import { supabase } from "../utils/supabaseClient";
import { createNotification } from "./notificationService";

/**
 * Fetch all active leave types for a workspace.
 * Automatically seeds default leave types if none exist.
 */
export const getLeaveTypes = async (workspaceId) => {
  if (!workspaceId) return [];

  // Fetch active types
  const { data, error } = await supabase
    .from("leave_types")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  // Auto-seed default leave types if none exist
  if (!data || data.length === 0) {
    const { error: seedError } = await supabase.rpc("seed_workspace_leave_types", {
      p_workspace_id: workspaceId,
    });
    if (seedError) {
      console.error("Error seeding default leave types:", seedError);
    } else {
      // Re-fetch after seeding
      const { data: seededData, error: refetchError } = await supabase
        .from("leave_types")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (refetchError) throw refetchError;
      return seededData || [];
    }
  }

  return data || [];
};

/**
 * Update or insert a leave type configuration (Admin only).
 */
export const saveLeaveType = async (leaveType) => {
  const { data, error } = await supabase
    .from("leave_types")
    .upsert(leaveType)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete or deactivate a leave type (Admin only).
 */
export const deleteLeaveType = async (leaveTypeId) => {
  const { error } = await supabase
    .from("leave_types")
    .update({ is_active: false })
    .eq("id", leaveTypeId);

  if (error) throw error;
};

/**
 * Fetch own leave balances for the current year.
 * Ensures rows are initialized for the user.
 */
export const getMyLeaveBalances = async (workspaceId, userId, year = new Date().getFullYear()) => {
  if (!workspaceId || !userId) return [];

  // Get active leave types
  const leaveTypes = await getLeaveTypes(workspaceId);

  // Fetch current balance entries
  const { data: balances, error: balanceError } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year);

  if (balanceError) throw balanceError;

  const results = [];

  // Match or initialize balance for each active type
  for (const type of leaveTypes) {
    const existing = balances?.find((b) => b.leave_type_id === type.id);
    if (existing) {
      results.push({
        ...existing,
        leaveType: type,
      });
    } else {
      // Create default balance record if it doesn't exist
      const defaultTotal = type.max_days_per_year;
      const { data: newBalance, error: insertError } = await supabase
        .from("leave_balances")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          leave_type_id: type.id,
          year,
          total_days: defaultTotal,
          used_days: 0,
          pending_days: 0,
          carry_over_days: 0,
        })
        .select()
        .single();

      if (!insertError && newBalance) {
        results.push({
          ...newBalance,
          leaveType: type,
        });
      } else {
        // Handle race conditions (409 Conflict / unique constraint violation) gracefully
        if (insertError?.code === '23505' || insertError?.status === 409 || String(insertError?.message).includes('already exists')) {
          const { data: fetchedBalance, error: fetchError } = await supabase
            .from("leave_balances")
            .select("*")
            .eq("user_id", userId)
            .eq("leave_type_id", type.id)
            .eq("year", year)
            .maybeSingle();

          if (!fetchError && fetchedBalance) {
            results.push({
              ...fetchedBalance,
              leaveType: type,
            });
            continue;
          }
        }

        // Fallback representation if DB constraint/RLS delays insert
        results.push({
          workspace_id: workspaceId,
          user_id: userId,
          leave_type_id: type.id,
          year,
          total_days: defaultTotal,
          used_days: 0,
          pending_days: 0,
          carry_over_days: 0,
          leaveType: type,
        });
      }
    }
  }

  return results;
};

/**
 * Fetch all leave balances in workspace for administrative view.
 */
export const getAllLeaveBalances = async (workspaceId, year = new Date().getFullYear()) => {
  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      leaveType:leave_types(*),
      user:profiles(id, name, profile_image_url, department, job_profile)
    `)
    .eq("workspace_id", workspaceId)
    .eq("year", year);

  if (error) throw error;
  return data || [];
};

/**
 * Manually update/adjust a leave balance.
 */
export const updateLeaveBalanceManual = async (balanceId, updates) => {
  const { data, error } = await supabase
    .from("leave_balances")
    .update(updates)
    .eq("id", balanceId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Submit a new leave request.
 */
export const submitLeaveRequest = async (payload) => {
  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert(payload)
    .select(`
      *,
      leaveType:leave_types(name),
      applicant:profiles!leave_requests_applicant_id_fkey(name)
    `)
    .single();

  if (error) throw error;

  // Send notifications to workspace admins
  try {
    const { data: admins } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", payload.workspace_id)
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const applicantName = request.applicant?.name || "An employee";
      const leaveTypeName = request.leaveType?.name || "leave";
      const startStr = new Date(request.start_date).toLocaleDateString();
      const endStr = new Date(request.end_date).toLocaleDateString();

      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.user_id,
            type: "leave_submitted",
            title: "New Leave Application",
            body: `${applicantName} applied for ${leaveTypeName} (${startStr} - ${endStr})`,
            link: "/admin/leaves",
            workspaceId: payload.workspace_id,
          }).catch((err) => console.error("Notification failed", err))
        )
      );
    }
  } catch (err) {
    console.error("Failed to notify admins of new leave application:", err);
  }

  return request;
};

/**
 * Withdraw/cancel a pending leave request.
 */
export const withdrawLeaveRequest = async (requestId) => {
  const { data: request, error } = await supabase
    .from("leave_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .select(`
      *,
      applicant:profiles!leave_requests_applicant_id_fkey(name)
    `)
    .single();

  if (error) throw error;

  // Notify workspace admins
  try {
    const { data: admins } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", request.workspace_id)
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const applicantName = request.applicant?.name || "An employee";
      const startStr = new Date(request.start_date).toLocaleDateString();

      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.user_id,
            type: "leave_withdrawn",
            title: "Leave Request Withdrawn",
            body: `${applicantName} withdrew their leave request starting on ${startStr}`,
            link: "/admin/leaves",
            workspaceId: request.workspace_id,
          }).catch((err) => console.error("Notification failed", err))
        )
      );
    }
  } catch (err) {
    console.error("Failed to notify admins of withdrawn leave request:", err);
  }

  return request;
};

/**
 * Cancel an approved leave request (Admin or Applicant before start date).
 */
export const cancelApprovedLeaveRequest = async (requestId) => {
  const { data: request, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .select(`
      *,
      applicant:profiles!leave_requests_applicant_id_fkey(name)
    `)
    .single();

  if (error) throw error;

  // Notify workspace admins
  try {
    const { data: admins } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", request.workspace_id)
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const applicantName = request.applicant?.name || "An employee";
      const startStr = new Date(request.start_date).toLocaleDateString();

      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.user_id,
            type: "leave_cancelled",
            title: "Approved Leave Cancelled",
            body: `${applicantName} cancelled their approved leave starting on ${startStr}`,
            link: "/admin/leaves",
            workspaceId: request.workspace_id,
          }).catch((err) => console.error("Notification failed", err))
        )
      );
    }
  } catch (err) {
    console.error("Failed to notify admins of cancelled leave request:", err);
  }

  return request;
};

/**
 * Get leave requests submitted by the current user.
 */
export const getMyLeaveRequests = async (workspaceId, userId) => {
  if (!workspaceId || !userId) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leaveType:leave_types(name, code, color, requires_document),
      reviewer:profiles!leave_requests_reviewed_by_fkey(name)
    `)
    .eq("workspace_id", workspaceId)
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Get all leave requests inside a workspace (Admin view).
 */
export const getAllLeaveRequests = async (workspaceId) => {
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leaveType:leave_types(name, code, color, requires_document),
      applicant:profiles!leave_requests_applicant_id_fkey(id, name, profile_image_url, department, job_profile),
      reviewer:profiles!leave_requests_reviewed_by_fkey(name)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Approve or Reject a leave request.
 */
export const reviewLeaveRequest = async (requestId, status, comment, reviewerId) => {
  const { data: request, error } = await supabase
    .from("leave_requests")
    .update({
      status,
      review_comment: comment,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select(`
      *,
      leaveType:leave_types(name)
    `)
    .single();

  if (error) throw error;

  // Notify the applicant
  try {
    const leaveTypeName = request.leaveType?.name || "leave";
    const startStr = new Date(request.start_date).toLocaleDateString();
    const endStr = new Date(request.end_date).toLocaleDateString();

    let title = "";
    let body = "";
    if (status === "approved") {
      title = "Leave Request Approved ✅";
      body = `Your ${leaveTypeName} request for ${startStr} - ${endStr} has been approved.`;
    } else if (status === "rejected") {
      title = "Leave Request Rejected ❌";
      body = `Your ${leaveTypeName} request for ${startStr} - ${endStr} was rejected: ${comment || "No comment"}`;
    }

    if (title && request.applicant_id) {
      await createNotification({
        userId: request.applicant_id,
        type: `leave_${status}`,
        title,
        body,
        link: "/user/leaves",
        workspaceId: request.workspace_id,
      });
    }
  } catch (err) {
    console.error("Failed to notify user of reviewed leave request:", err);
  }

  return request;
};

/**
 * Fetch approved leave events for calendar mapping.
 */
export const getTeamLeaveCalendar = async (workspaceId) => {
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      id,
      start_date,
      end_date,
      status,
      total_days,
      reason,
      leaveType:leave_types(name, color, code),
      applicant:profiles!leave_requests_applicant_id_fkey(name, profile_image_url, department)
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved");

  if (error) throw error;
  return data || [];
};

/**
 * Upload leave supporting files (medical certificate, etc.)
 */
export const uploadLeaveDocument = async (file, workspaceId) => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${workspaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `leave-documents/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("files-hub") // reusing the files hub bucket
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("files-hub")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};

/**
 * Fetch all public holidays for a workspace.
 */
export const getLeaveHolidays = async (workspaceId) => {
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leave_holidays")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Add a public holiday.
 */
export const addLeaveHoliday = async (holiday) => {
  const { data, error } = await supabase
    .from("leave_holidays")
    .insert(holiday)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a public holiday.
 */
export const deleteLeaveHoliday = async (holidayId) => {
  const { error } = await supabase
    .from("leave_holidays")
    .delete()
    .eq("id", holidayId);

  if (error) throw error;
};
