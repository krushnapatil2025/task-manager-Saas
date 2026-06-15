// =============================================================================
// invitationService.js  — All employee invitation logic, no Edge Functions
//
// The send-employee-invite Edge Function requires Supabase CLI deployment.
// This version replaces the Edge Function calls with direct Supabase DB
// operations so invite flow works immediately from localhost.
//
// Trade-off: email sending via Brevo is skipped (no server-side API key).
// The admin gets a copyable setup link instead. Email can be added back
// once the Edge Function is deployed.
// =============================================================================

import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cryptographically secure random hex token (64 chars) */
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Secure temp password — 12 chars, mixed case + digit + special */
function generateTempPassword() {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;

  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);

  let pw = [
    upper[arr[0]  % upper.length],
    lower[arr[1]  % lower.length],
    digits[arr[2] % digits.length],
    special[arr[3] % special.length],
  ];
  for (let i = 4; i < 12; i++) pw.push(all[arr[i] % all.length]);

  // Shuffle
  for (let i = pw.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join("");
}

// =============================================================================
// WORKSPACE INVITATIONS (legacy — kept for back-compat)
// =============================================================================

export const createInvitation = async (workspaceId, email, role, invitedBy) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: workspaceId,
    email:        email.toLowerCase().trim(),
    role:         role || "member",
    token,
    expires_at:   expiresAt,
    invited_by:   invitedBy,
  });
  if (error) throw error;
  return {
    id: token,
    email: email.toLowerCase().trim(),
    role,
    token,
    expiresAt,
    createdAt: new Date().toISOString(),
    isPending: true,
  };
};

export const getInvitations = async (workspaceId) => {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select(`
      id, email, role, expires_at, accepted_at, created_at, token,
      inviter:profiles!invited_by(name)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(inv => ({
    id:          inv.id,
    email:       inv.email,
    role:        inv.role,
    token:       inv.token,
    expiresAt:   inv.expires_at,
    acceptedAt:  inv.accepted_at,
    createdAt:   inv.created_at,
    inviterName: inv.inviter?.name || "Unknown",
    isPending:   !inv.accepted_at && new Date(inv.expires_at) > new Date(),
    isExpired:   !inv.accepted_at && new Date(inv.expires_at) < new Date(),
  }));
};

export const sendInvite = async ({ email, role, workspaceId }) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: workspaceId,
    email:        email.toLowerCase().trim(),
    role:         role || "member",
    token,
    expires_at:   expiresAt,
  });
  if (error) throw error;
  return { token };
};

export const getPendingInvitations = async (workspaceId) => {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const revokeInvitation = async (invitationId) => {
  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId);
  if (error) throw error;
};

export const getInvitationByToken = async (token) => {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select(`
      id, email, role, expires_at, accepted_at,
      workspace:workspaces(id, name, slug, logo_url)
    `)
    .eq("token", token)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return {
    id:             data.id,
    email:          data.email,
    role:           data.role,
    expiresAt:      data.expires_at,
    acceptedAt:     data.accepted_at,
    workspaceId:    data.workspace?.id,
    workspaceName:  data.workspace?.name,
    workspaceLogo:  data.workspace?.logo_url,
    isExpired:      new Date(data.expires_at) < new Date(),
    isAccepted:     !!data.accepted_at,
  };
};

export const buildInviteLink = (token) =>
  `${window.location.origin}/invite/${token}`;

export const acceptInvitation = async (token) => {
  const { data, error } = await supabase.rpc("accept_workspace_invitation", {
    p_token: token,
  });
  if (error) throw error;
  return data;
};

// =============================================================================
// EMPLOYEE INVITATIONS — Direct DB (no Edge Function required)
// =============================================================================

/**
 * Send an employee invitation — stores the row in employee_invitations and
 * returns the setup link for the admin to copy/share manually.
 *
 * When the Supabase Edge Function is deployed, swap this back to:
 *   supabase.functions.invoke("send-employee-invite", { body: params })
 */
export const sendEmployeeInvite = async (params) => {
  const {
    workspaceId, workspaceName, email, fullName, jobProfile,
    department, teamId, teamName, personalMessage, invitedByName,
  } = params;

  if (!workspaceId || !email || !jobProfile) {
    throw new Error("workspaceId, email and jobProfile are required");
  }

  // Check for duplicate pending invite
  const { data: existing } = await supabase
    .from("employee_invitations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email.toLowerCase().trim())
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    throw new Error(`A pending invitation already exists for ${email}.`);
  }

  // Get current user's id (to set invited_by)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const token        = generateToken();
  const tempPassword = generateTempPassword();
  const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase
    .from("employee_invitations")
    .insert({
      workspace_id:  workspaceId,
      email:         email.toLowerCase().trim(),
      name:          fullName || null,
      job_profile:   jobProfile,
      department:    department || null,
      team_id:       teamId || null,
      invited_by:    user.id,
      token,
      temp_password: tempPassword,
      status:        "pending",
      expires_at:    expiresAt,
    });

  if (insertErr) throw new Error(insertErr.message);

  const setupLink = buildSetupLink(token);

  // Send the email via Brevo
  const htmlContent = buildInviteEmailHTML({
    fullName:        fullName || email,
    workspaceName:   workspaceName || "TaskFlow",
    jobProfile,
    department,
    teamName,
    setupLink,
    tempPassword,
    invitedByName:   invitedByName || "Your Admin",
    personalMessage: personalMessage || "",
    email:           email.toLowerCase().trim(),
  });

  const emailSent = await sendEmailViaBrevo({
    toEmail: email.toLowerCase().trim(),
    toName: fullName || email,
    subject: `You're invited to join ${workspaceName || "TaskFlow"} on TaskFlow 🎉`,
    htmlContent,
  });

  return {
    success:     true,
    emailSent,
    setupLink,
    tempPassword,
    warning:     emailSent ? null : "Invitation saved. Email could not be sent — copy the setup link to share manually.",
  };
};

/**
 * Get all employee invitations for a workspace.
 */
export const getEmployeeInvitations = async (workspaceId, statusFilter = null) => {
  let query = supabase
    .from("employee_invitations")
    .select(`
      id, email, name, job_profile, department, status,
      expires_at, accepted_at, created_at,
      invited_by, team_id,
      teams(name),
      inviter:profiles!invited_by(id, name)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((inv) => ({
    id:              inv.id,
    email:           inv.email,
    fullName:        inv.name || inv.email?.split("@")[0] || "Invited User",
    jobProfile:      inv.job_profile,
    department:      inv.department,
    status:          inv.status,
    teamId:          inv.team_id,
    teamName:        inv.teams?.name || null,
    expiresAt:       inv.expires_at,
    acceptedAt:      inv.accepted_at,
    createdAt:       inv.created_at,
    personalMessage: null,
    inviterName:     inv.inviter?.name || "Unknown",
    inviterId:       inv.inviter?.id,
    isPending:       inv.status === "pending" && new Date(inv.expires_at) > new Date(),
    isExpired:       inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at) < new Date()),
    isAccepted:      inv.status === "accepted",
  }));
};

/**
 * Revoke a pending employee invitation.
 */
export const revokeEmployeeInvitation = async (invitationId) => {
  const { error } = await supabase
    .from("employee_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("status", "pending");
  if (error) throw error;
};

/**
 * Resend: generate a new token + password, update the invitation row.
 * No Edge Function required.
 */
export const resendEmployeeInvite = async (invitationId) => {
  // Fetch details of the invitation first
  const { data: inv, error: fetchErr } = await supabase
    .from("employee_invitations")
    .select(`
      email, name, job_profile, department, team_id,
      workspace_id,
      workspaces(name),
      teams(name),
      inviter:profiles!invited_by(name)
    `)
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr || !inv) {
    throw new Error(fetchErr?.message || "Invitation not found");
  }

  const newToken    = generateToken();
  const newPassword = generateTempPassword();
  const newExpiry   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("employee_invitations")
    .update({
      token:         newToken,
      temp_password: newPassword,
      expires_at:    newExpiry,
      status:        "pending",
    })
    .eq("id", invitationId);

  if (error) throw new Error(error.message);

  const setupLink = buildSetupLink(newToken);

  // Send the email via Brevo
  const htmlContent = buildInviteEmailHTML({
    fullName:        inv.name || inv.email,
    workspaceName:   inv.workspaces?.name || "TaskFlow",
    jobProfile:      inv.job_profile,
    department:      inv.department,
    teamName:        inv.teams?.name || "",
    setupLink,
    tempPassword:    newPassword,
    invitedByName:   inv.inviter?.name || "Your Admin",
    personalMessage: "Here is your refreshed invitation link and temporary password.",
    email:           inv.email,
  });

  const emailSent = await sendEmailViaBrevo({
    toEmail: inv.email,
    toName: inv.name || inv.email,
    subject: `Your invitation to join ${inv.workspaces?.name || "TaskFlow"} has been refreshed! 🎉`,
    htmlContent,
  });

  return {
    success:     true,
    emailSent,
    setupLink,
    tempPassword: newPassword,
    warning:     emailSent ? null : "Invitation refreshed. Copy the new setup link to share manually.",
  };
};

/**
 * Look up an employee invitation by token (for the /setup-account page).
 */
export const getEmployeeInviteByToken = async (token) => {
  const { data, error } = await supabase.rpc("get_employee_invite_by_token", {
    p_token: token,
  });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0];

  return {
    id:            row.id,
    email:         row.email,
    fullName:      row.name,
    jobProfile:    row.job_profile,
    department:    row.department,
    status:        row.status,
    expiresAt:     row.expires_at,
    isExpired:     row.status !== "pending" || new Date(row.expires_at) < new Date(),
    isAccepted:    row.status === "accepted",
    teamId:        row.team_id,
    teamName:      row.team_name || null,
    workspaceId:   row.workspace_id,
    workspaceName: row.workspace_name || null,
    workspaceLogo: row.workspace_logo || null,
    tempPassword:  row.temp_password || null,
  };
};

/**
 * Accept an employee invitation via DB RPC.
 */
export const acceptEmployeeInvitation = async (token) => {
  const { data, error } = await supabase.rpc("accept_employee_invitation", {
    p_token: token,
  });
  if (error) throw error;
  return data;
};

/**
 * Build the employee setup link from a token.
 */
export const buildSetupLink = (token) =>
  `${window.location.origin}/setup-account?token=${token}`;

// ── Brevo Direct Mail Send Helpers ──────────────────────────────────────────

const JOB_LABELS = {
  company_admin: { label: "Company Admin",   emoji: "🏢", color: "#6366f1" },
  manager:       { label: "Manager",         emoji: "👔", color: "#8b5cf6" },
  employee:      { label: "Employee",        emoji: "👤", color: "#64748b" },
  intern:        { label: "Intern",         emoji: "🎓", color: "#10b981" },
};

function buildInviteEmailHTML(params) {
  const jp      = JOB_LABELS[params.jobProfile] ?? JOB_LABELS.employee;
  const name    = params.fullName || "there";
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You're invited to ${params.workspaceName}</title>
</head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.25);background:#1a1035;">

      <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a21caf 100%);padding:40px 32px;text-align:center;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:28px;">
          ✅
        </div>
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
          You're Invited!
        </h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px;">
          Join <strong>${params.workspaceName}</strong> on TaskFlow
        </p>
      </td></tr>

      <tr><td style="padding:32px;">

        <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px;">
          Hi <strong style="color:#fff;">${name}</strong>,
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;">
          <strong style="color:#c4b5fd;">${params.invitedByName}</strong> has invited you to join
          <strong style="color:#fff;">${params.workspaceName}</strong> on TaskFlow — your team's
          project management hub. Your account is ready and waiting!
        </p>

        <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Your Role</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">
            <span style="margin-right:8px;">${jp.emoji}</span>
            <span style="color:${jp.color};">${jp.label}</span>
            ${params.department ? `<span style="color:#64748b;font-weight:400;font-size:13px;"> · ${params.department}</span>` : ""}
          </p>
          ${params.teamName ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">👥 Team: <strong style="color:#c4b5fd;">${params.teamName}</strong></p>` : ""}
        </div>

        ${params.personalMessage ? `
        <div style="background:rgba(255,255,255,0.04);border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Message from ${params.invitedByName}</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px;font-style:italic;">"${params.personalMessage}"</p>
        </div>
        ` : ""}

        <div style="background:#0f0a1e;border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px;margin-bottom:28px;">
          <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
            🔐 Your Temporary Credentials
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#64748b;font-size:13px;padding:6px 0;">Email</td>
              <td style="color:#e2e8f0;font-size:13px;font-family:monospace;text-align:right;">${params.email}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;padding:6px 0;">Temp Password</td>
              <td style="text-align:right;">
                <span style="background:rgba(99,102,241,0.2);color:#a5b4fc;font-family:monospace;font-size:14px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:0.05em;">
                  ${params.tempPassword}
                </span>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;color:#475569;font-size:11px;">
            ⚠️ You'll be prompted to set a new password when you first log in. Don't share these credentials.
          </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${params.setupLink}"
             style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;letter-spacing:0.01em;box-shadow:0 8px 32px rgba(99,102,241,0.4);">
            Set Up My Account →
          </a>
          <p style="margin:12px 0 0;color:#475569;font-size:12px;">
            Link expires on <strong style="color:#94a3b8;">${expires}</strong>
          </p>
        </div>

        <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Getting Started</p>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">1</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5;">Click the button above to open your setup page</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">2</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5;">Enter your temporary password</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">3</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5;">Create your own secure password</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">4</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5;">Complete your profile and start collaborating!</span>
          </div>
        </div>

        <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
          Having trouble? Copy this link into your browser:<br/>
          <span style="color:#818cf8;word-break:break-all;font-size:11px;">${params.setupLink}</span>
        </p>
      </td></tr>

      <tr><td style="background:#0f0a1e;border-top:1px solid rgba(255,255,255,0.06);padding:20px 32px;text-align:center;">
        <p style="margin:0 0 8px;color:#4f46e5;font-size:15px;font-weight:800;letter-spacing:-0.3px;">TaskFlow</p>
        <p style="margin:0;color:#334155;font-size:11px;">
          You received this because ${params.invitedByName} invited you to ${params.workspaceName}.
          <br/>© ${new Date().getFullYear()} TaskFlow. All rights reserved.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const sendEmailViaBrevo = async ({ toEmail, toName, subject, htmlContent }) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;
  const senderEmail = import.meta.env.VITE_SENDER_EMAIL || "noreply@taskflow.app";
  const senderName = import.meta.env.VITE_SENDER_NAME || "TaskFlow";

  if (!apiKey) {
    console.warn("VITE_BREVO_API_KEY not configured in .env. Skipping email sending.");
    return false;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent,
        tags: ["employee-invite"],
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
