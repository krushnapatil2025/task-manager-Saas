// =============================================================================
// Supabase Edge Function: resend-employee-invite
// Deploy: supabase functions deploy resend-employee-invite
//
// Re-sends the Brevo invitation email for an existing pending invitation.
// Generates a FRESH token (the old one is revoked) and extends expiry by 7 days.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_LABELS: Record<string, { label: string; emoji: string }> = {
  company_admin: { label: "Company Admin",   emoji: "🏢" },
  manager:       { label: "Manager",         emoji: "👔" },
  hr:            { label: "HR Specialist",   emoji: "👩‍💼" },
  developer:     { label: "Developer",       emoji: "💻" },
  designer:      { label: "Designer",        emoji: "🎨" },
  qa_engineer:   { label: "QA Engineer",     emoji: "🔍" },
  devops:        { label: "DevOps Engineer", emoji: "⚙️"  },
  finance:       { label: "Finance",         emoji: "💰" },
  sales:         { label: "Sales",           emoji: "📊" },
  employee:      { label: "Employee",        emoji: "👤" },
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  const arr   = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const { invitationId } = await req.json();
    if (!invitationId) return json({ error: "invitationId is required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Load existing invitation
    const { data: inv, error: invErr } = await sb
      .from("employee_invitations")
      .select(`id, workspace_id, email, name, job_profile, department, workspaces(name)`)
      .eq("id", invitationId)
      .eq("status", "pending")
      .single();

    if (invErr || !inv) {
      return json({ error: "Invitation not found or already accepted." }, 404);
    }

    // Verify caller is admin/hr in that workspace
    const { data: membership } = await sb
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", inv.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["company_admin", "hr", "manager"].includes(membership.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Rotate token + password, extend expiry
    const newToken    = generateToken();
    const newPassword = generateTempPassword();
    const newExpiry   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await sb
      .from("employee_invitations")
      .update({ token: newToken, temp_password: newPassword, expires_at: newExpiry })
      .eq("id", invitationId);

    const workspaceName = (inv as any).workspaces?.name ?? "Your Company";
    const jp       = JOB_LABELS[inv.job_profile] ?? JOB_LABELS.employee;
    const setupLink = `${APP_URL}/setup-account?token=${newToken}`;
    const expires   = new Date(newExpiry).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Invitation Reminder</title></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:40px 16px;">
  <tr><td align="center">
  <table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.25);background:#1a1035;">
    <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px 32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Invitation Reminder 🔔</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">You still have a pending invite to <strong>${workspaceName}</strong></p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px;">
        Hi <strong>${inv.name || "there"}</strong>, this is a reminder that you've been invited to join
        <strong style="color:#c4b5fd;">${workspaceName}</strong> as <strong>${jp.emoji} ${jp.label}</strong>.
      </p>
      <div style="background:#0f0a1e;border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">🔐 Updated Credentials</p>
        <p style="margin:0 0 6px;color:#94a3b8;font-size:13px;">Temp Password:
          <span style="background:rgba(99,102,241,.2);color:#a5b4fc;font-family:monospace;font-weight:700;padding:3px 9px;border-radius:6px;">${newPassword}</span>
        </p>
        <p style="margin:0;color:#475569;font-size:11px;">⚠️ Your previous credentials have been reset.</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${setupLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
          Set Up My Account →
        </a>
        <p style="margin:10px 0 0;color:#475569;font-size:12px;">Expires <strong style="color:#94a3b8;">${expires}</strong></p>
      </div>
    </td></tr>
    <tr><td style="background:#0f0a1e;border-top:1px solid rgba(255,255,255,.06);padding:18px 32px;text-align:center;">
      <p style="margin:0;color:#4f46e5;font-size:14px;font-weight:800;">TaskFlow</p>
      <p style="margin:4px 0 0;color:#334155;font-size:11px;">© ${new Date().getFullYear()} TaskFlow. All rights reserved.</p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:  { name: SENDER_NAME, email: SENDER_EMAIL },
        to:      [{ email: inv.email, name: inv.name || inv.email }],
        subject: `Reminder: Set up your ${workspaceName} account on TaskFlow`,
        htmlContent,
        tags:    ["employee-invite-reminder"],
      }),
    });

    return json({ success: true, emailSent: brevoRes.ok });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: msg }, 500);
  }
});
