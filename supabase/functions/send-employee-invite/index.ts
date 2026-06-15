// =============================================================================
// Supabase Edge Function: send-employee-invite
// Deploy: supabase functions deploy send-employee-invite
//
// Called from the Admin "Invite Employee" modal.
// 1. Generates a secure token + temp password
// 2. Stores the invitation row in employee_invitations
// 3. Sends a branded Brevo transactional email to the employee
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────
interface InvitePayload {
  workspaceId:     string;
  workspaceName:   string;
  email:           string;
  fullName?:       string;
  jobProfile:      string;
  department?:     string;
  teamId?:         string;
  teamName?:       string;
  personalMessage?: string;
  invitedByName:   string;
}

// ── Job profile display labels ────────────────────────────────────────────────
const JOB_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  company_admin: { label: "Company Admin",   emoji: "🏢", color: "#6366f1" },
  manager:       { label: "Manager",         emoji: "👔", color: "#8b5cf6" },
  hr:            { label: "HR Specialist",   emoji: "👩‍💼", color: "#ec4899" },
  developer:     { label: "Developer",       emoji: "💻", color: "#3b82f6" },
  designer:      { label: "Designer",        emoji: "🎨", color: "#f59e0b" },
  qa_engineer:   { label: "QA Engineer",     emoji: "🔍", color: "#10b981" },
  devops:        { label: "DevOps Engineer", emoji: "⚙️",  color: "#6b7280" },
  finance:       { label: "Finance",         emoji: "💰", color: "#22c55e" },
  sales:         { label: "Sales",           emoji: "📊", color: "#f97316" },
  employee:      { label: "Employee",        emoji: "👤", color: "#64748b" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure temp password: 12 chars, mixed. */
function generateTempPassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;

  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);

  // Guarantee at least one of each class
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

/** Generate a secure hex token (32 bytes = 64 hex chars). */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Email HTML template ───────────────────────────────────────────────────────
function buildInviteEmailHTML(params: {
  fullName:        string;
  workspaceName:   string;
  jobProfile:      string;
  department?:     string;
  teamName?:       string;
  setupLink:       string;
  tempPassword:    string;
  invitedByName:   string;
  personalMessage?: string;
}): string {
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

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.25);background:#1a1035;">

      <!-- ── Header gradient ── -->
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

      <!-- ── Body ── -->
      <tr><td style="padding:32px;">

        <!-- Greeting -->
        <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px;">
          Hi <strong style="color:#fff;">${name}</strong>,
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;">
          <strong style="color:#c4b5fd;">${params.invitedByName}</strong> has invited you to join
          <strong style="color:#fff;">${params.workspaceName}</strong> on TaskFlow — your team's
          project management hub. Your account is ready and waiting!
        </p>

        <!-- Role badge -->
        <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Your Role</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">
            <span style="margin-right:8px;">${jp.emoji}</span>
            <span style="color:${jp.color};">${jp.label}</span>
            ${params.department ? `<span style="color:#64748b;font-weight:400;font-size:13px;"> · ${params.department}</span>` : ""}
          </p>
          ${params.teamName ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">👥 Team: <strong style="color:#c4b5fd;">${params.teamName}</strong></p>` : ""}
        </div>

        <!-- Personal message -->
        ${params.personalMessage ? `
        <div style="background:rgba(255,255,255,0.04);border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Message from ${params.invitedByName}</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px;font-style:italic;">"${params.personalMessage}"</p>
        </div>
        ` : ""}

        <!-- Credentials box -->
        <div style="background:#0f0a1e;border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px;margin-bottom:28px;">
          <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
            🔐 Your Temporary Credentials
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#64748b;font-size:13px;padding:6px 0;">Email</td>
              <td style="color:#e2e8f0;font-size:13px;font-family:monospace;text-align:right;">${params.fullName || ""}</td>
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

        <!-- CTA Button -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${params.setupLink}"
             style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;letter-spacing:0.01em;box-shadow:0 8px 32px rgba(99,102,241,0.4);">
            Set Up My Account →
          </a>
          <p style="margin:12px 0 0;color:#475569;font-size:12px;">
            Link expires on <strong style="color:#94a3b8;">${expires}</strong>
          </p>
        </div>

        <!-- Steps -->
        <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Getting Started</p>
          ${[
            ["1", "Click the button above to open your setup page"],
            ["2", "Enter your temporary password"],
            ["3", "Create your own secure password"],
            ["4", "Complete your profile and start collaborating!"],
          ].map(([n, t]) => `
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${n}</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5;">${t}</span>
          </div>`).join("")}
        </div>

        <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
          Having trouble? Copy this link into your browser:<br/>
          <span style="color:#818cf8;word-break:break-all;font-size:11px;">${params.setupLink}</span>
        </p>
      </td></tr>

      <!-- ── Footer ── -->
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

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // apikey + x-client-info are sent by the Supabase JS client — must be listed
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  const APP_URL       = Deno.env.get("APP_URL") || "http://localhost:5173";
  const SENDER_EMAIL  = Deno.env.get("SENDER_EMAIL") || "noreply@taskflow.app";
  const SENDER_NAME   = Deno.env.get("SENDER_NAME")  || "TaskFlow";

  if (!BREVO_API_KEY) {
    return json({ error: "BREVO_API_KEY not configured" }, 500);
  }

  try {
    // 1. Parse + validate body
    const body: InvitePayload = await req.json();
    const { workspaceId, workspaceName, email, fullName, jobProfile,
            department, teamId, teamName, personalMessage, invitedByName } = body;

    if (!workspaceId || !email || !jobProfile) {
      return json({ error: "workspaceId, email and jobProfile are required" }, 400);
    }

    // 2. Auth — verify the caller is authenticated (JWT in Authorization header)
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // 3. Check caller is company_admin, hr, or manager in this workspace
    const { data: membership } = await sb
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["company_admin", "hr", "manager"].includes(membership.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // 4. Check no active pending invitation for this email in this workspace
    const { data: existing } = await sb
      .from("employee_invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email.toLowerCase().trim())
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return json({ error: `A pending invitation already exists for ${email}.` }, 409);
    }

    // 5. Generate credentials
    const token        = generateToken();
    const tempPassword = generateTempPassword();
    const setupLink    = `${APP_URL}/setup-account?token=${token}`;

    // 6. Store invitation
    const { error: insertErr } = await sb
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
      });

    if (insertErr) throw new Error(insertErr.message);

    // 7. Send Brevo email
    const htmlContent = buildInviteEmailHTML({
      fullName:        fullName || email,
      workspaceName,
      jobProfile,
      department,
      teamName,
      setupLink,
      tempPassword,
      invitedByName:   invitedByName || "Your Admin",
      personalMessage,
    });

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
        to:          [{ email: email.toLowerCase().trim(), name: fullName || email }],
        subject:     `You're invited to join ${workspaceName} on TaskFlow 🎉`,
        htmlContent,
        tags:        ["employee-invite"],
      }),
    });

    if (!brevoRes.ok) {
      const brevoErr = await brevoRes.text();
      console.error("Brevo error:", brevoErr);
      // Invitation row is already stored — don't fail; email delivery is best-effort
      return json({ success: true, emailSent: false, warning: "Email delivery failed" });
    }

    return json({ success: true, emailSent: true });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("send-employee-invite error:", msg);
    return json({ error: msg }, 500);
  }
});
