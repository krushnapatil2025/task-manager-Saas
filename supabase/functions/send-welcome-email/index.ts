// =============================================================================
// Supabase Edge Function: send-welcome-email
// Deploy: supabase functions deploy send-welcome-email
//
// Called by the accept_employee_invitation DB trigger (or from SetupAccount.jsx
// after setup completes). Sends a Brevo "Welcome aboard!" email to the new employee.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  company_admin: { label: "Company Admin",   emoji: "🏢", color: "#6366f1" },
  manager:       { label: "Manager",         emoji: "👔", color: "#8b5cf6" },
  employee:      { label: "Employee",        emoji: "👤", color: "#64748b" },
  intern:        { label: "Intern",         emoji: "🎓", color: "#10b981" },
};

const QUICK_TIPS = [
  { icon: "📋", tip: "Check your task board to see what's assigned to you" },
  { icon: "👥", tip: "Meet your team on the Team Members page" },
  { icon: "🔔", tip: "Enable notifications so you never miss an update" },
  { icon: "💬", tip: "Use task comments to collaborate in real-time" },
];

function buildWelcomeEmailHTML(params: {
  fullName:      string;
  workspaceName: string;
  jobProfile:    string;
  department?:   string;
  teamName?:     string;
  dashboardUrl:  string;
}): string {
  const jp      = JOB_LABELS[params.jobProfile] ?? JOB_LABELS.employee;
  const name    = params.fullName?.split(" ")[0] || "there";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome to ${params.workspaceName}!</title>
</head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.25);background:#1a1035;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed,#a21caf);padding:48px 32px;text-align:center;">
    <div style="font-size:52px;margin-bottom:12px;">🎉</div>
    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Welcome aboard, ${name}!</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:15px;">
      You're now part of <strong>${params.workspaceName}</strong> on TaskFlow
    </p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">

    <!-- Role card -->
    <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Your Role</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">
        <span style="margin-right:8px;">${jp.emoji}</span>
        <span style="color:${jp.color};">${jp.label}</span>
      </p>
      ${params.department ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">🏢 ${params.department}</p>` : ""}
      ${params.teamName   ? `<p style="margin:4px 0 0;color:#c4b5fd;font-size:13px;">👥 ${params.teamName}</p>` : ""}
    </div>

    <!-- Quick tips -->
    <p style="margin:0 0 14px;color:#e2e8f0;font-size:15px;font-weight:700;">Here's how to get started:</p>
    ${QUICK_TIPS.map((t, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">${t.icon}</div>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;padding-top:6px;">${t.tip}</p>
    </div>`).join("")}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${params.dashboardUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:14px;box-shadow:0 8px 32px rgba(99,102,241,0.4);">
        Go to My Dashboard →
      </a>
    </div>

    <p style="margin:0;color:#475569;font-size:12px;text-align:center;line-height:1.7;">
      If you have any questions, reach out to your team admin.<br/>We're glad to have you on the team!
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0f0a1e;border-top:1px solid rgba(255,255,255,0.06);padding:20px 32px;text-align:center;">
    <p style="margin:0 0 6px;color:#4f46e5;font-size:15px;font-weight:800;">TaskFlow</p>
    <p style="margin:0;color:#334155;font-size:11px;">© ${new Date().getFullYear()} TaskFlow. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  const APP_URL       = Deno.env.get("APP_URL") || "http://localhost:5173";
  const SENDER_EMAIL  = Deno.env.get("SENDER_EMAIL") || "noreply@taskflow.app";
  const SENDER_NAME   = Deno.env.get("SENDER_NAME")  || "TaskFlow";

  if (!BREVO_API_KEY) {
    return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), { status: 500 });
  }

  try {
    const body = await req.json();
    const { email, fullName, workspaceName, jobProfile, department, teamName } = body;

    if (!email || !workspaceName || !jobProfile) {
      return new Response(JSON.stringify({ error: "email, workspaceName, jobProfile are required" }), { status: 400 });
    }

    // Verify caller (optional — called internally after setup)
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const dashboardUrl = `${APP_URL}/user/dashboard`;
    const htmlContent  = buildWelcomeEmailHTML({
      fullName: fullName || email,
      workspaceName,
      jobProfile,
      department,
      teamName,
      dashboardUrl,
    });

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
        to:          [{ email, name: fullName || email }],
        subject:     `Welcome to ${workspaceName} on TaskFlow! 🎉`,
        htmlContent,
        tags:        ["employee-welcome"],
      }),
    });

    // Also log the audit event
    const { data: { user } } = await sb.auth.getUser();
    if (user?.id) {
      // Fire-and-forget audit via direct insert with service role
      await sb.from("audit_logs").insert({
        user_id:    user.id,
        action:     "employee.setup_completed",
        resource:   "profiles",
        resource_id: user.id,
        metadata:   { email, jobProfile, workspaceName },
      }).select("id");
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: brevoRes.ok }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
