import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// User Service — workspace-scoped profile queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all members of a workspace (for user lists, assignment dropdowns).
 * Returns normalised camelCase objects.
 * @param {string} workspaceId
 */
export const getAllUsers = async (workspaceId) => {
  if (!workspaceId) {
    // Fallback: return all profiles (used in Phase 0 compatibility paths)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, profile_image_url, role, created_at, status_emoji, status_text, status_expires_at, dnd_until")
      .order("name");
    if (error) throw error;
    return (data || []).map(normalizeProfile);
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      profile:profiles(id, name, profile_image_url, role, created_at, status_emoji, status_text, status_expires_at, dnd_until)
    `)
    .eq("workspace_id", workspaceId)
    .order("profile(name)");

  if (error) throw error;

  return (data || []).map((m) => ({
    ...normalizeProfile(m.profile),
    wsRole: m.role,
  }));
};

/** Update the current user's profile row. */
export const updateProfile = async (userId, updates) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
};

/**
 * Get workspace members enriched with task statistics.
 * Used in the admin "Team Members" view.
 * @param {string} workspaceId
 */
export const getUsersWithTaskStats = async (workspaceId) => {
  const users = await getAllUsers(workspaceId);
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  const { data: assignments, error } = await supabase
    .from("task_assignments")
    .select("user_id, task:tasks(status, workspace_id)")
    .in("user_id", userIds);

  if (error) throw error;

  return users.map((user) => {
    const mine = (assignments || []).filter(
      (a) =>
        a.user_id === user.id &&
        (!workspaceId || a.task?.workspace_id === workspaceId)
    );
    const statuses = mine.map((a) => a.task?.status);
    return {
      ...user,
      totalTasks:      statuses.length,
      completedTasks:  statuses.filter((s) => s === "Completed").length,
      pendingTasks:    statuses.filter((s) => s === "Pending").length,
      inProgressTasks: statuses.filter((s) => s === "In Progress").length,
    };
  });
};

// ── Internal normalizer ────────────────────────────────────────────────────────
const normalizeProfile = (u) => ({
  id:              u.id,
  name:            u.name,
  role:            u.role,
  profileImageUrl: u.profile_image_url,
  createdAt:       u.created_at,
  statusEmoji:     u.status_emoji,
  statusText:      u.status_text,
  statusExpiresAt: u.status_expires_at,
  dndUntil:        u.dnd_until,
});

// ── Password Reset OTP Helpers ──────────────────────────────────────────────────

/** Generate a password reset OTP in the DB */
export const generateResetOtp = async (email) => {
  const { data, error } = await supabase.rpc("generate_reset_otp", {
    p_email: email.toLowerCase().trim(),
  });
  if (error) throw error;
  return data; // returns the generated OTP (or null if email does not exist)
};

/** Verify a password reset OTP is valid */
export const verifyResetOtp = async (email, otp) => {
  const { data, error } = await supabase.rpc("verify_reset_otp", {
    p_email: email.toLowerCase().trim(),
    p_otp:   otp.toUpperCase().trim(),
  });
  if (error) throw error;
  return data; // returns true or false
};

/** Reset the user's password using the OTP */
export const resetPasswordWithOtp = async (email, otp, newPassword) => {
  const { data, error } = await supabase.rpc("reset_password_with_otp", {
    p_email:        email.toLowerCase().trim(),
    p_otp:          otp.toUpperCase().trim(),
    p_new_password: newPassword,
  });
  if (error) throw error;
  return data; // returns true or false
};

/** Send the verification OTP to the user via Brevo SMTP API */
export const sendResetOtpEmail = async (email, otp) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;
  const senderEmail = import.meta.env.VITE_SENDER_EMAIL || "noreply@strideo.app";
  const senderName = import.meta.env.VITE_SENDER_NAME || "Strideo";

  if (!apiKey) {
    console.warn("VITE_BREVO_API_KEY not configured in .env. Skipping email sending.");
    return false;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.25);background:#1a1035;">

      <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a21caf 100%);padding:40px 32px;text-align:center;">
        <div style="width:56px;height:56px;line-height:56px;background:rgba(255,255,255,0.15);border-radius:14px;margin:0 auto 16px auto;font-size:28px;text-align:center;color:#fff;">
          🔑
        </div>
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;text-align:center;">
          Password Reset Request
        </h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px;text-align:center;">
          Secure verification code for your Strideo account
        </p>
      </td></tr>

      <tr><td style="padding:32px;">
        <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px;text-align:left;">
          Hello,
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;text-align:left;">
          We received a request to reset the password for your Strideo account. Use the verification code below to complete the reset. This code is valid for 15 minutes.
        </p>

        <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Verification Code</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#fff;letter-spacing:0.15em;">
            ${otp}
          </p>
        </div>

        <p style="color:#475569;font-size:12px;text-align:left;line-height:1.6;margin-bottom:28px;">
          ⚠️ If you did not request a password reset, please ignore this email or contact your administrator to secure your account.
        </p>
      </td></tr>

      <tr><td style="background:#0f0a1e;border-top:1px solid rgba(255,255,255,0.06);padding:20px 32px;text-align:center;">
        <p style="margin:0 0 8px;color:#4f46e5;font-size:15px;font-weight:800;letter-spacing:-0.3px;text-align:center;">Strideo</p>
        <p style="margin:0;color:#334155;font-size:11px;text-align:center;">
          © ${new Date().getFullYear()} Strideo. All rights reserved.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: "Strideo — Reset Your Password 🔑",
        htmlContent,
        tags: ["password-reset"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Brevo API error:", errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email via Brevo:", err);
    return false;
  }
};

